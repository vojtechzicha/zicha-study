import { load, type Cheerio, type CheerioAPI } from "cheerio"
import { PRACTICE_INTRO_BLOCK_KINDS } from "@/lib/constants"
import { createSlug } from "@/lib/utils/slug"
import type { PracticeExampleInput, PracticeIntroBlock, PracticePageContentInput, PracticeStep } from "./schema"

// Parses a page produced by the Procvičování generators (common.py page()/section()) into the
// envelope. The shell parts – back link, example nav, step buttons, script, styles – are dropped
// and rebuilt by the app; everything with content is kept: lead, intro cards in order, nav meta,
// task, steps, result and the closing verification note.

// domhandler's node types, taken from cheerio's signatures (domhandler isn't a direct dependency).
type Root = ReturnType<CheerioAPI["root"]>
type AnyNode = ReturnType<Root["contents"]> extends Cheerio<infer T> ? T : never
type Element = ReturnType<Root["children"]> extends Cheerio<infer T> ? T : never

export interface ParsedPracticePage {
  slug: string | null
  content: PracticePageContentInput
  errors: string[]
  warnings: string[]
}

const EXAMPLE_HEADING = /^Příklad\s+(\d+)\s*:\s*([\s\S]*)$/

function innerHtml($: CheerioAPI, el: Cheerio<AnyNode>): string {
  return ($.html(el.contents()) || "").trim()
}

function outerHtml($: CheerioAPI, nodes: AnyNode[]): string {
  return nodes.map((node) => $.html(node)).join("").trim()
}

function text(el: Cheerio<AnyNode>): string {
  return el.text().replace(/\s+/g, " ").trim()
}

function isElement(node: AnyNode): node is Element {
  return node.type === "tag" || node.type === "script" || node.type === "style"
}

function introBlock($: CheerioAPI, card: Cheerio<Element>): PracticeIntroBlock {
  const kind = card.hasClass("exam")
    ? PRACTICE_INTRO_BLOCK_KINDS.EXAM
    : card.find(".legend").length > 0
      ? PRACTICE_INTRO_BLOCK_KINDS.LEGEND
      : PRACTICE_INTRO_BLOCK_KINDS.NOTE
  const heading = card.children("h3").first()
  const title = heading.length > 0 ? text(heading) : null
  const body = card.clone()
  body.children("h3").first().remove()
  return { kind, title: title || null, html: innerHtml($, body) }
}

function parseStep($: CheerioAPI, step: Cheerio<Element>, index: number): PracticeStep {
  const heading = step.children("h3").first()
  const list = step.children("ol").first()
  const events_html = list.children("li").toArray().map((li) => innerHtml($, $(li)))
  const stepbody = step.children(".stepbody").first()
  let body_html: string
  if (stepbody.length > 0) {
    body_html = innerHtml($, stepbody)
  } else {
    const rest = step.clone()
    rest.children("h3").first().remove()
    rest.children("ol").first().remove()
    body_html = innerHtml($, rest)
  }
  return { title: text(heading) || `Krok ${index + 1}`, events_html, body_html }
}

function parseExample(
  $: CheerioAPI,
  section: Cheerio<Element>,
  position: number,
  navMeta: Map<number, string>,
  errors: string[]
): PracticeExampleInput {
  const idMatch = /^p(\d+)$/.exec(section.attr("id") || "")
  const heading = text(section.children("h2").first())
  const headingMatch = EXAMPLE_HEADING.exec(heading)
  const n = headingMatch ? Number(headingMatch[1]) : idMatch ? Number(idMatch[1]) : position + 1
  const title = (headingMatch ? headingMatch[2] : heading).trim()
  if (!title) errors.push(`Example ${position + 1}: missing title (h2).`)

  // Children in order: h2, p.meta (source), task…, .controls, .step*, .result
  const children = section.children().toArray()
  let i = 0
  if (children[i] && $(children[i]).is("h2")) i++
  let source: string | null = null
  if (children[i] && $(children[i]).is("p.meta")) {
    source = text($(children[i])) || null
    i++
  }
  const task: AnyNode[] = []
  for (; i < children.length; i++) {
    const child = $(children[i])
    if (child.is(".controls, .step, .result")) break
    task.push(children[i])
  }

  const steps = section
    .children(".step")
    .toArray()
    .map((step, index) => parseStep($, $(step), index))

  const result = section.children(".result").first().clone()
  result.children("h3").first().remove()

  const dataKey = section.attr("data-key")
  return {
    ...(dataKey !== undefined ? { key: dataKey.trim() } : {}),
    n,
    title: title || `Příklad ${n}`,
    source,
    nav_meta: navMeta.get(n) ?? null,
    task_html: outerHtml($, task),
    steps,
    result_html: result.length > 0 ? innerHtml($, result) : "",
  }
}

