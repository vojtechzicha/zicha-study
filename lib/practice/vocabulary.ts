// The content vocabulary of practice pages: the classes, CSS variables and colours that the
// page generators emit and app/practice-content.css styles. The sanitizer keeps nothing else,
// so uploaded HTML can't pull in arbitrary Tailwind classes or light-only colours.

// Every class the generators' stylesheets define (DMO, OBDA incl. page-specific tables, EPM),
// plus the series classes that replace DMO's palette colours.
export const PRACTICE_SERIES_CLASSES = ["ser1", "ser2", "ser3", "ser4", "ser5", "ser6", "ser7", "ser8"] as const

export const PRACTICE_CLASSES: ReadonlySet<string> = new Set([
  "abc", "ans", "arc", "art", "bad", "box", "c", "calc", "card", "dash", "dim", "edge", "err", "exam",
  "faint", "gap", "given", "good", "graph", "grid", "hl", "hot", "hx", "k1", "k2", "k3", "k4", "k5", "k6",
  "k7", "kc", "kring", "lab", "layer", "lead", "legend", "lifo", "lt", "meta", "mono", "mx", "new", "nl",
  "node", "non", "num", "pa", "pb", "pf", "res", "result", "rm", "row", "sb", "scroll", "sel", "start",
  "state", "step", "stepbody", "sw", "t", "task", "tbl", "tree", "u", "wl", "wt", "x",
  ...PRACTICE_SERIES_CLASSES,
])

// Generator CSS variables → scoped names. The generators' --card/--muted/--accent would clash
// with the shadcn tokens, so every one gets a --pc- prefix (app/practice-content.css defines them).
export const PRACTICE_CSS_VARIABLES: ReadonlySet<string> = new Set([
  "bg", "card", "ink", "muted", "line", "accent", "hl", "new", "newink", "x", "bad", "good",
  "node", "nodeline", "art", "artline", "pa", "pb",
])

export function scopedCssVariable(name: string): string {
  return `--pc-${name}`
}

// DMO's PALETTE (common.py), in order: colour → series class. These are the only literal colours
// accepted; the series classes carry light and dark variants.
export const PRACTICE_PALETTE: ReadonlyMap<string, string> = new Map(
  ["#2f6fdf", "#d9480f", "#2b8a3e", "#9c36b5", "#c2255c", "#0b7285", "#e67700", "#5c7cfa"].map((hex, i) => [
    hex,
    PRACTICE_SERIES_CLASSES[i],
  ])
)
