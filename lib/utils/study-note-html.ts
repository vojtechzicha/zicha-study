import fs from 'fs/promises'
import path from 'path'
import type { CheerioAPI } from 'cheerio'

// Shared post-processing for study note HTML (Word/Mammoth and Obsidian/Markdown
// converters): heading anchors + TOC generation and the Pandoc-style template.

export interface TocEntry {
  level: number
  text: string
  id: string
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Assign slugified ids to h1–h3 headings in place and return the nested TOC HTML.
export function addHeadingIdsAndBuildToc($: CheerioAPI): string {
  const tocEntries: TocEntry[] = []

  $('h1, h2, h3').each((_, el) => {
    const element = $(el)
    const text = element.text()
    if (!text) return

    const level = parseInt(el.tagName.substring(1), 10)
    const id = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
    element.attr('id', id)

    tocEntries.push({ level, text, id })
  })

  return buildTocHtml(tocEntries)
}

function buildTocHtml(entries: TocEntry[]): string {
  if (entries.length === 0) return ''
  let html = '<ul>'
  // Nest relative to the shallowest heading, which need not be h1
  let lastLevel = Math.min(...entries.map(e => e.level))
  html += `<li><a href="#${entries[0].id}">${escapeHtml(entries[0].text)}</a></li>`

  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i]
    if (entry.level > lastLevel) {
      html += '<ul>'.repeat(entry.level - lastLevel)
    } else if (entry.level < lastLevel) {
      html += '</ul>'.repeat(lastLevel - entry.level)
    }
    html += `<li><a href="#${entry.id}">${escapeHtml(entry.text)}</a></li>`
    lastLevel = entry.level
  }

  const minLevel = Math.min(...entries.map(e => e.level))
  html += '</ul>'.repeat(lastLevel - minLevel + 1)
  return html
}

// Apply lib/utils/study-note-template.html with $toc$/$title$/$body$ placeholders
// and $if(toc)$/$if(title)$ conditionals.
export async function applyStudyNoteTemplate(options: {
  bodyHtml: string
  tocHtml: string
  title: string | null
}): Promise<string> {
  const { bodyHtml, tocHtml, title } = options

  const templatePath = path.join(process.cwd(), 'lib/utils/study-note-template.html')
  let finalHtml = await fs.readFile(templatePath, 'utf-8')

  // Function replacers throughout: string replacements would interpret "$&"
  // and similar patterns inside the injected content.

  if (tocHtml) {
    finalHtml = finalHtml.replace('$toc$', () => tocHtml)
    finalHtml = finalHtml.replace(/\$if\(toc\)\$([\s\S]*?)\$endif\$/g, '$1')
  } else {
    finalHtml = finalHtml.replace(/\$if\(toc\)\$([\s\S]*?)\$endif\$/g, '')
  }

  if (title) {
    finalHtml = finalHtml.replace('$title$', () => escapeHtml(title))
    finalHtml = finalHtml.replace(/\$if\(title\)\$([\s\S]*?)\$endif\$/g, '$1')
  } else {
    finalHtml = finalHtml.replace(/\$if\(title\)\$([\s\S]*?)\$endif\$/g, '')
  }

  // Strip leftover placeholders BEFORE injecting the body, so literal "$word$"
  // text inside the note content is preserved.
  finalHtml = finalHtml.replace(/\$(?!body\$)[a-zA-Z]+\$/g, '')

  finalHtml = finalHtml.replace('$body$', () => bodyHtml)

  return finalHtml
}
