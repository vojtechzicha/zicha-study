import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { PRACTICE_CLASSES, PRACTICE_CSS_VARIABLES, PRACTICE_SERIES_CLASSES, PRACTICE_SHELL_CLASSES } from "../vocabulary"

// app/practice-content.css and the sanitizer's vocabulary must agree: a class the stylesheet
// styles but the sanitizer strips would silently lose its look, and an inline var(--x) the
// sanitizer rewrites to --pc-x must be defined in both themes.
const css = fs.readFileSync(path.join(__dirname, "../../../app/practice-content.css"), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "")
// Selector lists of every rule, with @media wrappers removed
const selectorLists = [...css.replace(/@media[^{]*\{/g, "").matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim())

describe("practice-content.css", () => {
  it("only styles classes the sanitizer keeps (or the app shell renders)", () => {
    const styled = new Set(selectorLists.flatMap((list) => [...list.matchAll(/\.([a-z][a-z0-9_-]*)/gi)].map((m) => m[1])))
    styled.delete("practice-content")
    styled.delete("dark")
    expect([...styled].filter((name) => !PRACTICE_CLASSES.has(name) && !PRACTICE_SHELL_CLASSES.has(name))).toEqual([])
  })

  it("defines every scoped variable in light and dark", () => {
    const light = css.match(/(^|\n)\.practice-content \{([^}]*)\}/)?.[2] ?? ""
    const dark = css.match(/\.dark \.practice-content \{([^}]*)\}/)?.[1] ?? ""
    for (const name of PRACTICE_CSS_VARIABLES) expect(light, name).toContain(`--pc-${name}:`)
    for (const series of PRACTICE_SERIES_CLASSES) {
      expect(light).toContain(`--pc-${series}:`)
      expect(dark).toContain(`--pc-${series}:`)
    }
    // Neutrals follow the app tokens and need no dark override; the tints do.
    for (const name of ["new", "newink", "x", "node", "nodeline", "art", "artline", "bad", "good", "pa", "pb"]) {
      expect(dark, name).toContain(`--pc-${name}:`)
    }
  })

  it("uses generator variables only in their scoped form", () => {
    // hsl(var(--card)) etc. are the app tokens the --pc-* neutrals map to
    const bare = css.match(/(?<!hsl\()var\(--(?!pc-)(?:bg|card|ink|muted|line|accent|hl|new|newink|bad|good|x|node|nodeline|art|artline|pa|pb)\)/g)
    expect(bare).toBeNull()
  })

  it("scopes every rule", () => {
    expect(selectorLists.length).toBeGreaterThan(100)
    for (const list of selectorLists) {
      for (const part of list.split(",")) {
        expect(part.trim(), part).toMatch(/^(\.dark )?\.practice-content\b/)
      }
    }
  })
})
