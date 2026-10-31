import sanitizeHtml from "sanitize-html"
import { PRACTICE_CLASSES, PRACTICE_CSS_VARIABLES, PRACTICE_PALETTE, scopedCssVariable } from "./vocabulary"

// Every HTML fragment of a practice module or page passes through sanitizeFragment() before it is
// stored (see lib/practice/content.ts). The allowlist covers what the generators emit: tables,
// definition lists, inline SVG graphs, <details>, and inline styles for grid/flex layouts.
//
// Problems come back in two lists: `errors` make the upload fail (light-only colours, unknown CSS
// variables, links to other files), `warnings` are reported but don't block (an unknown class or
// tag that was removed).

export interface SanitizeIssues {
  errors: string[]
  warnings: string[]
}

export interface SanitizeResult extends SanitizeIssues {
  html: string
}

const SVG_TAGS = ["svg", "g", "line", "circle", "rect", "ellipse", "path", "polygon", "polyline", "text", "tspan", "title"]

const ALLOWED_TAGS = [
  "table", "thead", "tbody", "tr", "th", "td",
  "span", "div", "p", "b", "i", "u", "s", "small", "code", "sub", "sup", "br",
  "ol", "ul", "li", "dl", "dt", "dd", "h2", "h3", "h4", "a", "details", "summary",
  ...SVG_TAGS,
]
const ALLOWED_TAG_SET = new Set(ALLOWED_TAGS)

// Removed with their content; not reported (the parser strips them on purpose).
const SILENT_TAGS = new Set(["script", "style"])

const COMMON_ATTRIBUTES = ["class", "id", "style", "role", "aria-label"]

const SVG_ATTRIBUTES = [
  "viewBox", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height",
  "text-anchor", "stroke-width", "stroke-dasharray", "points", "d",
]

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  "*": COMMON_ATTRIBUTES,
  a: [...COMMON_ATTRIBUTES, "href"],
  th: [...COMMON_ATTRIBUTES, "colspan", "rowspan"],
  td: [...COMMON_ATTRIBUTES, "colspan", "rowspan"],
  details: [...COMMON_ATTRIBUTES, "open"],
  ...Object.fromEntries(SVG_TAGS.map((tag) => [tag, [...COMMON_ATTRIBUTES, ...SVG_ATTRIBUTES]])),
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const LEN = String.raw`(?:0|-?\d*\.?\d+(?:px|em|rem|%|ch))`
const LENS = (n: number, extra = "") => new RegExp(`^(?:${LEN}|${extra || "(?!)"})(?:\\s+(?:${LEN}|${extra || "(?!)"})){0,${n - 1}}$`)
const GRID_LINE = String.raw`(?:auto|-?\d+|span\s+\d+)`
const COLOUR_TOKEN = String.raw`(?:var\(--pc-[a-z0-9]+\)|transparent)`

const STYLE_VALUES: Record<string, RegExp> = {
  "grid-row": new RegExp(`^${GRID_LINE}(?:\\s*/\\s*${GRID_LINE})?$`),
  "grid-column": new RegExp(`^${GRID_LINE}(?:\\s*/\\s*${GRID_LINE})?$`),
  display: /^(?:flex|inline-flex|grid|inline-grid|block|inline-block|inline|none)$/,
  "flex-wrap": /^(?:wrap|nowrap)$/,
  gap: LENS(2),
  "align-items": /^(?:flex-start|flex-end|center|baseline|stretch|start|end)$/,
  "min-width": LENS(1, "auto"),
  padding: LENS(4),
  margin: LENS(4, "auto"),
  "border-radius": LENS(4),
  "font-weight": /^(?:normal|bold|[1-9]00)$/,
  "font-size": LENS(1),
  background: new RegExp(`^${COLOUR_TOKEN}$`),
  "border-left": new RegExp(`^${LEN}\\s+(?:solid|dashed|dotted)\\s+${COLOUR_TOKEN}$`),
}

const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i

// Rewrites var(--name) to the scoped var(--pc-name); unknown variables are errors.
function scopeVariables(value: string, issues: SanitizeIssues, where: string): string {
  return value.replace(/var\(\s*--([a-z0-9-]+)\s*\)/gi, (match, name: string) => {
    const lower = name.toLowerCase()
    if (lower.startsWith("pc-")) return `var(--${lower})`
    if (!PRACTICE_CSS_VARIABLES.has(lower)) {
      issues.errors.push(`${where}: unknown CSS variable --${name}.`)
      return match
    }
    return `var(${scopedCssVariable(lower)})`
  })
}

