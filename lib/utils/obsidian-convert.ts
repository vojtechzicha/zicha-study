import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { marked } from 'marked'
import { load } from 'cheerio'
import { findFileByPath, downloadFromOneDrive } from '@/lib/utils/onedrive-cache'
import { addHeadingIdsAndBuildToc, applyStudyNoteTemplate } from '@/lib/utils/study-note-html'

// Converts an Obsidian vault Markdown file (fetched from OneDrive) into the same
// HTML shape the Word/Mammoth pipeline produces, so the existing cache, media
// storage/serving, and client viewer (KaTeX + TOC) work unchanged.
//
// Obsidian-specific handling: YAML frontmatter (stripped, title: used), image
// embeds ![[file.png]] (resolved from the vault via Microsoft Graph), callouts
// > [!type], and wikilinks [[Note|alias]] (degraded to plain text).

export interface ObsidianConvertOptions {
  cacheKey: string
  // OneDrive parent path of the note (note.parent_path), used to resolve
  // relative image references inside the vault.
  parentPath: string | null
  fallbackTitle: string
}

export interface ObsidianConversionResult {
  html: string
  mediaPath: string | null
  cacheKey: string
  title: string | null
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'avif'])
const MAX_IMAGES_PER_NOTE = 50

interface MediaContext {
  mediaDir: string
  count: number
  // Resolved vault target → local media path (or null when resolution failed),
  // so the same image referenced twice is only downloaded once.
  resolved: Map<string, string | null>
  parentPath: string | null
}

