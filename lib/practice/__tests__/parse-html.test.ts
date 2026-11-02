import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { parsePracticePageHtml } from "../parse-html"

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, "../__fixtures__", name), "utf-8")

describe("parsePracticePageHtml", () => {
  const graph = parsePracticePageHtml(fixture("graph-page.html"))

  it("reads the slug from the practice-slug meta", () => {
    expect(graph.errors).toEqual([])
    expect(graph.slug).toBe("cesty_grafem")
  })

  it("keeps title, lead and the intro cards, but not the nav", () => {
    expect(graph.content.title).toBe("Cesty grafem")
    expect(graph.content.lead_html).toBe("Nejdřív postup <b>zkus sám</b>, pak odkrývej kroky.")
    expect(graph.content.intro_blocks).toHaveLength(1)
    expect(graph.content.intro_blocks[0]).toMatchObject({ kind: "legend", title: "Zápis" })
    expect(graph.content.intro_blocks[0].html).toContain('<div class="legend">')
  })

  it("parses examples with key, title, source, nav meta, task, steps and result", () => {
    const [first, second] = graph.content.examples
    expect(first).toMatchObject({ key: "trojuhelnik", n: 1, title: "Trojúhelník", source: "Vymyšlený příklad pro test.", nav_meta: "3 vrcholy, 3 hrany" })
    expect(first.task_html.startsWith("<p><b>Zadání:</b> Najdi tah z a.</p>")).toBe(true)
    expect(first.task_html).toContain("<details>")
    expect(first.task_html).toContain('viewBox="0 0 100 60"')
    expect(first.task_html).not.toContain("controls")
    expect(first.steps).toHaveLength(2)
    expect(first.steps[0].title).toBe("Krok 1")
    expect(first.steps[0].events_html).toEqual(["Začnu v <b>a</b>.", "Vložím a do LIFO."])
    expect(first.steps[0].body_html).toContain('class="lifo"')
    expect(first.result_html).toBe('<dl class="res"><dt>tah</dt><dd>a – b – c – a</dd></dl>')
    expect(second.key).toBeUndefined()
    expect(second.nav_meta).toBeNull()
  })

  it("keeps the closing verification note as the footer", () => {
    expect(graph.content.footer_html).toBe("Výsledky jsou ověřené <i>druhým postupem</i>.")
  })

  it("parses the calc layout with an exam card and drops inline <style>", () => {
    const calc = parsePracticePageHtml(fixture("calc-page.html"), { urlSlug: "urok" })
    expect(calc.errors).toEqual([])
    expect(calc.slug).toBe("urok")
    expect(calc.content.intro_blocks.map((b) => [b.kind, b.title])).toEqual([
      ["exam", "U zkoušky (podle vyučujících)"],
      ["legend", "Zápis a vzorce"],
    ])
    expect(calc.content.examples[0].steps[0].body_html).toBe('<div class="calc">u = 1 000 · 0,05\nu = 50</div>')
    expect(JSON.stringify(calc.content)).not.toContain("<style")
    expect(calc.content.footer_html).toBe("Ověřeno kalkulačkou.")
  })

  it("rejects an upload address that contradicts the page's slug", () => {
    const result = parsePracticePageHtml(fixture("graph-page.html"), { urlSlug: "jina" })
    expect(result.errors[0]).toContain("doesn't match")
  })

  it("falls back to the title for the slug", () => {
    expect(parsePracticePageHtml(fixture("calc-page.html")).slug).toBe("vypocet-uroku")
  })

  it("reports a page without examples", () => {
    expect(parsePracticePageHtml("<main><h1>Prázdná</h1></main>").errors).toContain("The page has no examples (section.example).")
  })
})

describe("parsePracticePageHtml – tutorials", () => {
  const parsed = parsePracticePageHtml(fixture("tutorial-page.html"))
  const [plain, animated, legend] = parsed.content.intro_blocks

  it("keeps tutorial cards in order before the other intro cards", () => {
    expect(parsed.errors).toEqual([])
    expect(parsed.content.intro_blocks.map((b) => [b.kind, b.title])).toEqual([
      ["tutorial", "1. Jak funguje průchod"],
      ["tutorial", "2. Ukázka krok za krokem"],
      ["legend", "Zápis"],
    ])
    expect(plain.html).toContain("<details>")
    expect(plain.frames).toBeUndefined()
    expect(plain.after_html).toBeUndefined()
    expect(legend.frames).toBeUndefined()
  })

  it("splits an animated card into html, frames and after_html", () => {
    expect(animated.html).toBe(
      '<p>Úvod.</p><p class="meta"><svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" class="node pa"></circle></svg> navštívený</p>'
    )
    expect(animated.after_html).toBe("<p>Po animaci.</p>")
    expect(animated.frames).toHaveLength(2)
    const [first, second] = animated.frames!
    expect(first).toMatchObject({ title: "Výchozí stav", events_html: ["Začnu v <b>a</b>."], why_html: "Proč tady." })
    expect(first.body_html.startsWith('<svg viewBox="0 0 100 60" class="graph">')).toBe(true)
    expect(first.body_html).toContain('<dl class="state">')
    expect(second.why_html).toBeNull()
    expect(second.events_html).toHaveLength(2)
    expect(second.body_html).toContain('stroke-dasharray="4 2"')
    expect(parsed.warnings).toEqual(["Tutorial „2. Ukázka krok za krokem“: ignored 1 element(s) in .anim that aren't .frame."])
  })

  it("rejects a nested or repeated .anim", () => {
    const html = fixture("tutorial-page.html")
    const nested = html.replace('<div class="anim">', '<div><div class="anim">').replace("<p>Po animaci.</p>", "</div><p>Po animaci.</p>")
    expect(parsePracticePageHtml(nested).errors[0]).toContain("direct child")
    const twice = html.replace("<p>Po animaci.</p>", '<div class="anim"><div class="frame"><h4>x</h4></div></div>')
    expect(parsePracticePageHtml(twice).errors[0]).toContain("only one .anim")
  })
})
