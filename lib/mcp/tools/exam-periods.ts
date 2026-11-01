import { z } from "zod"
import * as db from "@/lib/mongodb/db"
import { EXAM_SCHEDULER_DEFAULTS, MIN_EXAM_PARTS, type ExamPartsConfig } from "@/lib/constants"
import { clockTime, dryRun, emptyToNull, isoDate, optionalText, recordId, requireFields, text } from "@/lib/mcp/schemas"
import { ToolError, commitCreate, commitDelete, commitUpdate, defineTool, requireDoc } from "@/lib/mcp/tool-kit"

// A period is a date window of one study in which the scheduler picks one term per
// subject (or one term per part for a split exam). Terms are the candidate slots.

const examPartsConfig = z
  .object({
    parts: z
      .array(z.object({ id: text(50), label: text(100) }).strict())
      .min(MIN_EXAM_PARTS)
      .max(10)
      .describe("Parts in exam order, e.g. Písemná, Ústní. Part ids are stable."),
    ordered: z.boolean().describe("Parts must be taken in this order."),
    min_gap_days: z
      .number()
      .int()
      .min(0)
      .max(60)
      .optional()
      .describe("Calendar days between two consecutive parts; 1 = the next part on the next day at the earliest. Default 0."),
  })
  .strict()

const periodFields = z
  .object({
    name: text(200),
    start_date: isoDate,
    due_date: isoDate,
    subject_ids: z.array(recordId).max(200).describe("Subjects that need a term in this period."),
    exam_parts: z
      .record(recordId, examPartsConfig)
      .describe("Subjects whose exam is split into separately registered parts, by subject id."),
  })
  .partial()
  .strict()

const termFields = z
  .object({
    subject_id: recordId,
    date: isoDate,
    start_time: clockTime,
    duration_minutes: z.number().int().min(5).max(24 * 60),
    is_online: z.boolean(),
    note: optionalText(500),
    locked: z.boolean().describe("Force this term into the official schedule."),
    part_ids: z.array(text(50)).max(10).describe("Parts of a split exam this term covers; empty = all."),
    is_pre_term: z.boolean().describe("Předtermín: may fall before the period starts."),
    is_tentative: z.boolean().describe("Date or time not confirmed yet."),
  })
  .partial()
  .strict()

async function preparePeriodPatch(studyId: string, before: Record<string, any> | null, fields: z.infer<typeof periodFields>) {
  const patch: Record<string, any> = { ...fields }
  const merged = { ...(before ?? {}), ...patch }
  if (merged.start_date && merged.due_date && merged.due_date < merged.start_date) {
    throw new ToolError("due_date cannot be before start_date.")
  }

  const subjectIds: string[] = merged.subject_ids || []
  if (patch.subject_ids) {
    const subjects = await db.getSubjectsByIds(patch.subject_ids)
    const valid = new Set(subjects.filter((s) => s.study_id === studyId).map((s) => String(s._id)))
    const invalid = patch.subject_ids.filter((id: string) => !valid.has(id))
    if (invalid.length > 0) throw new ToolError(`Not subjects of this study: ${invalid.join(", ")}.`)
    patch.subject_ids = Array.from(new Set(patch.subject_ids))
  }

  const parts: Record<string, ExamPartsConfig> = merged.exam_parts || {}
  for (const [subjectId, config] of Object.entries(parts)) {
    if (!subjectIds.includes(subjectId)) throw new ToolError(`exam_parts lists ${subjectId}, which is not in subject_ids.`)
    const ids = config.parts.map((p) => p.id)
    if (new Set(ids).size !== ids.length) throw new ToolError(`exam_parts of ${subjectId} repeats a part id.`)
  }
  // Dropping a subject from the period also drops its split configuration.
  if (patch.subject_ids && !patch.exam_parts && before?.exam_parts) {
    patch.exam_parts = Object.fromEntries(
      Object.entries(before.exam_parts as Record<string, ExamPartsConfig>).filter(([id]) => subjectIds.includes(id))
    )
  }
  return patch
}

async function prepareTermPatch(period: Record<string, any>, before: Record<string, any> | null, fields: z.infer<typeof termFields>) {
  const patch: Record<string, any> = emptyToNull(fields)
  const merged = { ...(before ?? {}), ...patch }

  if (patch.subject_id) {
    const subject = await db.getSubjectById(patch.subject_id)
    if (!subject || subject.study_id !== period.study_id) {
      throw new ToolError("subject_id must be a subject of the period's study.")
    }
  }

  const config: ExamPartsConfig | undefined = period.exam_parts?.[merged.subject_id]
  const partIds: string[] = merged.part_ids || []
  if (partIds.length > 0) {
    if (!config) throw new ToolError("part_ids only applies to subjects split into parts (exam_parts of the period).")
    const valid = new Set(config.parts.map((p) => p.id))
    const invalid = partIds.filter((id) => !valid.has(id))
    if (invalid.length > 0) throw new ToolError(`Unknown part ids: ${invalid.join(", ")}.`)
  }
  return patch
}

