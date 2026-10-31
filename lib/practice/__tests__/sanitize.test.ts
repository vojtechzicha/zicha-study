import { describe, it, expect } from "vitest"
import { sanitizeFragment } from "../sanitize"

describe("sanitizeFragment", () => {
  it("keeps the generators' markup", () => {
    const html =
      '<div class="scroll"><table class="tbl c mono"><tbody><tr><td class="hl">1</td><td>x<sub>i</sub></td></tr></tbody></table></div>' +
      '<details><summary>Graf</summary><svg viewBox="0 0 10 10" class="graph" role="img" aria-label="Graf"><line x1="1" y1="1" x2="9" y2="9" class="edge" stroke-width="3" stroke-dasharray="6 4"></line></svg></details>'
    const result = sanitizeFragment(html)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.html).toBe(html)
  })

  it("removes scripts, event handlers and forms", () => {
    const result = sanitizeFragment('<p onclick="x()">a</p><script>alert(1)</script><form><input></form><iframe src="https://x"></iframe>')
    expect(result.html).toBe("<p>a</p>")
    expect(result.warnings.some((w) => w.includes("<form>"))).toBe(true)
  })

  it("allows only #anchors and https links, checked after decoding", () => {
    expect(sanitizeFragment('<a href="#p3">x</a>').html).toBe('<a href="#p3">x</a>')
    expect(sanitizeFragment('<a href="https://zicha.study">x</a>').errors).toEqual([])
    for (const href of ["javascript:alert(1)", "java%73cript:alert(1)", "jav\tascript:x", "data:text/html,x", "obsidian://open"]) {
      const result = sanitizeFragment(`<a href="${href}">x</a>`)
      expect(result.errors.length, href).toBe(1)
      expect(result.html, href).toBe("<a>x</a>")
    }
    expect(sanitizeFragment('<a href="Jiná stránka.html#p2">x</a>').errors[0]).toContain("another file")
  })

  it("keeps known classes and reports unknown ones", () => {
    const result = sanitizeFragment('<span class="kc k7 text-red-500 bg-white">3</span>')
    expect(result.html).toBe('<span class="kc k7">3</span>')
    expect(result.warnings).toHaveLength(2)
  })

  it("maps palette colours to series classes", () => {
    const line = sanitizeFragment('<svg viewBox="0 0 1 1"><line class="edge" stroke="#2F6FDF"></line></svg>')
    expect(line.html).toBe('<svg viewBox="0 0 1 1"><line class="edge ser1"></line></svg>')
    const swatch = sanitizeFragment('<span class="sw" style="background:#c2255c"></span>')
    expect(swatch.html).toBe('<span class="sw ser5"></span>')
  })

  it("keeps stroke and fill none", () => {
    const result = sanitizeFragment('<svg viewBox="0 0 1 1"><polygon points="0,0 1,1" fill="none" class="edge"></polygon><line stroke="none"></line></svg>')
    expect(result.errors).toEqual([])
    expect(result.html).toBe('<svg viewBox="0 0 1 1"><polygon points="0,0 1,1" fill="none" class="edge"></polygon><line stroke="none"></line></svg>')
  })

  it("rejects other literal colours", () => {
    expect(sanitizeFragment('<line stroke="#123456"></line>').errors).toHaveLength(1)
    expect(sanitizeFragment('<span style="background:#ffffff">x</span>').errors).toHaveLength(1)
    expect(sanitizeFragment('<span style="border-left:4px solid rgb(0,0,0)">x</span>').errors).toHaveLength(1)
    expect(sanitizeFragment('<circle fill="red"></circle>').errors).toHaveLength(1)
  })

  it("scopes CSS variables and rejects unknown ones", () => {
    const ok = sanitizeFragment('<p style="border-left:4px solid var(--bad);margin:6px 0 12px">x</p>')
    expect(ok.html).toBe('<p style="border-left:4px solid var(--pc-bad);margin:6px 0 12px">x</p>')
    expect(sanitizeFragment('<p style="background:var(--primary)">x</p>').errors).toHaveLength(1)
  })

  it("keeps the layout styles the generators use", () => {
    const html =
      '<span style="grid-row:1;grid-column:2/5">a</span>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0 16px;align-items:flex-start">b</div>' +
      '<span style="min-width:1.4em;padding:0 3px;border-radius:4px;font-weight:600">c</span>' +
      '<small style="font-size:.85rem">d</small>'
    const result = sanitizeFragment(html)
    expect(result.warnings).toEqual([])
    expect(result.html).toBe(html)
  })

  it("drops other style properties and values with a warning", () => {
    const result = sanitizeFragment('<div style="position:fixed;display:flex;gap:calc(100% - 1px)">x</div>')
    expect(result.html).toBe('<div style="display:flex">x</div>')
    expect(result.warnings).toHaveLength(2)
    expect(sanitizeFragment('<div style="background:url(https://x/y.png)">x</div>').html).toBe("<div>x</div>")
  })

  it("keeps viewBox casing and fixes a lower-cased one", () => {
    expect(sanitizeFragment('<svg viewbox="0 0 4 4"></svg>').html).toBe('<svg viewBox="0 0 4 4"></svg>')
  })

  it("keeps only pN ids", () => {
    expect(sanitizeFragment('<div id="p3">a</div><div id="evil">b</div>').html).toBe('<div id="p3">a</div><div>b</div>')
  })

  it("keeps whitespace in calculation blocks", () => {
    const html = '<div class="calc">a = 1\n  b = 2</div>'
    expect(sanitizeFragment(html).html).toBe(html)
  })

  it("is idempotent", () => {
    const once = sanitizeFragment('<svg viewBox="0 0 1 1"><line stroke="#2f6fdf" class="edge"></line></svg><p style="border-left:4px solid var(--bad)">a &amp; b</p>').html
    expect(sanitizeFragment(once).html).toBe(once)
  })
})
