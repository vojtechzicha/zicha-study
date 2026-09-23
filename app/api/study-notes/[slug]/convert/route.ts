import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import * as db from '@/lib/mongodb/db'
import { getOneDriveToken } from '@/lib/utils/onedrive'
import { downloadFromOneDrive, updateCacheFromOriginal } from '@/lib/utils/onedrive-cache'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/utils/rate-limit'
import { NOTE_TYPES, getNoteType } from '@/lib/constants'
import { convertObsidianToHtml } from '@/lib/utils/obsidian-convert'
import { addHeadingIdsAndBuildToc, applyStudyNoteTemplate } from '@/lib/utils/study-note-html'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import os from 'os'
import mammoth, { type Image as MammothImage, type Options as MammothOptions } from 'mammoth'
import { load } from 'cheerio'
import JSZip from 'jszip'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import omml2mathml from 'omml2mathml'
import { MathMLToLaTeX } from 'mathml-to-latex'

interface ConversionResult {
  html: string
  mediaPath: string | null
  cacheKey: string
  title: string | null
}

interface MammothElement {
  type: string
  children?: MammothElement[]
  [key: string]: unknown
}


export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const { searchParams } = new URL(request.url)
  const forceRegenerate = searchParams.get('flush') === '1'
  const studyId = searchParams.get('studyId')

  // Keyed by slug because this endpoint is public
  const rateLimitResult = checkRateLimit(`convert:${slug}`, RATE_LIMITS.DOCUMENT_CONVERSION)
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult.resetTime)
  }

  try {
    // null for anonymous viewers of public notes
    const session = await auth()

    const note = await db.getStudyNoteBySlug(slug, studyId || undefined)

    if (!note) {
      return NextResponse.json({ error: 'Zápis nebyl nalezen.' }, { status: 404 })
    }

    const noteId = note._id as string

    const study = await db.getStudyById(note.study_id as string)

    // Single-user app: any signed-in session is the owner
    const isOwner = !!session?.accessToken
    if (!note.is_public && !isOwner) {
      return NextResponse.json({ error: 'Zápis nebyl nalezen.' }, { status: 404 })
    }

    // Not used yet; kept for a future ownership check
    void study

    const cachedData = await db.getStudyNotesCache(noteId)

    let onedriveLastModified: Date | null = null
    let fileBuffer: ArrayBuffer | null = null
    let sourceUsed: 'original' | 'cache' = 'original'
    let hasToken = false

    try {
      await getOneDriveToken()
      hasToken = true

      if (note.onedrive_id) {
        const originalResult = await downloadFromOneDrive(note.onedrive_id as string)
        if (originalResult) {
          fileBuffer = originalResult.buffer
          onedriveLastModified = originalResult.lastModified
          sourceUsed = 'original'

          // Refresh the cache copy if the original is newer (fire-and-forget)
          if (note.cache_onedrive_id) {
            updateCacheFromOriginal(note.onedrive_id as string, note.cache_onedrive_id as string)
              .catch(() => { /* non-critical */ })
          }
        }
      }
    } catch {
      hasToken = false
    }

    // Original unavailable: fall back to the OneDrive cache copy
    if (!fileBuffer && note.cache_onedrive_id && hasToken) {
      const cacheResult = await downloadFromOneDrive(note.cache_onedrive_id as string)
      if (cacheResult) {
        fileBuffer = cacheResult.buffer
        onedriveLastModified = cacheResult.lastModified
        sourceUsed = 'cache'
      }
    }

    const shouldRegenerate =
      forceRegenerate ||
      !cachedData ||
      (fileBuffer && onedriveLastModified && new Date(cachedData.onedrive_last_modified as string) < onedriveLastModified)

    if (!shouldRegenerate && cachedData) {
      return NextResponse.json({
        html: cachedData.html_content,
        title: cachedData.title,
        cacheKey: cachedData.cache_key,
        mediaPath: cachedData.has_media ? `media-${cachedData.cache_key}` : null,
        cached: true,
        onedriveLastModified: cachedData.onedrive_last_modified,
        generatedAt: cachedData.generated_at,
        onedriveAccessible: fileBuffer !== null || !hasToken,
        sourceUsed,
      })
    }

    if (!fileBuffer) {
      return NextResponse.json(
        { error: 'Nepodařilo se načíst soubor zápisu z OneDrive ani z mezipaměti.' },
        { status: 500 }
      )
    }

    // Includes the generation time so every regeneration busts cached media URLs
    const cacheKey = crypto
      .createHash('md5')
      .update(`${noteId}-${onedriveLastModified?.toISOString() || 'unknown'}-${Date.now()}`)
      .digest('hex')

    // Convert the document (OneDrive DOCX via Mammoth, or Obsidian vault Markdown)
    const result =
      getNoteType(note as { note_type?: string | null }) === NOTE_TYPES.OBSIDIAN
        ? await convertObsidianToHtml(Buffer.from(fileBuffer), {
            cacheKey,
            parentPath: (note.parent_path as string | null) || null,
            fallbackTitle: (note.name as string) || '',
          })
        : await convertDocxToHtmlWithMammoth(Buffer.from(fileBuffer), cacheKey)

    await db.upsertStudyNotesCache(noteId, {
      html_content: result.html,
      title: result.title,
      onedrive_last_modified: onedriveLastModified || (cachedData?.onedrive_last_modified ?? null),
      generated_at: new Date().toISOString(),
      cache_key: cacheKey,
      has_media: !!result.mediaPath,
    })

    if (onedriveLastModified) {
      await db.updateStudyNote(noteId, {
        last_modified_onedrive: onedriveLastModified,
      })
    }

    if (result.mediaPath) {
      await storeMediaInDatabase(noteId, result.mediaPath)
      await fs.rm(path.dirname(result.mediaPath), { recursive: true, force: true })
    }

    return NextResponse.json({
      ...result,
      cached: false,
      onedriveLastModified: onedriveLastModified?.toISOString(),
      generatedAt: new Date().toISOString(),
      onedriveAccessible: true,
      sourceUsed,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepodařilo se převést zápis.' },
      { status: 500 }
    )
  }
}