export const examPeriodTools = [
  defineTool({
    name: "list_exam_periods",
    title: "List exam periods",
    description:
      "Exam periods of a study, each with its candidate exam terms. Terms with source \"uis\" are synced from the university system (external_id, external: room, capacity, registration window, status).",
    access: "read",
    input: { study_id: recordId },
    handler: async ({ study_id }) => {
      requireDoc(await db.getStudyById(study_id), "Study", study_id)
      const periods = db.normalizeIds(await db.getExamPeriodsByStudyId(study_id))
      const terms = db.normalizeIds(await db.getExamTermsByPeriodIds(periods.map((p) => p.id)))
      return periods.map((p) => ({ ...p, terms: terms.filter((t) => t.period_id === p.id) }))
    },
  }),

  defineTool({
    name: "create_exam_period",
    title: "Create exam period",
    description: "Add an exam period to a study. Needs name, start_date and due_date.",
    access: "write",
    input: { study_id: recordId, fields: periodFields },
    handler: async ({ study_id, fields }, ctx) => {
      requireDoc(await db.getStudyById(study_id), "Study", study_id)
      requireFields(fields, ["name", "start_date", "due_date"], "An exam period")
      const patch = await preparePeriodPatch(study_id, null, fields)
      return commitCreate({ ctx, tool: "create_exam_period", collection: "exam_periods" }, () =>
        db.createExamPeriod({ study_id, subject_ids: [], exam_parts: {}, ...patch })
      )
    },
  }),

  defineTool({
    name: "update_exam_period",
    title: "Update exam period",
    description:
      "Change an exam period. Removing a subject from subject_ids also deletes its terms in this period.",
    access: "write",
    input: { period_id: recordId, fields: periodFields, dry_run: dryRun },
    handler: async ({ period_id, fields, dry_run }, ctx) => {
      const before = requireDoc(await db.getExamPeriodById(period_id), "Exam period", period_id)
      const patch = await preparePeriodPatch(before.study_id, before, fields)

      const dropped: string[] = patch.subject_ids
        ? ((before.subject_ids as string[]) || []).filter((id) => !patch.subject_ids.includes(id))
        : []
      const result = await commitUpdate({
        ctx,
        tool: "update_exam_period",
        collection: "exam_periods",
        before,
        patch,
        dryRun: dry_run,
        write: async (p) => {
          await db.updateExamPeriod(period_id, p)
          for (const subjectId of dropped) await db.deleteExamTermsByPeriodAndSubject(period_id, subjectId)
        },
        reload: () => db.getExamPeriodById(period_id),
      })
      if (dropped.length === 0) return result
      return { ...result, [dry_run ? "would_delete_terms_of_subjects" : "deleted_terms_of_subjects"]: dropped }
    },
  }),

  defineTool({
    name: "delete_exam_period",
    title: "Delete exam period",
    description: "Permanently delete an exam period and all its terms.",
    access: "delete",
    input: { period_id: recordId, dry_run: dryRun },
    handler: async ({ period_id, dry_run }, ctx) => {
      const before = requireDoc(await db.getExamPeriodById(period_id), "Exam period", period_id)
      const terms = await db.getExamTermsByPeriodId(period_id)
      return commitDelete({
        ctx,
        tool: "delete_exam_period",
        collection: "exam_periods",
        before,
        dryRun: dry_run,
        cascade: { exam_terms: terms.length },
        remove: () => db.deleteExamPeriod(period_id),
      })
    },
  }),

  defineTool({
    name: "create_exam_term",
    title: "Create exam term",
    description:
      "Add a candidate exam term to a period. Needs subject_id, date and start_time. The subject is added to the period's subject_ids if missing.",
    access: "write",
    input: { period_id: recordId, fields: termFields },
    handler: async ({ period_id, fields }, ctx) => {
      const period = requireDoc(await db.getExamPeriodById(period_id), "Exam period", period_id)
      requireFields(fields, ["subject_id", "date", "start_time"], "An exam term")
      const patch = await prepareTermPatch(period, null, fields)

      const subjectIds: string[] = period.subject_ids || []
      if (!subjectIds.includes(patch.subject_id)) {
        await db.updateExamPeriod(period_id, { subject_ids: [...subjectIds, patch.subject_id] })
      }
      return commitCreate({ ctx, tool: "create_exam_term", collection: "exam_terms" }, () =>
        db.createExamTerm({
          period_id,
          study_id: period.study_id,
          duration_minutes: EXAM_SCHEDULER_DEFAULTS.DEFAULT_EXAM_DURATION_MINUTES,
          is_online: false,
          part_ids: [],
          is_pre_term: false,
          is_tentative: false,
          ...patch,
        })
      )
    },
  }),

  defineTool({
    name: "update_exam_term",
    title: "Update exam term",
    description:
      "Change an exam term, e.g. lock it into the schedule. Only the given fields change. On a synced term (source set) the next sync overwrites date, start_time, is_pre_term and part_ids.",
    access: "write",
    input: { term_id: recordId, fields: termFields, dry_run: dryRun },
    handler: async ({ term_id, fields, dry_run }, ctx) => {
      const before = requireDoc(await db.getExamTermById(term_id), "Exam term", term_id)
      const period = requireDoc(await db.getExamPeriodById(before.period_id), "Exam period", before.period_id)
      if (fields.subject_id && fields.subject_id !== before.subject_id) {
        throw new ToolError("A term cannot move to another subject; delete it and create a new one.")
      }
      return commitUpdate({
        ctx,
        tool: "update_exam_term",
        collection: "exam_terms",
        before,
        patch: await prepareTermPatch(period, before, fields),
        dryRun: dry_run,
        write: (p) => db.updateExamTerm(term_id, p),
        reload: () => db.getExamTermById(term_id),
      })
    },
  }),

  defineTool({
    name: "delete_exam_term",
    title: "Delete exam term",
    description: "Permanently delete an exam term. A deleted synced term (source set) is not imported again.",
    access: "delete",
    input: { term_id: recordId, dry_run: dryRun },
    handler: async ({ term_id, dry_run }, ctx) => {
      const before = requireDoc(await db.getExamTermById(term_id), "Exam term", term_id)
      return commitDelete({
        ctx,
        tool: "delete_exam_term",
        collection: "exam_terms",
        before,
        dryRun: dry_run,
        remove: async () => {
          await db.deleteExamTerm(term_id)
        },
      })
    },
  }),
]
