import { z } from "zod"
import { PRACTICE_EXAMPLE_KEY_PATTERN, PRACTICE_INTRO_BLOCK_KINDS, PRACTICE_SLUG_PATTERN } from "@/lib/constants"

// The practice page "envelope": the structured form every page is stored in, whether it was
// uploaded as generator HTML (parsed by parse-html.ts) or as JSON. HTML fields hold fragments
// that are sanitized before storage (content.ts).

export const PRACTICE_MAX_PAGE_BYTES = 1_000_000
export const PRACTICE_MAX_EXAMPLES = 300
export const PRACTICE_MAX_STEPS = 60

const html = z.string().max(PRACTICE_MAX_PAGE_BYTES)
const line = (max: number) => z.string().trim().min(1).max(max)

export const practiceSlug = z.string().regex(PRACTICE_SLUG_PATTERN, "Use 2–50 lowercase letters, digits, - or _.")

export const practiceExampleKeySchema = z
  .string()
  .regex(PRACTICE_EXAMPLE_KEY_PATTERN, "Use 1–80 lowercase letters, digits or -.")

export const introBlockSchema = z
  .object({
    kind: z.enum(Object.values(PRACTICE_INTRO_BLOCK_KINDS) as [string, ...string[]]),
    title: line(300).nullable(),
    html,
  })
  .strict()

export const stepSchema = z
  .object({
    title: line(300),
    events_html: z.array(html).max(200),
    body_html: html,
  })
  .strict()

// Input form: key is optional (the importer derives it from the title when missing).
export const exampleInputSchema = z
  .object({
    key: practiceExampleKeySchema.optional(),
    n: z.number().int().min(1).max(10_000),
    title: line(500),
    source: z.string().trim().max(2000).nullable(),
    nav_meta: z.string().trim().max(500).nullable(),
    task_html: html,
    steps: z.array(stepSchema).max(PRACTICE_MAX_STEPS),
    result_html: html,
  })
  .strict()

export const pageContentInputSchema = z
  .object({
    title: line(300),
    lead_html: html,
    intro_blocks: z.array(introBlockSchema).max(20),
    footer_html: html.nullable(),
    examples: z.array(exampleInputSchema).min(1).max(PRACTICE_MAX_EXAMPLES),
  })
  .strict()

export type PracticeIntroBlock = z.infer<typeof introBlockSchema>
export type PracticeStep = z.infer<typeof stepSchema>
export type PracticeExampleInput = z.infer<typeof exampleInputSchema>
export type PracticePageContentInput = z.infer<typeof pageContentInputSchema>

export type PracticeExample = PracticeExampleInput & { key: string }
export type PracticePageContent = Omit<PracticePageContentInput, "examples"> & { examples: PracticeExample[] }

// Module manifest: index texts and the grouping/order of pages. Page slugs may be listed
// before the pages exist; unlisted pages render under "Nezařazené".
export const manifestGroupSchema = z
  .object({
    key: line(100),
    title: line(300),
    description: z.string().trim().max(2000).nullable().optional(),
    pages: z.array(practiceSlug).max(200),
  })
  .strict()

export const manifestSchema = z
  .object({
    intro_html: html.optional(),
    intro_blocks: z.array(introBlockSchema).max(20).optional(),
    closing_blocks: z.array(introBlockSchema).max(20).optional(),
    groups: z.array(manifestGroupSchema).max(100).optional(),
  })
  .strict()

export type PracticeManifest = z.infer<typeof manifestSchema>
export type PracticeManifestGroup = z.infer<typeof manifestGroupSchema>
