import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { OneDriveTokenManager } from '@/lib/utils/onedrive-token-manager'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import os from 'os'
import mammoth from 'mammoth'
import { load } from 'cheerio'
import JSZip from 'jszip'
import { DOMParser } from 'xmldom'
import omml2mathml from 'omml2mathml'
import MathMLToLaTeX from 'mathml-to-latex'

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

interface MathEquation {
  latex: string
  isDisplay: boolean
  context?: string
}

// Extract and convert OMML equations to LaTeX with context
async function extractAndConvertMathEquations(fileBuffer: Buffer): Promise<MathEquation[]> {
  const mathEquations: MathEquation[] = []
  
  try {
    // Load the DOCX file as a ZIP
    const zip = await JSZip.loadAsync(fileBuffer)
    const documentXml = await zip.file('word/document.xml')?.async('string')
    
    if (!documentXml) {
      console.log('No document.xml found in DOCX file')
      return mathEquations
    }
    
    // Parse the XML
    const parser = new DOMParser()
    const doc = parser.parseFromString(documentXml, 'text/xml')
    
    // Find all paragraphs to understand document structure
    const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    const mathNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
    
    const paragraphs = doc.getElementsByTagNameNS(wordNamespace, 'p')
    
    // Process each paragraph to find math equations in context
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i]
      
      // Check for display math (oMathPara)
      const oMathParas = para.getElementsByTagNameNS(mathNamespace, 'oMathPara')
      if (oMathParas.length > 0) {
        for (let j = 0; j < oMathParas.length; j++) {
          const oMathPara = oMathParas[j]
          const oMath = oMathPara.getElementsByTagNameNS(mathNamespace, 'oMath')[0]
          
          if (oMath) {
            try {
              // Convert OMML to MathML
              const mathmlResult = omml2mathml(oMath)
              // Convert MathML to LaTeX
              const latexString = MathMLToLaTeX.convert(mathmlResult)
              
              // Get surrounding text for context
              const prevPara = i > 0 ? paragraphs[i - 1] : null
              const contextText = prevPara ? prevPara.textContent?.trim() || '' : ''
              
              mathEquations.push({
                latex: latexString,
                isDisplay: true,
                context: contextText
              })
              
              console.log(`Extracted display equation: ${latexString.substring(0, 50)}...`)
            } catch (err) {
              console.error(`Error converting display equation:`, err)
            }
          }
        }
      }
      
      // Check for inline math (oMath not in oMathPara)
      const directMath = para.getElementsByTagNameNS(mathNamespace, 'oMath')
      for (let j = 0; j < directMath.length; j++) {
        const oMath = directMath[j]
        // Skip if this oMath is inside an oMathPara (already processed)
        if (oMath.parentNode && oMath.parentNode.localName === 'oMathPara') {
          continue
        }
        
        try {
          // Convert OMML to MathML
          const mathmlResult = omml2mathml(oMath)
          // Convert MathML to LaTeX
          const latexString = MathMLToLaTeX.convert(mathmlResult)
          
          // Get paragraph text for context
          const contextText = para.textContent?.trim() || ''
          
          mathEquations.push({
            latex: latexString,
            isDisplay: false,
            context: contextText
          })
          
          console.log(`Extracted inline equation: ${latexString.substring(0, 50)}...`)
        } catch (err) {
          console.error(`Error converting inline equation:`, err)
        }
      }
    }
    
    console.log(`Total equations extracted: ${mathEquations.length}`)
  } catch (error) {
    console.error('Error extracting OMML equations:', error)
  }
  
  return mathEquations
}

