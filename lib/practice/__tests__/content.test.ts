import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { parsePracticePageHtml } from "../parse-html"
import { PracticeContentError, prepareModuleContent, preparePageContent } from "../content"

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, "../__fixtures__", name), "utf-8")
const graph = () => parsePracticePageHtml(fixture("graph-page.html")).content

function errorsOf(fn: () => unknown): string[] {
  try {
    fn()
  } catch (err) {
    if (err instanceof PracticeContentError) return err.errors
    throw err
  }
  return []
}

describe("preparePageContent", () => {
  it("sanitizes every fragment and derives missing keys", () => {
    const { content, warnings } = preparePageContent(graph())
    expect(content.examples.map((ex) => ex.key)).toEqual(["trojuhelnik", "cesta-bez-klice"])
    const first = content.examples[0]
    expect(first.task_html).toContain('class="edge tree ser1"')
    expect(first.task_html).not.toContain("stroke=")
    expect(first.steps[0].body_html).toContain('class="sw ser1"')
    expect(content.examples[1].steps[0].body_html).toContain("var(--pc-bad)")
    // grid-template-columns isn't on the allowlist; reported, not fatal
    expect(warnings.some((w) => w.includes("grid-template-columns"))).toBe(true)
    expect(warnings.some((w) => w.includes("no data-key"))).toBe(true)
  })

  it("requires a data-key on every example in strict mode", () => {
    expect(errorsOf(() => preparePageContent(graph(), { strict: true }))[0]).toContain("no data-key")
  })

  it("rejects duplicate and invalid data-keys", () => {
    const page = graph()
    page.examples[1].key = "trojuhelnik"
    expect(errorsOf(() => preparePageContent(page))).toContain("Duplicate data-key „trojuhelnik“.")
    page.examples[1].key = "Bad Key"
    expect(errorsOf(() => preparePageContent(page))[0]).toContain("examples.1.key")
  })

  it("keeps derived keys clear of given ones", () => {
    const page = graph()
    page.examples[0].key = "cesta-bez-klice"
    expect(preparePageContent(page).content.examples.map((ex) => ex.key)).toEqual(["cesta-bez-klice", "cesta-bez-klice-2"])
  })

  it("re-prepares content whose derived keys were deduplicated at the length limit", () => {
    const page = graph()
    const title = `${"a".repeat(78)} b c`
    page.examples[0].key = undefined
    page.examples[0].title = title
    page.examples[1].title = title
    const first = preparePageContent(page)
    expect(first.content.examples.map((ex) => ex.key.length)).toEqual([80, 80])
    expect(preparePageContent(first.content).contentHash).toBe(first.contentHash)
  })

  it("hashes content deterministically, and re-preparing sanitized content changes nothing", () => {
    const first = preparePageContent(graph())
    const again = preparePageContent(first.content)
    expect(again.contentHash).toBe(first.contentHash)
    expect(again.content).toEqual(first.content)
    const changed = graph()
    changed.lead_html = "Jiný úvod."
    expect(preparePageContent(changed).contentHash).not.toBe(first.contentHash)
  })

  it("fails on light-only colours and links to other files", () => {
    const page = graph()
    page.examples[0].result_html = '<span style="background:#ffffff">x</span><a href="index.html">zpět</a>'
    expect(errorsOf(() => preparePageContent(page))).toHaveLength(2)
  })

  it("validates the shape", () => {
    expect(errorsOf(() => preparePageContent({ title: "x" })).length).toBeGreaterThan(0)
    expect(errorsOf(() => preparePageContent({ ...graph(), extra: 1 })).length).toBeGreaterThan(0)
  })
})

describe("prepareModuleContent", () => {
  it("sanitizes module HTML the same way", () => {
    const { content } = prepareModuleContent({
      intro_html: '<p onclick="x">Úvod</p>',
      closing_blocks: [{ kind: "note", title: null, html: '<p class="meta">Pracovní listy zatím nejsou.</p>' }],
    })
    expect(content.intro_html).toBe("<p>Úvod</p>")
    expect(content.closing_blocks?.[0].html).toBe('<p class="meta">Pracovní listy zatím nejsou.</p>')
    expect(content.intro_blocks).toBeUndefined()
  })

  it("rejects obsidian links in module HTML", () => {
    expect(errorsOf(() => prepareModuleContent({ intro_html: '<a href="obsidian://open?vault=x">Zápis</a>' }))).toHaveLength(1)
  })
})
