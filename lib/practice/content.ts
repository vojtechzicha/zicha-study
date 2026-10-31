import crypto from "crypto"
import { PRACTICE_EXAMPLE_KEY_PATTERN } from "@/lib/constants"
import { dedupeKeys, practiceExampleKey } from "./keys"
import { sanitizeFragment, type SanitizeIssues } from "./sanitize"
import {
  PRACTICE_MAX_PAGE_BYTES,
  pageContentInputSchema,
  manifestSchema,
  type PracticeIntroBlock,
  type PracticeManifest,
  type PracticePageContent,
  type PracticePageContentInput,
} from "./schema"

// The one gate between uploaded content and the database: every HTML field is sanitized here,
// example keys are assigned and checked, and a content hash is computed. The db write functions
// for practice content only accept the branded types this module returns, so no write path can
// skip sanitizing.

declare const sanitized: unique symbol
export type Sanitized<T> = T & { readonly [sanitized]: true }

export class PracticeContentError extends Error {
  readonly errors: string[]
  readonly warnings: string[]

  constructor(errors: string[], warnings: string[] = []) {
    super(errors.join(" "))
    this.name = "PracticeContentError"
    this.errors = errors
    this.warnings = warnings
  }
}

export interface PreparedPageContent {
  content: Sanitized<PracticePageContent>
  contentHash: string
  warnings: string[]
}

function clean(html: string, where: string, issues: SanitizeIssues): string {
  const result = sanitizeFragment(html, where)
  issues.errors.push(...result.errors)
  issues.warnings.push(...result.warnings)
  return result.html
}

function cleanBlocks(blocks: PracticeIntroBlock[], where: string, issues: SanitizeIssues): PracticeIntroBlock[] {
  return blocks.map((block, i) => ({
    kind: block.kind,
    title: block.title,
    html: clean(block.html, `${where} ${i + 1}`, issues),
  }))
}

export function hashPracticeContent(content: PracticePageContent): string {
  return crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex")
}

/**
 * Validates, sanitizes and keys a page's content. `strict` (used by the migration) requires a
 * data-key on every example instead of deriving keys from titles. Throws PracticeContentError.
 */
export function preparePageContent(input: unknown, options: { strict?: boolean } = {}): PreparedPageContent {
  const parsed = pageContentInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new PracticeContentError(parsed.error.issues.map((i) => `${i.path.join(".") || "page"}: ${i.message}`))
  }
  const page: PracticePageContentInput = parsed.data
  const issues: SanitizeIssues = { errors: [], warnings: [] }

  // Keys: data-key wins and must be unique; missing keys come from the title (deduplicated
  // against each other and against the given keys).
  const given = page.examples.map((ex) => ex.key)
  const missing = given.filter((key) => key === undefined).length
  if (options.strict && missing > 0) {
    issues.errors.push(`${missing} example(s) have no data-key (strict upload).`)
  } else if (missing > 0) {
    issues.warnings.push(`${missing} example(s) have no data-key; keys were derived from their titles.`)
  }
  const seenGiven = new Set<string>()
  for (const key of given) {
    if (key === undefined) continue
    if (!PRACTICE_EXAMPLE_KEY_PATTERN.test(key)) issues.errors.push(`Invalid data-key „${key}“.`)
    if (seenGiven.has(key)) issues.errors.push(`Duplicate data-key „${key}“.`)
    seenGiven.add(key)
  }
  const derived = dedupeKeys([
    ...[...seenGiven],
    ...page.examples.filter((ex) => ex.key === undefined).map((ex) => practiceExampleKey(ex.title)),
  ]).slice(seenGiven.size)
  let next = 0
  const keys = page.examples.map((ex) => ex.key ?? derived[next++])

  const content: PracticePageContent = {
    title: page.title,
    lead_html: clean(page.lead_html, "lead", issues),
    intro_blocks: cleanBlocks(page.intro_blocks, "intro block", issues),
    footer_html: page.footer_html === null ? null : clean(page.footer_html, "footer", issues),
    examples: page.examples.map((ex, i) => {
      const where = `example ${ex.n} („${keys[i]}“)`
      return {
        key: keys[i],
        n: ex.n,
        title: ex.title,
        source: ex.source,
        nav_meta: ex.nav_meta,
        task_html: clean(ex.task_html, `${where} task`, issues),
        steps: ex.steps.map((step, s) => ({
          title: step.title,
          events_html: step.events_html.map((e, k) => clean(e, `${where} step ${s + 1} event ${k + 1}`, issues)),
          body_html: clean(step.body_html, `${where} step ${s + 1}`, issues),
        })),
        result_html: clean(ex.result_html, `${where} result`, issues),
      }
    }),
  }

  const bytes = Buffer.byteLength(JSON.stringify(content))
  if (bytes > PRACTICE_MAX_PAGE_BYTES) {
    issues.errors.push(`The page is too large (${bytes} B, max ${PRACTICE_MAX_PAGE_BYTES} B).`)
  }
  if (issues.errors.length > 0) throw new PracticeContentError(issues.errors, issues.warnings)

  return {
    content: content as Sanitized<PracticePageContent>,
    contentHash: hashPracticeContent(content),
    warnings: issues.warnings,
  }
}

export type SanitizedModuleContent = Sanitized<{
  intro_html?: string
  intro_blocks?: PracticeIntroBlock[]
  closing_blocks?: PracticeIntroBlock[]
}>

/** Sanitizes the HTML parts of a module patch (manifest upload or MCP update). */
export function prepareModuleContent(input: {
  intro_html?: string
  intro_blocks?: PracticeIntroBlock[]
  closing_blocks?: PracticeIntroBlock[]
}): { content: SanitizedModuleContent; warnings: string[] } {
  const issues: SanitizeIssues = { errors: [], warnings: [] }
  const content: { intro_html?: string; intro_blocks?: PracticeIntroBlock[]; closing_blocks?: PracticeIntroBlock[] } = {}
  if (input.intro_html !== undefined) content.intro_html = clean(input.intro_html, "module intro", issues)
  if (input.intro_blocks !== undefined) content.intro_blocks = cleanBlocks(input.intro_blocks, "module intro block", issues)
  if (input.closing_blocks !== undefined) content.closing_blocks = cleanBlocks(input.closing_blocks, "module closing block", issues)
  if (issues.errors.length > 0) throw new PracticeContentError(issues.errors, issues.warnings)
  return { content: content as SanitizedModuleContent, warnings: issues.warnings }
}

/** Validates a manifest; its HTML parts go through prepareModuleContent(). */
export function parseManifest(input: unknown): PracticeManifest {
  const parsed = manifestSchema.safeParse(input)
  if (!parsed.success) {
    throw new PracticeContentError(parsed.error.issues.map((i) => `${i.path.join(".") || "manifest"}: ${i.message}`))
  }
  return parsed.data
}
