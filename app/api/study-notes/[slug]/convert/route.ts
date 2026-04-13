import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import * as db from '@/lib/mongodb/db'
import { getOneDriveToken } from '@/lib/utils/onedrive'
import { downloadFromOneDrive, updateCacheFromOriginal } from '@/lib/utils/onedrive-cache'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/utils/rate-limit'
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

// Type for mammoth document elements
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

  // Rate limiting based on slug (since this is a public endpoint)
  const rateLimitResult = checkRateLimit(`convert:${slug}`, RATE_LIMITS.DOCUMENT_CONVERSION)
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult.resetTime)
  }

  try {
    // Get current user (may be null for public notes)
    const session = await auth()

    // First, try to find a note with this slug
    const note = await db.getStudyNoteBySlug(slug, studyId || undefined)

    if (!note) {
      return NextResponse.json({ error: 'Study note not found' }, { status: 404 })
    }

    const noteId = note._id as string

    // Get the study to check user_id for authorization
    const study = await db.getStudyById(note.study_id as string)

    // Authorization check:
    // 1. If note is public, allow access
    // 2. If note is private, only allow authenticated access
    const isOwner = !!session?.accessToken
    if (!note.is_public && !isOwner) {
      return NextResponse.json({ error: 'Study note not found' }, { status: 404 })
    }

    // Suppress unused variable warning - study is fetched for potential future auth checks
    void study

    // Check if we have a cached HTML conversion
    const cachedData = await db.getStudyNotesCache(noteId)

    let onedriveLastModified: Date | null = null
    let fileBuffer: ArrayBuffer | null = null
    let sourceUsed: 'original' | 'cache' = 'original'
    let hasToken = false

    // Try to download from original OneDrive location
    try {
      await getOneDriveToken()
      hasToken = true

      if (note.onedrive_id) {
        const originalResult = await downloadFromOneDrive(note.onedrive_id as string)
        if (originalResult) {
          fileBuffer = originalResult.buffer
          onedriveLastModified = originalResult.lastModified
          sourceUsed = 'original'

          // If original succeeded and cache copy exists, sync cache if original is newer (fire-and-forget)
          if (note.cache_onedrive_id) {
            updateCacheFromOriginal(note.onedrive_id as string, note.cache_onedrive_id as string)
              .catch(() => { /* non-critical */ })
          }
        }
      }
    } catch {
      hasToken = false
    }

    // If original failed, try cache copy
    if (!fileBuffer && note.cache_onedrive_id && hasToken) {
      const cacheResult = await downloadFromOneDrive(note.cache_onedrive_id as string)
      if (cacheResult) {
        fileBuffer = cacheResult.buffer
        onedriveLastModified = cacheResult.lastModified
        sourceUsed = 'cache'
      }
    }

    // Determine if we should use cached HTML or regenerate
    const shouldRegenerate =
      forceRegenerate ||
      !cachedData ||
      (fileBuffer && onedriveLastModified && new Date(cachedData.onedrive_last_modified as string) < onedriveLastModified)

    if (!shouldRegenerate && cachedData) {
      // Use cached HTML conversion (performance cache — DOCX hasn't changed)
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

    // Need to regenerate — must have file content from either original or cache
    if (!fileBuffer) {
      return NextResponse.json(
        { error: 'Unable to access file from original location or cache' },
        { status: 500 }
      )
    }

    // Generate new cache key including generation time for cache busting
    const cacheKey = crypto
      .createHash('md5')
      .update(`${noteId}-${onedriveLastModified?.toISOString() || 'unknown'}-${Date.now()}`)
      .digest('hex')

    // Convert the document
    const result = await convertDocxToHtmlWithMammoth(Buffer.from(fileBuffer), cacheKey)

    // Store in database using upsert
    await db.upsertStudyNotesCache(noteId, {
      html_content: result.html,
      title: result.title,
      onedrive_last_modified: onedriveLastModified || (cachedData?.onedrive_last_modified ?? null),
      generated_at: new Date().toISOString(),
      cache_key: cacheKey,
      has_media: !!result.mediaPath,
    })

    // Also update the main study_notes table with the new OneDrive last modified date
    if (onedriveLastModified) {
      await db.updateStudyNote(noteId, {
        last_modified_onedrive: onedriveLastModified,
      })
    }

    // Store media files if any
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
      { error: error instanceof Error ? error.message : 'Conversion failed' },
      { status: 500 }
    )
  }
}

