import { z } from "zod"
import * as db from "@/lib/mongodb/db"
import { COMPLETION_TYPE_MAPPING, SUBJECT_TYPES, todayLocalIso } from "@/lib/constants"
import { HS_GRADE_VALUES } from "@/lib/highschool/grades"
import { requiresCredit, requiresExam } from "@/lib/status-utils"
import { STUDY_KIND, resolveStudyKind } from "@/lib/study-kind"
import { dryRun, emptyToNull, enumOf, isoDate, optionalText, recordId, requireFields, text } from "@/lib/mcp/schemas"
import { ToolError, commitCreate, commitDelete, commitUpdate, defineTool, requireDoc, type ToolContext } from "@/lib/mcp/tool-kit"
import { ensurePracticeModule } from "@/lib/practice/module"
import { practiceLinks } from "@/lib/practice/urls"

// The values the subject form stores (the mapping's other keys are legacy spellings with line breaks).
const COMPLETION_TYPE_VALUES = Object.keys(COMPLETION_TYPE_MAPPING).filter((k) => !k.includes("\n")) as [
  string,
  ...string[],
]

const HIGH_SCHOOL_FIELDS = new Set(["name", "abbreviation", "lecturer", "grades", "practice_enabled"])

const subjectFields = z
  .object({
    name: text(200),
    abbreviation: optionalText(50),
    lecturer: optionalText(200),
    // University subjects (one row per semester)
    semester: text(50).describe('E.g. "1. ročník ZS" or "2. ročník LS".'),
    completion_type: z.enum(COMPLETION_TYPE_VALUES),
    subject_type: enumOf(SUBJECT_TYPES),
    credits: z.number().min(0).max(100),
    hours: z.number().min(0).max(10000).nullable(),
    points: z.number().int().min(0).max(1000).nullable(),
    grade: optionalText(10).describe('E.g. "A"–"F", "1", "1-", "Z".'),
    department: optionalText(200),
    final_date: isoDate.nullable().describe("Date the subject was completed."),
    completed: z.boolean(),
    planned: z.boolean(),
    credit_completed: z.boolean(),
    exam_completed: z.boolean(),
    is_repeat: z.boolean(),
    repeats_subject_id: recordId.nullable().describe("The earlier attempt of this subject, in the same study."),
    // Both kinds
    practice_enabled: z
      .boolean()
      .describe("Procvičování (private practice pages). Enabling creates the module; disabling keeps its pages but hides them."),
    // High-school subjects (one row for the whole study, a grade per half-year)
    grades: z
      .array(
        z
          .object({
            year: z.number().int().min(1).max(10).describe("ročník, 1-based"),
            half: z.union([z.literal(1), z.literal(2)]).describe("pololetí"),
            grade: z.enum(HS_GRADE_VALUES),
          })
          .strict()
      )
      .max(40)
      .describe("High-school only: 1 = výborný … 5 = nedostatečný."),
  })
  .partial()
  .strict()

type SubjectFields = z.infer<typeof subjectFields>

async function prepareSubjectPatch(study: Record<string, any>, before: Record<string, any> | null, fields: SubjectFields) {
  const patch: Record<string, any> = emptyToNull(fields)
  const merged = { ...(before ?? {}), ...patch }

  if (resolveStudyKind(study.type) === STUDY_KIND.HIGH_SCHOOL) {
    const invalid = Object.keys(patch).filter((k) => !HIGH_SCHOOL_FIELDS.has(k))
    if (invalid.length > 0) {
      throw new ToolError(`High-school subjects only have name, abbreviation, lecturer, grades and practice_enabled (got ${invalid.join(", ")}).`)
    }
    if (patch.grades) {
      const keys = patch.grades.map((g: { year: number; half: number }) => `${g.year}/${g.half}`)
      if (new Set(keys).size !== keys.length) throw new ToolError("grades has two entries for the same half-year.")
    }
    return patch
  }

  if ("grades" in patch) throw new ToolError("grades only applies to high-school subjects.")

  if (merged.completed && merged.planned) throw new ToolError("A subject cannot be both completed and planned.")

  if (patch.is_repeat === false) patch.repeats_subject_id = null
  if (patch.repeats_subject_id) {
    if (patch.repeats_subject_id === before?._id) throw new ToolError("A subject cannot repeat itself.")
    const original = await db.getSubjectById(patch.repeats_subject_id)
    if (!original || original.study_id !== study._id) {
      throw new ToolError("repeats_subject_id must be a subject of the same study.")
    }
    patch.is_repeat = true
  }
  if (merged.is_repeat && !merged.repeats_subject_id && patch.is_repeat) {
    throw new ToolError("A repeat needs repeats_subject_id.")
  }

  // Completing a subject implies its required credit/exam are done (as in the subject form).
  if (patch.completed === true && !before?.completed) {
    if (patch.credit_completed === undefined) patch.credit_completed = requiresCredit(merged.completion_type || "")
    if (patch.exam_completed === undefined) patch.exam_completed = requiresExam(merged.completion_type || "")
    if (!merged.final_date) patch.final_date = todayLocalIso()
  }

  return patch
}

