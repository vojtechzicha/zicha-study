import { marked } from "marked"

// Heuristic: does this plain text look like Markdown worth parsing? Used to
// decide whether a paste of text/plain should be converted instead of inserted
// verbatim. Intentionally conservative for block-level constructs.
export function looksLikeMarkdown(text: string): boolean {
  const patterns = [
    /^#{1,6}\s+\S/m, // headings
    /^\s*[-*+]\s+\S/m, // bullet list
    /^\s*\d+\.\s+\S/m, // ordered list
    /^\s*>\s+\S/m, // blockquote
    /```/, // fenced code
    /\*\*[^*\n]+\*\*/, // bold
    /(^|\n)\|.*\|.*\|/, // table row
    /\[[^\]]+\]\([^)\s]+\)/, // link
    /\$\$?[^$\n]+\$\$?/, // math
  ]
  return patterns.some((p) => p.test(text))
}

// Replace inline ($…$) and block ($$…$$) math delimiters inside text nodes with
// the markup the TipTap math nodes parse (data-type/data-latex). Skips code/pre.
function convertMathInTextNodes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const targets: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    const t = node as Text
    if (!t.nodeValue || !t.nodeValue.includes("$")) continue
    if (t.parentElement?.closest("code, pre")) continue
    targets.push(t)
  }

  const re = /\$\$([^$\n]+?)\$\$|(?<!\$)\$([^$\n]+?)\$(?!\$)/g
  for (const t of targets) {
    const text = t.nodeValue || ""
    re.lastIndex = 0
    const out: Node[] = []
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(document.createTextNode(text.slice(last, m.index)))
      if (m[1] !== undefined) {
        const el = document.createElement("div")
        el.setAttribute("data-type", "block-math")
        el.setAttribute("data-latex", m[1].trim())
        out.push(el)
      } else {
        const el = document.createElement("span")
        el.setAttribute("data-type", "inline-math")
        el.setAttribute("data-latex", (m[2] ?? "").trim())
        out.push(el)
      }
      last = re.lastIndex
    }
    if (out.length === 0) continue
    if (last < text.length) out.push(document.createTextNode(text.slice(last)))
    t.replaceWith(...out)
  }
}

// Convert a Markdown string into HTML the TipTap schema understands, including
// math nodes. Safe to feed to editor.commands.insertContent().
export function markdownToEditorHtml(markdown: string): string {
  const html = marked.parse(markdown, { gfm: true, breaks: false }) as string
  const doc = new DOMParser().parseFromString(html, "text/html")
  convertMathInTextNodes(doc.body)
  return doc.body.innerHTML
}