// Convert DOCX to HTML using Mammoth.js
async function convertDocxToHtmlWithMammoth(fileBuffer: Buffer, cacheKey: string): Promise<ConversionResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docx-convert-'))
  const mediaDir = path.join(tempDir, 'media')
  await fs.mkdir(mediaDir)

  let hasMedia = false
  const mediaFiles: { [key: string]: Buffer } = {}
  
  // Extract math equations first
  const mathEquations = await extractAndConvertMathEquations(fileBuffer)
  let mathCounter = 0

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

  // Transform document to remove unwanted elements (replicates Lua filter)
  const transformDocument = (element: mammoth.documents.Element): mammoth.documents.Element | null => {
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
        .map(child => transformDocument(child as mammoth.documents.Element))
        .filter(child => child !== null) as mammoth.documents.Element[]
    }

    return element
  }

  // Keep track of title text during conversion
  let documentTitle: string | null = null
  
  // First convert with basic options to extract title
  const extractTitleOptions: mammoth.Options = {
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
  const enhancedTransformDocument = (element: mammoth.documents.Element): mammoth.documents.Element | null => {
    // Apply the original transform logic
    return transformDocument(element);
  }
  
  const mammothOptions: mammoth.Options = {
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
  const result = await mammoth.convertToHtml({ buffer: fileBuffer }, mammothOptions)
  const bodyHtml = result.value
  
  // Check if Mammoth extracted any messages or metadata
  if (result.messages && result.messages.length > 0) {
    // Log warnings about math elements
    const mathWarnings = result.messages.filter(m => 
      m.message.includes('oMath') || m.message.includes('oMathPara')
    )
    if (mathWarnings.length > 0) {
      console.log(`Note: Found ${mathWarnings.length} math equations to process`)
    }
  }
  
  // Since Mammoth doesn't preserve math equations, we need to inject them
  // We'll add them as spans with class "math" for KaTeX to render
  let processedHtml = result.value
  
  // If we have math equations, inject them into the HTML
  if (mathEquations.length > 0) {
    const $ = load(processedHtml)
    
    // Strategy: Match equations based on context and paragraph structure
    const paragraphs = $('p')
    let equationIndex = 0
    const usedEquations = new Set<number>()
    
    // First pass: Try to match based on context
    paragraphs.each((i, elem) => {
      const $elem = $(elem)
      const text = $elem.text().trim()
      
      // Look for equations that might belong to this paragraph
      for (let j = 0; j < mathEquations.length; j++) {
        if (usedEquations.has(j)) continue
        
        const equation = mathEquations[j]
        
        // For inline equations, check if the context matches
        if (!equation.isDisplay && equation.context) {
          // Check if this paragraph contains similar text to the equation's context
          if (text.includes(equation.context.substring(0, 20)) || 
              equation.context.includes(text.substring(0, 20))) {
            // Found a likely match - inject the inline equation
            const mathSpan = `<span class="math inline">\\(${equation.latex}\\)</span>`
            
            // Try to find where in the paragraph to insert it
            // For now, append it to the end
            $elem.append(' ' + mathSpan)
            usedEquations.add(j)
            break
          }
        }
      }
    })
    
    // Second pass: Place display equations in empty or sparse paragraphs
    equationIndex = 0
    paragraphs.each((i, elem) => {
      const $elem = $(elem)
      const text = $elem.text().trim()
      
      // Check if this paragraph might have contained a display equation
      if (text === '' || text.match(/^[\s\.,;:]*$/) || text.length < 5) {
        // Find next unused display equation
        for (let j = 0; j < mathEquations.length; j++) {
          if (usedEquations.has(j)) continue
          
          const equation = mathEquations[j]
          if (equation.isDisplay) {
            // Replace the content with the math equation
            $elem.html(`<span class="math display">\\[${equation.latex}\\]</span>`)
            usedEquations.add(j)
            break
          }
        }
      }
    })
    
    // Third pass: Insert remaining display equations after paragraphs that mention "equation" or numbers
    paragraphs.each((i, elem) => {
      const $elem = $(elem)
      const text = $elem.text().toLowerCase()
      
      // Check if this paragraph references an equation
      if (text.includes('equation') || text.match(/\(\d+\)/) || text.includes('formula')) {
        // Find next unused equation
        for (let j = 0; j < mathEquations.length; j++) {
          if (usedEquations.has(j)) continue
          
          const equation = mathEquations[j]
          // Insert the equation after this paragraph
          const mathHtml = equation.isDisplay 
            ? `<p><span class="math display">\\[${equation.latex}\\]</span></p>`
            : `<span class="math inline">\\(${equation.latex}\\)</span>`
          
          $elem.after(mathHtml)
          usedEquations.add(j)
          break
        }
      }
    })
    
    // Handle remaining equations
    const remainingEquations = mathEquations
      .map((eq, idx) => ({ eq, idx }))
      .filter(({ idx }) => !usedEquations.has(idx))
      .map(({ eq }) => eq)
    
    if (remainingEquations.length > 0) {
      console.log(`Warning: ${remainingEquations.length} equations could not be placed accurately`)
      
      // Group remaining equations by type
      const remainingDisplay = remainingEquations.filter(eq => eq.isDisplay)
      const remainingInline = remainingEquations.filter(eq => !eq.isDisplay)
      
      if (remainingDisplay.length > 0 || remainingInline.length > 0) {
        let noteHtml = '<div class="math-equations-note" style="margin-top: 2em; padding: 1em; background: #f5f5f5; border-left: 3px solid #ccc;">'
        noteHtml += '<p><em>Poznámka: Následující matematické výrazy byly extrahovány z dokumentu:</em></p>'
        
        if (remainingInline.length > 0) {
          noteHtml += '<p>Inline výrazy: '
          noteHtml += remainingInline
            .map(eq => `<span class="math inline">\\(${eq.latex}\\)</span>`)
            .join(', ')
          noteHtml += '</p>'
        }
        
        if (remainingDisplay.length > 0) {
          noteHtml += remainingDisplay
            .map(eq => `<p><span class="math display">\\[${eq.latex}\\]</span></p>`)
            .join('\n')
        }
        
        noteHtml += '</div>'
        
        // Append to the body of the document
        const body = $('body')
        if (body.length > 0) {
          body.append(noteHtml)
        } else {
          // If no body tag, append to root
          $.root().append(noteHtml)
        }
      }
    }
    
    processedHtml = $.html()
  }

  // Post-process HTML with Cheerio for TOC generation and title extraction
  const $ = load(processedHtml || bodyHtml)

  // Use the title extracted from the Word document
  let title: string | null = documentTitle
  
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