async function storeMediaInDatabase(noteId: string, mediaPath: string) {
  try {
    // Get cache record
    const cacheRecord = await db.getStudyNotesCache(noteId)

    if (!cacheRecord) return

    const cacheId = cacheRecord._id as string

    // Delete old media files
    await db.deleteMediaByCacheId(cacheId)

    // Read all media files
    const mediaFiles = await fs.readdir(mediaPath)

    for (const file of mediaFiles) {
      const filePath = path.join(mediaPath, file)
      const fileData = await fs.readFile(filePath)

      // Determine MIME type
      const ext = path.extname(file).toLowerCase()
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
      }

      // No need for hex conversion - MongoDB Binary handles binary data natively
      await db.insertMedia(cacheId, `media/${file}`, fileData, mimeTypes[ext] || 'application/octet-stream')
    }

    // Clean up temp media directory
    await fs.rm(mediaPath, { recursive: true, force: true })
  } catch {
    // Media storage failed - non-critical error
  }
}

interface MathEquation {
  latex: string
  isDisplay: boolean
  placeholder?: string
}

// Pre-process DOCX to replace math equations with placeholders
async function preprocessDocxWithMathPlaceholders(fileBuffer: Buffer): Promise<{
  buffer: Buffer
  mathMap: Map<string, MathEquation>
}> {
  const mathMap = new Map<string, MathEquation>()

  try {
    // Load the DOCX file as a ZIP
    const zip = await JSZip.loadAsync(fileBuffer)
    const documentXml = await zip.file('word/document.xml')?.async('string')

    if (!documentXml) {
      return { buffer: fileBuffer, mathMap }
    }

    // Parse the XML
    const parser = new DOMParser()
    const doc = parser.parseFromString(documentXml, 'text/xml')

    const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    const mathNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/math'

    let equationCounter = 0

    // Process all math elements and replace with placeholders
    // First handle display equations (oMathPara)
    const oMathParas = doc.getElementsByTagNameNS(mathNamespace, 'oMathPara')
    for (let i = oMathParas.length - 1; i >= 0; i--) {
      const oMathPara = oMathParas[i]
      const oMath = oMathPara.getElementsByTagNameNS(mathNamespace, 'oMath')[0]

      if (oMath) {
        try {
          // Convert OMML to LaTeX
          const mathmlElement = omml2mathml(oMath)
          const mathmlString = mathmlElement.outerHTML
          const latexString = MathMLToLaTeX.convert(mathmlString)

          // Create placeholder
          const placeholder = `[[MATH_DISPLAY_${equationCounter++}]]`

          // Store in map
          mathMap.set(placeholder, {
            latex: latexString,
            isDisplay: true,
            placeholder
          })

          // Create a text run with the placeholder
          const textRun = doc.createElementNS(wordNamespace, 'w:r')
          const text = doc.createElementNS(wordNamespace, 'w:t')
          text.textContent = placeholder
          textRun.appendChild(text)

          // Replace the oMathPara with a paragraph containing our placeholder
          const para = doc.createElementNS(wordNamespace, 'w:p')
          para.appendChild(textRun)

          oMathPara.parentNode?.replaceChild(para, oMathPara)
        } catch {
          // Continue processing other equations
        }
      }
    }

    // Then handle inline equations (oMath not in oMathPara)
    const allMath = doc.getElementsByTagNameNS(mathNamespace, 'oMath')
    for (let i = allMath.length - 1; i >= 0; i--) {
      const oMath = allMath[i]

      // Skip if inside oMathPara (already processed)
      if (oMath.parentNode && (oMath.parentNode as Element).localName === 'oMathPara') {
        continue
      }

      try {
        // Convert OMML to LaTeX
        const mathmlElement = omml2mathml(oMath)
        const mathmlString = mathmlElement.outerHTML
        const latexString = MathMLToLaTeX.convert(mathmlString)

        // Create placeholder
        const placeholder = `[[MATH_INLINE_${equationCounter++}]]`

        // Store in map
        mathMap.set(placeholder, {
          latex: latexString,
          isDisplay: false,
          placeholder
        })

        // Create a text run with the placeholder
        const textRun = doc.createElementNS(wordNamespace, 'w:r')
        const text = doc.createElementNS(wordNamespace, 'w:t')
        text.textContent = placeholder
        textRun.appendChild(text)

        // Replace the oMath with our text run
        oMath.parentNode?.replaceChild(textRun, oMath)
      } catch {
        // Continue processing other equations
      }
    }

    // Serialize the modified XML
    const serializer = new XMLSerializer()
    const modifiedXml = serializer.serializeToString(doc)

    // Update the ZIP with modified document.xml
    zip.file('word/document.xml', modifiedXml)

    // Generate the modified DOCX buffer
    const modifiedBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    return { buffer: modifiedBuffer, mathMap }
  } catch {
    return { buffer: fileBuffer, mathMap }
  }
}