export async function convertObsidianToHtml(
  fileBuffer: Buffer,
  options: ObsidianConvertOptions
): Promise<ObsidianConversionResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'obsidian-convert-'))
  const mediaDir = path.join(tempDir, 'media')
  await fs.mkdir(mediaDir)

  const media: MediaContext = {
    mediaDir,
    count: 0,
    resolved: new Map(),
    parentPath: options.parentPath,
  }

  // 1. Normalize: UTF-8, strip BOM, CRLF → LF (Obsidian on Windows writes CRLF)
  let text = fileBuffer.toString('utf-8').replace(/^﻿/, '').replace(/\r\n/g, '\n')

  // 2. Frontmatter: strip the YAML block, keep its title: if present
  let title: string | null = null
  const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/)
  if (frontmatterMatch) {
    const titleMatch = frontmatterMatch[1].match(/^title:\s*["']?(.+?)["']?\s*$/m)
    if (titleMatch) {
      title = titleMatch[1].trim()
    }
    text = text.slice(frontmatterMatch[0].length)
  }

  // Leading H1 acts as the document title (and is removed from the body so it
  // doesn't duplicate the template's $title$ heading)
  const leadingH1Match = text.match(/^\s*#[ \t]+([^\n]+?)[ \t]*#*[ \t]*(?:\n|$)/)
  if (leadingH1Match && (!title || leadingH1Match[1].trim() === title)) {
    title = title || leadingH1Match[1].trim()
    text = text.slice(leadingH1Match[0].length)
  }
  if (!title) {
    title = options.fallbackTitle || null
  }

  // 3. Protect code (fenced blocks + inline spans) so $math$ and [[...]] inside
  // code are never transformed. Tokens are plain alphanumeric words that pass
  // through the regex transforms untouched; restored before marked runs.
  const codeSnippets: string[] = []
  text = text.replace(/```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)/g, (m) => {
    codeSnippets.push(m)
    return `OBSCODE${codeSnippets.length - 1}X`
  })
  text = text.replace(/``[^`]*``|`[^`\n]*`/g, (m) => {
    codeSnippets.push(m)
    return `OBSCODE${codeSnippets.length - 1}X`
  })

  // 4. Protect math: $$...$$ (display) first, then single-line $...$ (inline,
  // non-whitespace-adjacent so "$5 and $10" is left alone). Raw LaTeX is kept
  // out of marked's escaping and restored into the final HTML (step 9).
  const mathSnippets: { latex: string; display: boolean }[] = []
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, latex: string) => {
    mathSnippets.push({ latex: latex.trim(), display: true })
    return `OBSMATH${mathSnippets.length - 1}X`
  })
  text = text.replace(
    /(?<![\w$\\])\$([^\s$](?:[^$\n]*[^\s$])?)\$(?![\w$])/g,
    (_m, latex: string) => {
      mathSnippets.push({ latex, display: false })
      return `OBSMATH${mathSnippets.length - 1}X`
    }
  )

  // 5. Obsidian image embeds ![[file.png]] / ![[file.png|300]] — resolve from
  // the vault and emit <img> pointing at the local media dir (marked passes raw
  // HTML through). Non-image embeds and failures degrade to plain text.
  const embedRegex = /!\[\[([^\][|]+?)(?:\|([^\][]*))?\]\]/g
  const embeds = [...text.matchAll(embedRegex)]
  const embedReplacements = new Map<string, string>()
  for (const match of embeds) {
    const [full, rawTarget, rawAlias] = match
    if (embedReplacements.has(full)) continue
    const target = rawTarget.trim()
    const alias = rawAlias?.trim()
    const extension = target.split('.').pop()?.toLowerCase() ?? ''
    if (!IMAGE_EXTENSIONS.has(extension)) {
      embedReplacements.set(full, target)
      continue
    }
    const mediaSrc = await resolveVaultImage(media, target)
    if (!mediaSrc) {
      embedReplacements.set(full, alias || target)
      continue
    }
    const altText = escapeHtmlAttribute(path.basename(target, path.extname(target)))
    const width = alias && /^\d+$/.test(alias) ? ` width="${alias}"` : ''
    embedReplacements.set(full, `<img src="${mediaSrc}" alt="${altText}"${width}>`)
  }
  text = text.replace(embedRegex, (full) => embedReplacements.get(full) ?? full)

  // 6. Wikilinks [[Note]], [[Note#heading|alias]] → plain text (alias or target)
  text = text.replace(
    /\[\[([^\][|#]+)(?:#[^\][|]*)?(?:\|([^\][]*))?\]\]/g,
    (_m, target: string, alias?: string) => (alias?.trim() || target.trim())
  )

  // 7. Restore code and convert markdown → HTML (same marked call as the
  // in-app markdown paste import)
  text = text.replace(/OBSCODE(\d+)X/g, (m, index: string) => codeSnippets[Number(index)] ?? m)
  const bodyHtml = marked.parse(text, { gfm: true, breaks: false }) as string

  // 8. Cheerio post-pass: relative images, callouts, heading ids + TOC
  const $ = load(bodyHtml)

  // Standard-markdown relative images ![alt](attachments/img.png) — resolve
  // from the vault like the wiki embeds; on failure fall back to the alt text
  const relativeImages = $('img[src]').toArray().filter((el) => {
    const src = $(el).attr('src') ?? ''
    return !/^(?:https?:|data:|\/\/|media\/)/i.test(src)
  })
  for (const el of relativeImages) {
    const image = $(el)
    let target = image.attr('src') ?? ''
    try {
      target = decodeURIComponent(target)
    } catch {
      // Keep the raw value if it isn't valid percent-encoding
    }
    const mediaSrc = await resolveVaultImage(media, target)
    if (mediaSrc) {
      image.attr('src', mediaSrc)
    } else {
      image.replaceWith(escapeHtmlText(image.attr('alt') || target))
    }
  }

  // Callouts: blockquotes whose first paragraph starts with [!type]
  $('blockquote').each((_, el) => {
    const blockquote = $(el)
    const firstParagraph = blockquote.children('p').first()
    if (!firstParagraph.length) return

    const paragraphHtml = firstParagraph.html() ?? ''
    const calloutMatch = paragraphHtml.match(/^\[!([a-zA-Z]+)\][+-]?[ \t]*([^\n]*)(?:\n([\s\S]*))?$/)
    if (!calloutMatch) return

    const type = calloutMatch[1].toLowerCase()
    const titleHtml = calloutMatch[2].trim() || capitalize(calloutMatch[1])
    const restHtml = (calloutMatch[3] ?? '').trim()

    if (restHtml) {
      firstParagraph.html(restHtml)
    } else {
      firstParagraph.remove()
    }

    const contentHtml = blockquote.html() ?? ''
    blockquote.replaceWith(
      `<div class="callout callout-${type}"><p class="callout-title">${titleHtml}</p><div class="callout-content">${contentHtml}</div></div>`
    )
  })

  const tocHtml = addHeadingIdsAndBuildToc($)

  // 9. Restore math as the same spans the Word pipeline emits — the client
  // viewer renders span.math inline/display via KaTeX
  let processedHtml = $.html()
  mathSnippets.forEach((equation, index) => {
    const mathHtml = equation.display
      ? `<span class="math display">\\[${escapeHtmlText(equation.latex)}\\]</span>`
      : `<span class="math inline">\\(${escapeHtmlText(equation.latex)}\\)</span>`
    processedHtml = processedHtml.replace(new RegExp(`OBSMATH${index}X`, 'g'), () => mathHtml)
  })

  // 10. Apply the shared study note template
  const finalHtml = await applyStudyNoteTemplate({
    bodyHtml: processedHtml,
    tocHtml,
    title,
  })

  return {
    html: finalHtml,
    mediaPath: media.count > 0 ? mediaDir : null,
    cacheKey: options.cacheKey,
    title,
  }
}

// Resolve a vault-relative image reference via Microsoft Graph and download it
// into the temp media dir under a sanitized sequential name (imageN.ext), so
// Czech diacritics/spaces in vault filenames never reach media URLs.
async function resolveVaultImage(media: MediaContext, target: string): Promise<string | null> {
  const cleanTarget = target.trim().replace(/^\.\//, '')
  if (!cleanTarget) return null

  if (media.resolved.has(cleanTarget)) {
    return media.resolved.get(cleanTarget) ?? null
  }
  if (media.count >= MAX_IMAGES_PER_NOTE) {
    return null
  }

  let mediaSrc: string | null = null
  try {
    let item = await findFileByPath(media.parentPath, cleanTarget)
    if (!item && cleanTarget !== cleanTarget.normalize('NFC')) {
      // macOS OneDrive clients can store NFD-decomposed diacritics
      item = await findFileByPath(media.parentPath, cleanTarget.normalize('NFC'))
    }
    if (item) {
      const download = await downloadFromOneDrive(item.id)
      if (download) {
        const extension = cleanTarget.split('.').pop()?.toLowerCase() || 'png'
        const filename = `image${media.count + 1}.${extension}`
        await fs.writeFile(path.join(media.mediaDir, filename), Buffer.from(download.buffer))
        media.count += 1
        mediaSrc = `media/${filename}`
      }
    }
  } catch {
    // Missing/unreachable image must never fail the whole conversion
  }

  media.resolved.set(cleanTarget, mediaSrc)
  return mediaSrc
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/"/g, '&quot;')
}