// Returns the cleaned style string and any series class that replaces a palette background.
function cleanStyle(style: string, issues: SanitizeIssues, where: string): { style: string; seriesClass: string | null } {
  let seriesClass: string | null = null
  const kept: string[] = []
  for (const declaration of style.split(";")) {
    const colon = declaration.indexOf(":")
    if (colon < 0) continue
    const property = declaration.slice(0, colon).trim().toLowerCase()
    let value = declaration.slice(colon + 1).trim().replace(/\s+/g, " ")
    if (!property || !value) continue

    const validator = STYLE_VALUES[property]
    if (!validator) {
      issues.warnings.push(`${where}: removed style property „${property}“.`)
      continue
    }
    if (property === "background" && PRACTICE_PALETTE.has(value.toLowerCase())) {
      seriesClass = PRACTICE_PALETTE.get(value.toLowerCase())!
      continue
    }
    if (LITERAL_COLOUR.test(value)) {
      issues.errors.push(`${where}: literal colour in „${property}: ${value}“ (use a class or a theme variable).`)
      continue
    }
    value = scopeVariables(value, issues, where)
    if (!validator.test(value)) {
      issues.warnings.push(`${where}: removed style „${property}: ${value}“.`)
      continue
    }
    kept.push(`${property}:${value}`)
  }
  return { style: kept.join(";"), seriesClass }
}

// ─── Links ────────────────────────────────────────────────────────────────────

// In-page anchors and https links only. The value is decoded first so encoded schemes
// (java%73cript:) can't slip past the check.
function cleanHref(href: string, issues: SanitizeIssues, where: string): string | null {
  let decoded = href
  try {
    decoded = decodeURIComponent(href)
  } catch {
    issues.errors.push(`${where}: malformed link „${href}“.`)
    return null
  }
  const compact = decoded.replace(/[\u0000- \u007f]+/g, "").toLowerCase()
  if (compact.startsWith("#")) return href
  if (compact.startsWith("https://")) return href
  if (/^[a-z][a-z0-9+.-]*:/.test(compact)) {
    issues.errors.push(`${where}: link scheme not allowed („${href}“).`)
  } else {
    issues.errors.push(`${where}: link to another file („${href}“); only #anchors and https links are allowed.`)
  }
  return null
}

// ─── Fragment ─────────────────────────────────────────────────────────────────

export function sanitizeFragment(html: string, where = "HTML"): SanitizeResult {
  const issues: SanitizeIssues = { errors: [], warnings: [] }

  const transform = (tagName: string, attribs: Record<string, string>) => {
    const tag = tagName.toLowerCase()
    if (!ALLOWED_TAG_SET.has(tag)) {
      if (!SILENT_TAGS.has(tag)) issues.warnings.push(`${where}: removed tag <${tag}>.`)
      return { tagName, attribs }
    }
    // Attribute names are matched case-sensitively below, so normalise them: lower case, except
    // SVG's viewBox, which must keep its casing for the browser to scale the drawing.
    const out: Record<string, string> = {}
    for (const [name, value] of Object.entries(attribs)) {
      const lower = name.toLowerCase()
      out[lower === "viewbox" ? "viewBox" : lower] = value
    }
    const classes = new Set<string>()

    for (const name of (out.class || "").split(/\s+/).filter(Boolean)) {
      if (PRACTICE_CLASSES.has(name)) classes.add(name)
      else issues.warnings.push(`${where}: removed unknown class „${name}“.`)
    }

    if (out.stroke !== undefined) {
      const stroke = out.stroke.trim().toLowerCase()
      const series = PRACTICE_PALETTE.get(stroke)
      if (series) classes.add(series)
      else if (stroke !== "none") issues.errors.push(`${where}: literal stroke colour „${out.stroke}“.`)
      delete out.stroke
    }
    if (out.fill !== undefined) {
      if (out.fill.trim().toLowerCase() !== "none") issues.errors.push(`${where}: literal fill colour „${out.fill}“.`)
      delete out.fill
    }

    if (out.style !== undefined) {
      const { style, seriesClass } = cleanStyle(out.style, issues, where)
      if (seriesClass) classes.add(seriesClass)
      if (style) out.style = style
      else delete out.style
    }

    if (out.id !== undefined && !/^p\d+$/.test(out.id)) delete out.id

    if (out.href !== undefined) {
      const href = cleanHref(out.href, issues, where)
      if (href === null) delete out.href
      else out.href = href
    }

    if (classes.size > 0) out.class = [...classes].join(" ")
    else delete out.class

    return { tagName, attribs: out }
  }

  const clean = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["https"],
    allowedSchemesAppliedToAttributes: ["href"],
    allowProtocolRelative: false,
    allowedStyles: { "*": Object.fromEntries(Object.entries(STYLE_VALUES).map(([k, v]) => [k, [v]])) },
    nonTextTags: ["script", "style", "textarea", "option", "noscript"],
    transformTags: { "*": transform },
    parser: { lowerCaseAttributeNames: false, lowerCaseTags: true },
  })

  return { html: clean.trim(), ...issues }
}