// Convert DOCX to HTML using Mammoth.js with math equation support
async function convertDocxToHtmlWithMammoth(fileBuffer: Buffer, cacheKey: string): Promise<ConversionResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docx-convert-'))
  const mediaDir = path.join(tempDir, 'media')
  await fs.mkdir(mediaDir)

  let hasMedia = false
  const mediaFiles: { [key: string]: Buffer } = {}

  // Pre-process DOCX to inject math placeholders
  const { buffer: processedBuffer, mathMap } = await preprocessDocxWithMathPlaceholders(fileBuffer)

  const imageConverter = (image: MammothImage) => {
    return image.read().then((imageBuffer: Buffer) => {
      hasMedia = true
      const extension = image.contentType.split('/')[1] || 'png'
      const filename = `image${Object.keys(mediaFiles).length + 1}.${extension}`
      const imagePath = path.join(mediaDir, filename)

      mediaFiles[filename] = imageBuffer
      fs.writeFile(imagePath, imageBuffer)

      // Return relative path for the media endpoint
      return {
        src: `media/${filename}`,
      }
    })
  }

  // Transform document to remove unwanted elements (replicates Lua filter)
  const transformDocument = (element: MammothElement): MammothElement | null => {
    // Add a guard clause for safety
    if (!element) {
      return element
    }

    // Remove HorizontalRule (--- in markdown)
    if (element.type === 'horizontal-rule') {
      return null // Returning null removes the element
    }

    // Remove paragraphs that only contain a single link (TOC entries)
    if (element.type === 'paragraph' && element.children) {
      // Check if paragraph has exactly one child that is a hyperlink
      if (element.children.length === 1) {
        const child = element.children[0]
        // Check for hyperlink type
        if (child && 'type' in child && child.type === 'hyperlink') {
          return null
        }
      }
    }

    // Recursively process children
    if (element.children) {
      element.children = element.children
        .map((child: MammothElement) => transformDocument(child))
        .filter((child): child is MammothElement => child !== null)
    }

    return element
  }

  // Keep track of title text during conversion
  let documentTitle: string | null = null

  // First convert with basic options to extract title
  const extractTitleOptions: MammothOptions = {
    styleMap: [
      // Map Title style to a special marker we can find
      "p[style-name='Title'] => p.mammoth-document-title > :fresh",
    ]
  }

  // Do a preliminary conversion to extract the title
  const preliminaryResult = await mammoth.convertToHtml({ buffer: fileBuffer }, extractTitleOptions)
  const $preliminary = load(preliminaryResult.value)

  // Try to find title with the mapped class
  const titleElement = $preliminary('p.mammoth-document-title').first()
  if (titleElement.length > 0) {
    documentTitle = titleElement.text().trim()
  } else {
    // Fallback: The first paragraph before "Obsah" is likely the title
    const firstPara = $preliminary('p').first()
    if (firstPara.length > 0) {
      const firstParaText = firstPara.text().trim()
      // Check if it's not a TOC entry (doesn't start with a number and dot)
      if (firstParaText && !firstParaText.match(/^\d+\s*[\.\)]\s*/) && firstParaText !== 'Obsah') {
        documentTitle = firstParaText
      }
    }
  }

  // Enhanced transform function that also removes TOC entries
  const enhancedTransformDocument = (element: MammothElement): MammothElement | null => {
    // Apply the original transform logic
    return transformDocument(element);
  }

  const mammothOptions: MammothOptions = {
    convertImage: mammoth.images.inline(imageConverter),
    transformDocument: enhancedTransformDocument,
    styleMap: [
      // Remove Title style paragraphs from body
      "p[style-name='Title'] => !",
      // Ignore TOC styles
      "p[style-name='toc 1'] => !",
      "p[style-name='toc 2'] => !",
      "p[style-name='toc 3'] => !",
      "p[style-name='TOC Heading'] => !",
    ]
  }

  // Convert the DOCX buffer to HTML
  const result = await mammoth.convertToHtml({ buffer: processedBuffer }, mammothOptions)
  let bodyHtml = result.value

  // Replace math placeholders with actual equations
  if (mathMap.size > 0) {
    // Simple string replacement for each placeholder
    mathMap.forEach((equation, placeholder) => {
      const mathHtml = equation.isDisplay
        ? `<span class="math display">\\[${equation.latex}\\]</span>`
        : `<span class="math inline">\\(${equation.latex}\\)</span>`

      // Replace all occurrences of the placeholder
      bodyHtml = bodyHtml.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), mathHtml)
    })
  }

  // Post-process HTML with Cheerio for TOC generation and title extraction
  const $ = load(bodyHtml)

  // Use the title extracted from the Word document
  const title: string | null = documentTitle

  // If we found a title, remove it from the body HTML
  if (title) {
    // Remove the first paragraph if it matches our title
    const firstPara = $('p').first()
    if (firstPara.length > 0 && firstPara.text().trim() === title) {
      firstPara.remove()
    }
  }

  const tocEntries: { level: number; text: string; id: string }[] = []

  $('h1, h2, h3').each((_, el) => {
    const element = $(el)
    const text = element.text()
    if (!text) return // Skip empty headings

    const level = parseInt(el.tagName.substring(1), 10)
    const id = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
    element.attr('id', id)

    tocEntries.push({ level, text, id })
  })

  const buildTocHtml = (entries: typeof tocEntries) => {
    if (entries.length === 0) return ''
    let html = '<ul>'
    // Start level should be the minimum level found, not hardcoded to 1
    let lastLevel = Math.min(...entries.map(e => e.level))
    html += `<li><a href="#${entries[0].id}">${entries[0].text}</a></li>`

    for (let i = 1; i < entries.length; i++) {
      const entry = entries[i]
      if (entry.level > lastLevel) {
        html += '<ul>'.repeat(entry.level - lastLevel)
      } else if (entry.level < lastLevel) {
        html += '</ul>'.repeat(lastLevel - entry.level)
      }
      html += `<li><a href="#${entry.id}">${entry.text}</a></li>`
      lastLevel = entry.level
    }

    const minLevel = Math.min(...entries.map(e => e.level))
    html += '</ul>'.repeat(lastLevel - minLevel + 1)
    return html
  }

  const tocHtml = buildTocHtml(tocEntries)

  // Apply the custom template
  const templatePath = path.join(process.cwd(), 'lib/utils/study-note-template.html')
  let finalHtml = await fs.readFile(templatePath, 'utf-8')

  // Handle TOC conditional
  if (tocHtml) {
    // Replace the TOC placeholder and remove the conditional markers
    finalHtml = finalHtml.replace('$toc$', tocHtml)
    // Remove $if(toc)$ and corresponding $endif$ when TOC exists
    finalHtml = finalHtml.replace(/\$if\(toc\)\$([\s\S]*?)\$endif\$/g, '$1')
  } else {
    // Remove the entire TOC section when no TOC
    finalHtml = finalHtml.replace(/\$if\(toc\)\$([\s\S]*?)\$endif\$/g, '')
  }

  // Handle title conditional
  if (title) {
    // Replace the title placeholder and remove the conditional markers
    finalHtml = finalHtml.replace('$title$', title)
    // Remove $if(title)$ and corresponding $endif$ when title exists
    finalHtml = finalHtml.replace(/\$if\(title\)\$([\s\S]*?)\$endif\$/g, '$1')
  } else {
    // Remove the entire title section when no title
    finalHtml = finalHtml.replace(/\$if\(title\)\$([\s\S]*?)\$endif\$/g, '')
  }

  // Inject the main content
  finalHtml = finalHtml.replace('$body$', $.html())

  // Clean up any remaining unreplaced placeholders
  finalHtml = finalHtml.replace(/\$[a-zA-Z]+\$/g, '')

  return {
    html: finalHtml,
    mediaPath: hasMedia ? mediaDir : null,
    cacheKey,
    title,
  }
}
