import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { OneDriveTokenManager } from '@/lib/utils/onedrive-token-manager'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import os from 'os'
import mammoth from 'mammoth'
import { load } from 'cheerio'

interface ConversionResult {
  html: string
  mediaPath: string | null
  cacheKey: string
  title: string | null
}

interface CacheData {
  html_content: string
  title: string | null
  onedrive_last_modified: string
  generated_at: string
  cache_key: string
  has_media: boolean
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const { searchParams } = new URL(request.url)
  const forceRegenerate = searchParams.get('flush') === '1'

  try {
    const supabase = await createServerClient()

    // Get the study note by public slug
    const { data: note, error } = await supabase.from('study_notes').select('*').eq('public_slug', slug).eq('is_public', true).single()

    if (error || !note) {
      return NextResponse.json({ error: 'Study note not found' }, { status: 404 })
    }

    // Check if we have a cached version
    const { data: cachedData } = await supabase.from('study_notes_cache').select('*').eq('study_note_id', note.id).single()

    let onedriveLastModified: Date | null = null
    let onedriveAccessible = true
    let fileBuffer: ArrayBuffer | null = null

    // Try to access OneDrive to check for updates
    try {
      const tokenResult = await OneDriveTokenManager.getValidToken()

      if (!tokenResult.token) {
        console.error('No OneDrive token available:', tokenResult.error)
        onedriveAccessible = false
      } else {
        // Get file metadata using direct API with the file's OneDrive ID
        const metadataResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${note.onedrive_id}`, {
          headers: { Authorization: `Bearer ${tokenResult.token}` },
        })

        if (metadataResponse.ok) {
          const fileData = await metadataResponse.json()
          onedriveLastModified = new Date(fileData.lastModifiedDateTime)
          console.log('OneDrive file last modified:', fileData.lastModifiedDateTime)

          // Download the file content
          const downloadResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${note.onedrive_id}/content`, {
            headers: { Authorization: `Bearer ${tokenResult.token}` },
          })

          if (downloadResponse.ok) {
            fileBuffer = await downloadResponse.arrayBuffer()
          } else {
            console.error('Failed to download file content:', downloadResponse.status)
          }
        } else {
          console.error('Failed to get file metadata:', metadataResponse.status)
        }
      }
    } catch (error) {
      console.error('OneDrive access error:', error)
      onedriveAccessible = false
    }

    // Determine if we should use cache or regenerate
    const shouldRegenerate =
      forceRegenerate ||
      !cachedData ||
      (onedriveAccessible && fileBuffer && onedriveLastModified && new Date(cachedData.onedrive_last_modified) < onedriveLastModified)

    if (!shouldRegenerate && cachedData) {
      // Use cached version
      console.log('Using cached version for:', slug)

      return NextResponse.json({
        html: cachedData.html_content,
        title: cachedData.title,
        cacheKey: cachedData.cache_key,
        mediaPath: cachedData.has_media ? `media-${cachedData.cache_key}` : null,
        cached: true,
        onedriveLastModified: cachedData.onedrive_last_modified,
        generatedAt: cachedData.generated_at,
        onedriveAccessible,
      })
    }

    // Need to regenerate
    if (!fileBuffer) {
      if (cachedData) {
        // OneDrive not accessible but we have cache
        return NextResponse.json({
          html: cachedData.html_content,
          title: cachedData.title,
          cacheKey: cachedData.cache_key,
          mediaPath: cachedData.has_media ? `media-${cachedData.cache_key}` : null,
          cached: true,
          onedriveLastModified: cachedData.onedrive_last_modified,
          generatedAt: cachedData.generated_at,
          onedriveAccessible: false,
        })
      }

      return NextResponse.json({ error: 'Unable to access file and no cache available' }, { status: 500 })
    }

    // Generate new cache key including generation time for cache busting
    const cacheKey = crypto
      .createHash('md5')
      .update(`${note.id}-${onedriveLastModified?.toISOString() || 'unknown'}-${Date.now()}`)
      .digest('hex')

    // Convert the document
    const result = await convertDocxToHtmlWithMammoth(Buffer.from(fileBuffer), cacheKey)

    // Store in database
    if (cachedData) {
      // Update existing cache
      await supabase
        .from('study_notes_cache')
        .update({
          html_content: result.html,
          title: result.title,
          onedrive_last_modified: onedriveLastModified || cachedData.onedrive_last_modified,
          generated_at: new Date(),
          cache_key: cacheKey,
          has_media: !!result.mediaPath,
        })
        .eq('study_note_id', note.id)
    } else {
      // Insert new cache - only insert if we have a valid last modified date
      if (!onedriveLastModified) {
        throw new Error('Unable to determine file modification date from OneDrive')
      }

      await supabase.from('study_notes_cache').insert({
        study_note_id: note.id,
        html_content: result.html,
        title: result.title,
        onedrive_last_modified: onedriveLastModified,
        cache_key: cacheKey,
        has_media: !!result.mediaPath,
      })
    }

    // Store media files if any
    if (result.mediaPath) {
      await storeMediaInDatabase(note.id, result.mediaPath)
      await fs.rm(path.dirname(result.mediaPath), { recursive: true, force: true })
    }

    return NextResponse.json({
      ...result,
      cached: false,
      onedriveLastModified: onedriveLastModified?.toISOString(),
      generatedAt: new Date().toISOString(),
      onedriveAccessible,
    })
  } catch (error) {
    console.error('Conversion error:', error)

    // Try to return cached version if available
    try {
      const supabase = await createServerClient()

      // Get the study note again to ensure we have the ID
      const { data: noteForCache } = await supabase.from('study_notes').select('id').eq('public_slug', slug).eq('is_public', true).single()

      if (noteForCache) {
        const { data: cachedData } = await supabase.from('study_notes_cache').select('*').eq('study_note_id', noteForCache.id).single()

        if (cachedData) {
          return NextResponse.json({
            html: cachedData.html_content,
            title: cachedData.title,
            cacheKey: cachedData.cache_key,
            mediaPath: cachedData.has_media ? `media-${cachedData.cache_key}` : null,
            cached: true,
            onedriveLastModified: cachedData.onedrive_last_modified,
            generatedAt: cachedData.generated_at,
            onedriveAccessible: false,
            error: 'Fell back to cache due to error',
          })
        }
      }
    } catch (cacheError) {
      console.error('Cache fallback error:', cacheError)
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : 'Conversion failed' }, { status: 500 })
  }
}