async function getStudyOf(subject: Record<string, any>) {
  return requireDoc(await db.getStudyById(subject.study_id), "Study", subject.study_id)
}

// After practice was enabled: make sure the module exists and report where it lives.
async function practiceModuleInfo(subject: Record<string, any> | null, ctx: ToolContext) {
  if (!subject?.practice_enabled) return undefined
  const practiceModule = await ensurePracticeModule(subject)
  return {
    id: String(practiceModule._id),
    address_prefix: practiceModule.address_prefix,
    slug: practiceModule.slug,
    ...practiceLinks(ctx.origin || "https://www.zicha.study", practiceModule.address_prefix, practiceModule.slug),
  }
}

export const subjectTools = [
  defineTool({
    name: "list_subjects",
    title: "List subjects",
    description:
      "All subjects of a study. University studies have one row per semester; high-school studies one row per subject with grades per half-year.",
    access: "read",
    input: { study_id: recordId },
    handler: async ({ study_id }) => {
      requireDoc(await db.getStudyById(study_id), "Study", study_id)
      return db.normalizeIds(await db.getSubjectsByStudyId(study_id))
    },
  }),

  defineTool({
    name: "get_subject",
    title: "Get subject",
    description: "One subject with all its fields.",
    access: "read",
    input: { subject_id: recordId },
    handler: async ({ subject_id }) => db.normalizeId(requireDoc(await db.getSubjectById(subject_id), "Subject", subject_id)),
  }),

  defineTool({
    name: "create_subject",
    title: "Create subject",
    description:
      "Add a subject. University: needs name, semester, completion_type, subject_type and credits. High school: needs name; only name, abbreviation, lecturer, grades and practice_enabled apply.",
    access: "write",
    input: { study_id: recordId, fields: subjectFields },
    handler: async ({ study_id, fields }, ctx) => {
      const study = requireDoc(await db.getStudyById(study_id), "Study", study_id)
      const highSchool = resolveStudyKind(study.type) === STUDY_KIND.HIGH_SCHOOL
      requireFields(fields, highSchool ? ["name"] : ["name", "semester", "completion_type", "subject_type", "credits"], "A subject")

      const patch = await prepareSubjectPatch(study, null, fields)
      const defaults = highSchool
        ? { abbreviation: null, lecturer: null, grades: [] }
        : {
            abbreviation: null,
            hours: null,
            points: null,
            grade: null,
            lecturer: null,
            department: null,
            final_date: null,
            completed: false,
            planned: false,
            credit_completed: false,
            exam_completed: false,
            is_repeat: false,
            repeats_subject_id: null,
          }
      const result = await commitCreate({ ctx, tool: "create_subject", collection: "subjects" }, () =>
        db.createSubject({ study_id, ...defaults, ...patch })
      )
      const practice_module = await practiceModuleInfo(await db.getSubjectById(result.created.id), ctx)
      return practice_module ? { ...result, practice_module } : result
    },
  }),

  defineTool({
    name: "update_subject",
    title: "Update subject",
    description:
      "Change subject fields. Only the given fields change; null clears a field. Setting completed=true also marks the credit/exam done and sets final_date to today unless given.",
    access: "write",
    input: { subject_id: recordId, fields: subjectFields, dry_run: dryRun },
    handler: async ({ subject_id, fields, dry_run }, ctx) => {
      const before = requireDoc(await db.getSubjectById(subject_id), "Subject", subject_id)
      const study = await getStudyOf(before)
      const patch = await prepareSubjectPatch(study, before, fields)
      const result = await commitUpdate({
        ctx,
        tool: "update_subject",
        collection: "subjects",
        before,
        patch,
        dryRun: dry_run,
        write: (p) => db.updateSubject(subject_id, p),
        reload: () => db.getSubjectById(subject_id),
      })
      if (dry_run || patch.practice_enabled !== true) return result
      const practice_module = await practiceModuleInfo(await db.getSubjectById(subject_id), ctx)
      return practice_module ? { ...result, practice_module } : result
    },
  }),

  defineTool({
    name: "delete_subject",
    title: "Delete subject",
    description:
      "Permanently delete a subject with its exam terms and practice pages. Refused while another subject repeats it. Try dry_run first.",
    access: "delete",
    input: { subject_id: recordId, dry_run: dryRun },
    handler: async ({ subject_id, dry_run }, ctx) => {
      const before = requireDoc(await db.getSubjectById(subject_id), "Subject", subject_id)
      const periods = await db.getExamPeriodsByStudyId(before.study_id)
      const terms = await db.getExamTermsByPeriodIds(periods.map((p) => String(p._id)))
      const linkedNotes = await db.getStudyNotesBySubjectId(subject_id)
      const practice = await db.countPracticeData({ subject_id })
      return commitDelete({
        ctx,
        tool: "delete_subject",
        collection: "subjects",
        before,
        dryRun: dry_run,
        cascade: {
          exam_terms: terms.filter((t) => t.subject_id === subject_id).length,
          note_links: linkedNotes.length,
          ...practice,
        },
        remove: () => db.deleteSubject(subject_id),
      })
    },
  }),
]
