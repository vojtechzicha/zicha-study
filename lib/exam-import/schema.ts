import { z } from "zod"
import { EXAM_TERM_SOURCES, EXTERNAL_TERM_STATUS } from "@/lib/constants"

// Body of POST /api/exam-terms/import. The importer (agents-study/uis-watch) reads the source
// system and normalizes it; this app only matches the terms to its own subjects and periods.
// See docs/EXAM_IMPORT.md.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM.")
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, "Use YYYY-MM-DDTHH:MM.")
  .nullable()
  .default(null)
const shortText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((v) => (v ? v : null))
const count = z.number().int().min(0).max(100_000).nullable().default(null)

export const importedTermSchema = z
  .object({
    external_id: z.string().trim().min(1).max(100),
    subject_code: z.string().trim().min(1).max(50),
    subject_name: shortText(300),
    date: isoDate,
    start_time: clockTime,
    end_time: clockTime.nullable().default(null),
    // credit = zápočet, exam = zkouška; null when the source doesn't say.
    assessment: z.enum(["credit", "exam"]).nullable().default(null),
    // Form of the exam ("písemná", "ústní"), matched against the period's exam parts.
    form: shortText(100),
    // regular / resit (opravný) / pre_term (předtermín) / any; null when unknown.
    attempt: z.enum(["regular", "resit", "pre_term", "any"]).nullable().default(null),
    status: z.enum([EXTERNAL_TERM_STATUS.REGISTERED, EXTERNAL_TERM_STATUS.AVAILABLE, EXTERNAL_TERM_STATUS.UNAVAILABLE]),
    status_note: shortText(500),
    kind: shortText(200),
    term_type: shortText(100),
    room: shortText(300),
    examiners: shortText(500),
    listed_by: shortText(300),
    capacity: count,
    registered_count: count,
    registration_from: localDateTime,
    registration_to: localDateTime,
    deregistration_to: localDateTime,
  })
  .strict()

export const importRequestSchema = z
  .object({
    study_id: z.string().trim().min(1).max(100),
    source: z.enum([EXAM_TERM_SOURCES.UIS]),
    // The list is everything the source currently shows (for the student), so upcoming synced
    // terms missing from it were cancelled. false = only create and update.
    complete: z.boolean(),
    dry_run: z.boolean().optional().default(false),
    terms: z.array(importedTermSchema).max(500),
  })
  .strict()
  .superRefine((body, ctx) => {
    const seen = new Set<string>()
    body.terms.forEach((t, i) => {
      if (seen.has(t.external_id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["terms", i, "external_id"], message: "Duplicate external_id." })
      }
      seen.add(t.external_id)
    })
  })

export type ImportedTerm = z.infer<typeof importedTermSchema>
export type ImportRequest = z.infer<typeof importRequestSchema>