async function storeMediaInDatabase(noteId: string, mediaPath: string) {
  try {
    const supabase = await createServerClient()

    // Get cache record
    const { data: cacheRecord } = await supabase.from('study_notes_cache').select('id').eq('study_note_id', noteId).single()

    if (!cacheRecord) return

    // Delete old media files
    await supabase.from('study_notes_media').delete().eq('cache_id', cacheRecord.id)

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

      // Convert to hex string for PostgreSQL BYTEA
      // Supabase expects hex string with \x prefix for BYTEA columns
      const hexString = `\\x${fileData.toString('hex')}`

      await supabase.from('study_notes_media').insert({
        cache_id: cacheRecord.id,
        file_path: `media/${file}`,
        file_data: hexString,
        mime_type: mimeTypes[ext] || 'application/octet-stream',
      })
    }

    // Clean up temp media directory
    await fs.rm(mediaPath, { recursive: true, force: true })
  } catch (error) {
    console.error('Error storing media in database:', error)
  }
}

// Convert DOCX to HTML using Mammoth.js
async function convertDocxToHtmlWithMammoth(fileBuffer: Buffer, cacheKey: string): Promise<ConversionResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docx-convert-'))
  const mediaDir = path.join(tempDir, 'media')
  await fs.mkdir(mediaDir)

  let hasMedia = false
  const mediaFiles: { [key: string]: Buffer } = {}

  const imageConverter = (image: mammoth.images.Image) => {
    return image.read().then(imageBuffer => {
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

  // Transform document to remove unwanted elements
  const transformDocument = (element: mammoth.documents.Element) => {
    // Add a guard clause for safety
    if (!element) {
      return element
    }

    // Remove HorizontalRule (--- in markdown)
    if (element.type === 'horizontal_rule') {
      return null // Returning null removes the element
    }

    // Remove paragraphs that only contain a single link
    if (element.type === 'paragraph') {
      const hasSingleChildLink = element.children && element.children.length === 1 && element.children[0].type === 'hyperlink'

      if (hasSingleChildLink) {
        return null
      }
    }

    return element
  }

  const mammothOptions: mammoth.Options = {
    convertImage: mammoth.images.inline(imageConverter),
    transformDocument: transformDocument,
  }

  // Convert the DOCX buffer to HTML
  const { value: bodyHtml } = await mammoth.convertToHtml({ buffer: fileBuffer }, mammothOptions)

  // Post-process HTML with Cheerio for TOC generation and title extraction
  const $ = load(bodyHtml)

  // Remove existing TOC from the document
  // Look for common TOC patterns: sections with "obsah", "table of contents", etc.
  $('h1, h2, h3').each((_, heading) => {
    const headingText = $(heading).text().toLowerCase().trim()
    if (headingText === 'obsah' || headingText === 'table of contents' || headingText === 'toc') {
      // Find the next elements until we hit another heading
      let currentElement = $(heading).next()
      while (currentElement.length && !currentElement.is('h1, h2, h3')) {
        const nextElement = currentElement.next()
        currentElement.remove()
        currentElement = nextElement
      }
      // Remove the TOC heading itself
      $(heading).remove()
    }
  })

  const tocEntries: { level: number; text: string; id: string }[] = []
  let title: string | null = null

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

    if (level === 1 && !title) {
      title = text
      // We'll remove this title from the body and use the template's title
      element.remove()
    }
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

  if (tocHtml) {
    finalHtml = finalHtml.replace('$toc$', tocHtml)
    // Make the `$if(toc)$` conditional work
    finalHtml = finalHtml.replace(/\$if\(toc\)\$/g, '').replace(/\$endif\$/g, '')
  } else {
    finalHtml = finalHtml.replace(/\$if\(toc\)\$([\s\S]*?)\$endif\$/g, '')
  }

  if (title) {
    finalHtml = finalHtml.replace('$title$', title)
    finalHtml = finalHtml.replace(/\$if\(title\)\$/g, '').replace(/\$endif\$/g, '')
  } else {
    finalHtml = finalHtml.replace(/\$if\(title\)\$([\s\S]*?)\$endif\$/g, '')
  }

  // Inject the main content and clean up any remaining placeholders
  finalHtml = finalHtml.replace('$body$', $.html())
  finalHtml = finalHtml.replace(/\$[a-zA-Z]+\$/g, '')

  return {
    html: finalHtml,
    mediaPath: hasMedia ? mediaDir : null,
    cacheKey,
    title,
  }
}