export function parsePracticePageHtml(html: string, options: { urlSlug?: string | null } = {}): ParsedPracticePage {
  const errors: string[] = []
  const warnings: string[] = []
  const $ = load(html)
  $("script, style").remove()

  // Slug: <meta name="practice-slug"> wins, then the upload URL, then the page title.
  const metaSlug = ($('meta[name="practice-slug"]').attr("content") || "").trim() || null
  const urlSlug = options.urlSlug?.trim() || null
  if (metaSlug && urlSlug && metaSlug !== urlSlug) {
    errors.push(`The page's practice-slug „${metaSlug}“ doesn't match the upload address „${urlSlug}“.`)
  }

  const root = $("main").length > 0 ? $("main").first() : $("body")
  const h1 = root.find("h1").first()
  const title = text(h1)
  if (!title) errors.push("The page has no title (h1).")

  const slug = metaSlug || urlSlug || (title ? createSlug(title) || null : null)

  const lead = root.find("p.lead").first()

  // Intro cards: every .card between h1 and the first example, except the generated nav.
  const intro_blocks: PracticeIntroBlock[] = []
  const nodes = root.children().toArray().filter(isElement)
  const h1Index = nodes.findIndex((node) => $(node).is("h1"))
  const firstExample = nodes.findIndex((node) => $(node).is("section.example"))
  const introEnd = firstExample < 0 ? nodes.length : firstExample
  for (let i = h1Index + 1; i < introEnd; i++) {
    const node = $(nodes[i])
    if (node.is(".card") && !node.is("nav")) intro_blocks.push(introBlock($, node as Cheerio<Element>))
  }

  // Nav meta per example ("(9 vrcholů, 12 hran)" → "9 vrcholů, 12 hran"), keyed by #pN.
  const navMeta = new Map<number, string>()
  root.find("nav li").each((_, li) => {
    const href = $(li).find("a").first().attr("href") || ""
    const match = /^#p(\d+)$/.exec(href)
    const meta = text($(li).find(".meta").first()).replace(/^\((.*)\)$/, "$1").trim()
    if (match && meta) navMeta.set(Number(match[1]), meta)
  })

  const sections = root.find("section.example").toArray()
  if (sections.length === 0) errors.push("The page has no examples (section.example).")
  const examples = sections.map((section, position) => parseExample($, $(section), position, navMeta, errors))

  // The closing p.meta after the last example: the page's verification note / sources.
  let footer_html: string | null = null
  const lastExample = nodes.map((node, index) => ($(node).is("section.example") ? index : -1)).reduce((a, b) => Math.max(a, b), -1)
  if (lastExample >= 0) {
    const after = nodes.slice(lastExample + 1).filter((node) => $(node).is("p.meta"))
    if (after.length > 0) footer_html = after.map((node) => innerHtml($, $(node))).join("<br>")
    const other = nodes.slice(lastExample + 1).filter((node) => !$(node).is("p.meta"))
    if (other.length > 0) warnings.push(`Ignored ${other.length} element(s) after the last example.`)
  }

  return {
    slug,
    content: {
      title: title || slug || "Procvičování",
      lead_html: lead.length > 0 ? innerHtml($, lead) : "",
      intro_blocks,
      footer_html,
      examples,
    },
    errors,
    warnings,
  }
}