async function storeMediaInDatabase(noteId: string, mediaPath: string) {
  try {
    const cacheRecord = await db.getStudyNotesCache(noteId)

    if (!cacheRecord) return

    const cacheId = cacheRecord._id as string

    await db.deleteMediaByCacheId(cacheId)

    const mediaFiles = await fs.readdir(mediaPath)

    for (const file of mediaFiles) {
      const filePath = path.join(mediaPath, file)
      const fileData = await fs.readFile(filePath)

      const ext = path.extname(file).toLowerCase()
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
      }

      await db.insertMedia(cacheId, `media/${file}`, fileData, mimeTypes[ext] || 'application/octet-stream')
    }

    await fs.rm(mediaPath, { recursive: true, force: true })
  } catch {
    // Non-critical
  }
}

interface MathEquation {
  latex: string
  isDisplay: boolean
  placeholder?: string
}

// Mammoth drops OMML equations, so convert each one to LaTeX and swap it for a text placeholder
async function preprocessDocxWithMathPlaceholders(fileBuffer: Buffer): Promise<{
  buffer: Buffer
  mathMap: Map<string, MathEquation>
}> {
  const mathMap = new Map<string, MathEquation>()

  try {
    const zip = await JSZip.loadAsync(fileBuffer)
    const documentXml = await zip.file('word/document.xml')?.async('string')

    if (!documentXml) {
      return { buffer: fileBuffer, mathMap }
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(documentXml, 'text/xml')

    const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    const mathNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/math'

    let equationCounter = 0

    // Display equations (oMathPara) first. Iterate backwards: the NodeList is live and shrinks as
    // nodes are replaced.
    const oMathParas = doc.getElementsByTagNameNS(mathNamespace, 'oMathPara')
    for (let i = oMathParas.length - 1; i >= 0; i--) {
      const oMathPara = oMathParas[i]
      const oMath = oMathPara.getElementsByTagNameNS(mathNamespace, 'oMath')[0]

      if (oMath) {
        try {
          const mathmlElement = omml2mathml(oMath)
          const mathmlString = mathmlElement.outerHTML
          const latexString = MathMLToLaTeX.convert(mathmlString)

          const placeholder = `[[MATH_DISPLAY_${equationCounter++}]]`

          mathMap.set(placeholder, {
            latex: latexString,
            isDisplay: true,
            placeholder
          })

          const textRun = doc.createElementNS(wordNamespace, 'w:r')
          const text = doc.createElementNS(wordNamespace, 'w:t')
          text.textContent = placeholder
          textRun.appendChild(text)

          const para = doc.createElementNS(wordNamespace, 'w:p')
          para.appendChild(textRun)

          oMathPara.parentNode?.replaceChild(para, oMathPara)
        } catch {
          // Skip equations that fail to convert
        }
      }
    }

    // Then inline equations (oMath outside oMathPara)
    const allMath = doc.getElementsByTagNameNS(mathNamespace, 'oMath')
    for (let i = allMath.length - 1; i >= 0; i--) {
      const oMath = allMath[i]

      if (oMath.parentNode && (oMath.parentNode as Element).localName === 'oMathPara') {
        continue
      }

      try {
        const mathmlElement = omml2mathml(oMath)
        const mathmlString = mathmlElement.outerHTML
        const latexString = MathMLToLaTeX.convert(mathmlString)

        const placeholder = `[[MATH_INLINE_${equationCounter++}]]`

        mathMap.set(placeholder, {
          latex: latexString,
          isDisplay: false,
          placeholder
        })

        const textRun = doc.createElementNS(wordNamespace, 'w:r')
        const text = doc.createElementNS(wordNamespace, 'w:t')
        text.textContent = placeholder
        textRun.appendChild(text)

        oMath.parentNode?.replaceChild(textRun, oMath)
      } catch {
        // Skip equations that fail to convert
      }
    }

    const serializer = new XMLSerializer()
    const modifiedXml = serializer.serializeToString(doc)

    zip.file('word/document.xml', modifiedXml)

    const modifiedBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    return { buffer: modifiedBuffer, mathMap }
  } catch {
    return { buffer: fileBuffer, mathMap }
  }
}

async function convertDocxToHtmlWithMammoth(fileBuffer: Buffer, cacheKey: string): Promise<ConversionResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docx-convert-'))
  const mediaDir = path.join(tempDir, 'media')
  await fs.mkdir(mediaDir)

  let hasMedia = false
  const mediaFiles: { [key: string]: Buffer } = {}

  const { buffer: processedBuffer, mathMap } = await preprocessDocxWithMathPlaceholders(fileBuffer)

  const imageConverter = (image: MammothImage) => {
    return image.read().then((imageBuffer: Buffer) => {
      hasMedia = true
      const extension = image.contentType.split('/')[1] || 'png'
      const filename = `image${Object.keys(mediaFiles).length + 1}.${extension}`
      const imagePath = path.join(mediaDir, filename)

      mediaFiles[filename] = imageBuffer
      fs.writeFile(imagePath, imageBuffer)

      // Relative URL, served by the media endpoint
      return {
        src: `media/${filename}`,
      }
    })
  }

  // Drops horizontal rules and single-link paragraphs (Word TOC entries)
  const transformDocument = (element: MammothElement): MammothElement | null => {
    if (!element) {
      return element
    }

    if (element.type === 'horizontal-rule') {
      return null
    }

    if (element.type === 'paragraph' && element.children) {
      if (element.children.length === 1) {
        const child = element.children[0]
        if (child && 'type' in child && child.type === 'hyperlink') {
          return null
        }
      }
    }

    if (element.children) {
      element.children = element.children
        .map((child: MammothElement) => transformDocument(child))
        .filter((child): child is MammothElement => child !== null)
    }

    return element
  }

  let documentTitle: string | null = null

  // Separate pass to find the title, because the main pass drops Title paragraphs
  const extractTitleOptions: MammothOptions = {
    styleMap: [
      "p[style-name='Title'] => p.mammoth-document-title > :fresh",
    ]
  }

  const preliminaryResult = await mammoth.convertToHtml({ buffer: fileBuffer }, extractTitleOptions)
  const $preliminary = load(preliminaryResult.value)

  const titleElement = $preliminary('p.mammoth-document-title').first()
  if (titleElement.length > 0) {
    documentTitle = titleElement.text().trim()
  } else {
    // Fallback: the first paragraph, unless it is a numbered TOC entry or the "Obsah" heading
    const firstPara = $preliminary('p').first()
    if (firstPara.length > 0) {
      const firstParaText = firstPara.text().trim()
      if (firstParaText && !firstParaText.match(/^\d+\s*[\.\)]\s*/) && firstParaText !== 'Obsah') {
        documentTitle = firstParaText
      }
    }
  }

  const enhancedTransformDocument = (element: MammothElement): MammothElement | null => {
    return transformDocument(element);
  }

  const mammothOptions: MammothOptions = {
    convertImage: mammoth.images.inline(imageConverter),
    transformDocument: enhancedTransformDocument,
    styleMap: [
      // '=> !' drops the paragraph: the template renders the title and the TOC is rebuilt
      "p[style-name='Title'] => !",
      "p[style-name='toc 1'] => !",
      "p[style-name='toc 2'] => !",
      "p[style-name='toc 3'] => !",
      "p[style-name='TOC Heading'] => !",
    ]
  }

  const result = await mammoth.convertToHtml({ buffer: processedBuffer }, mammothOptions)
  let bodyHtml = result.value

  if (mathMap.size > 0) {
    mathMap.forEach((equation, placeholder) => {
      const mathHtml = equation.isDisplay
        ? `<span class="math display">\\[${equation.latex}\\]</span>`
        : `<span class="math inline">\\(${equation.latex}\\)</span>`

      bodyHtml = bodyHtml.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), mathHtml)
    })
  }

  const $ = load(bodyHtml)

  const title: string | null = documentTitle

  // A fallback title is a plain first paragraph that the style map did not drop
  if (title) {
    const firstPara = $('p').first()
    if (firstPara.length > 0 && firstPara.text().trim() === title) {
      firstPara.remove()
    }
  }

  const tocHtml = addHeadingIdsAndBuildToc($)

  const finalHtml = await applyStudyNoteTemplate({
    bodyHtml: $.html(),
    tocHtml,
    title,
  })

  return {
    html: finalHtml,
    mediaPath: hasMedia ? mediaDir : null,
    cacheKey,
    title,
  }
}
