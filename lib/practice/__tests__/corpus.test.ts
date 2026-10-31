import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { parsePracticePageHtml } from "../parse-html"
import { preparePageContent, PracticeContentError } from "../content"

// Opt-in check against real generator output, which stays out of the repo (practice content is
// private). Run with:
//   PRACTICE_CORPUS_DIRS="/path/DMO/Procvičování:/path/OBDA/Procvičování" pnpm test:run corpus
const dirs = (process.env.PRACTICE_CORPUS_DIRS || "").split(":").filter(Boolean)

function pages(dir: string) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .map((f) => path.join(dir, f))
}

function count(html: string, pattern: RegExp) {
  return (html.match(pattern) || []).length
}

describe.skipIf(dirs.length === 0)("practice corpus", () => {
  for (const dir of dirs) {
    for (const file of pages(dir)) {
      it(`imports ${path.basename(dir.replace(/\/Procvičování$/, ""))} / ${path.basename(file)}`, () => {
        const html = fs.readFileSync(file, "utf-8")
        const parsed = parsePracticePageHtml(html)
        expect(parsed.errors).toEqual([])

        let prepared
        try {
          prepared = preparePageContent(parsed.content, { strict: true })
        } catch (err) {
          if (err instanceof PracticeContentError) throw new Error(err.errors.slice(0, 10).join("\n"))
          throw err
        }
        const { content, warnings } = prepared

        // Nothing with content is lost: examples, steps, nav meta, intro cards, footer.
        expect(content.examples.length).toBe(count(html, /<section class="card example"/g))
        expect(content.examples.reduce((n, ex) => n + ex.steps.length, 0)).toBe(count(html, /<div class="step"/g))
        expect(content.examples.filter((ex) => ex.nav_meta).length).toBe(count(html, /<li><a href="#p\d+">[^<]*<\/a> <span class="meta">/g))
        expect(content.intro_blocks.length).toBe(count(html, /<div class="card( exam)?"><h3>/g))
        expect(content.footer_html).toBeTruthy()
        expect(parsed.slug).toMatch(/^[a-z0-9_-]{2,50}$/)
        // SVG drawings keep their viewBox (case-sensitive) and lose literal colours.
        const all = JSON.stringify(content)
        expect(count(all, /viewBox=/g)).toBe(count(html, /viewBox=/g))
        expect(all).not.toMatch(/stroke=\\"#|background:#/)
        // Inline styles survive (except palette swatches, which become series classes).
        const body = html.slice(html.indexOf("<body"))
        const swatches = count(body, / style="background:#[0-9a-f]{3,6}"/gi)
        expect(count(all, / style=\\"/g)).toBe(count(body, / style="/g) - swatches)
        expect(count(all, /ser\d/g)).toBeGreaterThanOrEqual(swatches)
        if (warnings.length > 0) console.warn(path.basename(file), warnings.slice(0, 5))
      })
    }
  }
})
