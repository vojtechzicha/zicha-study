import { z } from "zod"
import * as db from "@/lib/mongodb/db"
import { GRADUATION_RESULTS, RESERVED_ROUTES, STUDY_FORMS, STUDY_STATUS, STUDY_TYPES } from "@/lib/constants"
import { resolveStudyKind } from "@/lib/study-kind"
import { clockTime, dryRun, emptyToNull, enumOf, optionalText, publicSlug, recordId, requireFields, text } from "@/lib/mcp/schemas"
import { ToolError, commitCreate, commitDelete, commitUpdate, defineTool, requireDoc } from "@/lib/mcp/tool-kit"

// Logo, diploma and the OneDrive materials folder are left to the app: they need
// file uploads or a Microsoft token.
const studyFields = z
  .object({
    name: text(200),
    type: enumOf(STUDY_TYPES),
    form: enumOf(STUDY_FORMS),
    start_year: z.number().int().min(1900).max(2200),
    end_year: z.number().int().min(1900).max(2200).nullable(),
    status: enumOf(STUDY_STATUS),
    graduation_result: enumOf(GRADUATION_RESULTS).nullable().describe("Only for completed studies."),
    final_exams_enabled: z.boolean(),
    tasks_enabled: z.boolean(),
    exam_scheduler_enabled: z.boolean().describe("Only for active studies."),
    transit_duration_hours: z.number().min(0).max(48),
    transit_cost_one_way: z.number().min(0),
    accommodation_cost_per_night: z.number().min(0),
    pto_day_cost: z.number().min(0),
    prefer_free_day_exams: z.boolean(),
    working_days: z.array(z.number().int().min(0).max(6)).max(7).describe("0 = Sunday … 6 = Saturday."),
    earliest_arrival_time: clockTime.nullable(),
    is_url: z.string().url().max(500).nullable().describe("Link to the school's information system."),
    is_public: z.boolean().describe("Publish the study at its public address."),
    public_slug: publicSlug.nullable().describe("Public address; required when is_public is true."),
    public_description: optionalText(2000),
  })
  .partial()
  .strict()

type StudyFields = z.infer<typeof studyFields>

function summarize(doc: Record<string, any>) {
  const study = db.normalizeId(doc)!
  return {
    id: study.id,
    name: study.name,
    kind: resolveStudyKind(study.type),
    type: study.type,
    form: study.form,
    status: study.status,
    start_year: study.start_year,
    end_year: study.end_year ?? null,
    is_public: !!study.is_public,
    public_slug: study.public_slug ?? null,
    final_exams_enabled: !!study.final_exams_enabled,
    tasks_enabled: !!study.tasks_enabled,
    exam_scheduler_enabled: !!study.exam_scheduler_enabled,
  }
}

// Applies the rules the study forms enforce, against the study as it will be saved.
async function prepareStudyPatch(before: Record<string, any> | null, fields: StudyFields) {
  const patch: Record<string, any> = emptyToNull(fields)
  const merged = { ...(before ?? {}), ...patch }

  if (merged.end_year != null && merged.start_year != null && merged.end_year < merged.start_year) {
    throw new ToolError("end_year cannot be before start_year.")
  }

  if (merged.status !== STUDY_STATUS.COMPLETED) {
    if (patch.graduation_result) throw new ToolError("graduation_result only applies to completed studies.")
    if (before?.graduation_result) patch.graduation_result = null
  }

  if (patch.exam_scheduler_enabled === true && merged.status !== STUDY_STATUS.ACTIVE) {
    throw new ToolError("The exam scheduler can only be enabled for active studies.")
  }

  if ("is_public" in patch || "public_slug" in patch || "public_description" in patch) {
    if (!merged.is_public) {
      if (patch.public_slug || patch.public_description) {
        throw new ToolError("Set is_public to true to give the study a public address or description.")
      }
      // Turning sharing off clears the address (see CLAUDE.md, sharing dialogs).
      patch.is_public = false
      patch.public_slug = null
      patch.public_description = null
    } else {
      const slug = merged.public_slug
      if (!slug) throw new ToolError("A public study needs public_slug.")
      if (RESERVED_ROUTES.includes(slug)) throw new ToolError(`The address „${slug}“ is reserved.`)
      if (slug !== before?.public_slug && !(await db.checkStudySlugAvailability(slug, before?._id))) {
        throw new ToolError(`The address „${slug}“ is taken.`)
      }
    }
  }

  return patch
}

export const studyTools = [
  defineTool({
    name: "list_studies",
    title: "List studies",
    description:
      "All studies (university and high school) with their status and enabled features. Start here to find study ids.",
    access: "read",
    input: {},
    handler: async () => (await db.getStudies()).map(summarize),
  }),

  defineTool({
    name: "get_study",
    title: "Get study",
    description: "One study with all its stored settings.",
    access: "read",
    input: { study_id: recordId },
    handler: async ({ study_id }) => {
      const doc = requireDoc(await db.getStudyById(study_id), "Study", study_id)
      return { ...db.normalizeId(doc), kind: resolveStudyKind(doc.type) }
    },
  }),

  defineTool({
    name: "create_study",
    title: "Create study",
    description: "Create a study. Needs name, type, form, start_year and status.",
    access: "write",
    input: { fields: studyFields },
    handler: async ({ fields }, ctx) => {
      requireFields(fields, ["name", "type", "form", "start_year", "status"], "A study")
      const patch = await prepareStudyPatch(null, fields)
      return commitCreate({ ctx, tool: "create_study", collection: "studies" }, () => db.createStudy(patch))
    },
  }),

  defineTool({
    name: "update_study",
    title: "Update study",
    description: "Change study fields. Only the given fields change; null clears a field.",
    access: "write",
    input: { study_id: recordId, fields: studyFields, dry_run: dryRun },
    handler: async ({ study_id, fields, dry_run }, ctx) => {
      const before = requireDoc(await db.getStudyById(study_id), "Study", study_id)
      const patch = await prepareStudyPatch(before, fields)
      return commitUpdate({
        ctx,
        tool: "update_study",
        collection: "studies",
        before,
        patch,
        dryRun: dry_run,
        write: (p) => db.updateStudy(study_id, p),
        reload: () => db.getStudyById(study_id),
      })
    },
  }),

  defineTool({
    name: "delete_study",
    title: "Delete study",
    description:
      "Permanently delete a study with all its subjects, final exams, tasks, notes, materials and exam periods. " +
      "Refused for studies that have OneDrive backup copies (delete those in the app). Try dry_run first.",
    access: "delete",
    input: { study_id: recordId, dry_run: dryRun },
    handler: async ({ study_id, dry_run }, ctx) => {
      const before = requireDoc(await db.getStudyById(study_id), "Study", study_id)

      const cacheIds = await db.getCacheOneDriveIdsByStudyId(study_id)
      if (cacheIds.length > 0) {
        throw new ToolError(
          `This study has ${cacheIds.length} backup copies on OneDrive. Delete it in the app so they are removed too.`
        )
      }

      const [subjects, finalExams, tasks, notes, materials, subjectMaterials, periods] = await Promise.all([
        db.getSubjectsByStudyId(study_id),
        db.getFinalExamsByStudyId(study_id),
        db.getTasksByStudyId(study_id),
        db.getStudyNotesByStudyId(study_id),
        db.getMaterialsByStudyId(study_id),
        db.getSubjectMaterialsByStudyId(study_id),
        db.getExamPeriodsByStudyId(study_id),
      ])
      const terms = await db.getExamTermsByPeriodIds(periods.map((p) => String(p._id)))

      return commitDelete({
        ctx,
        tool: "delete_study",
        collection: "studies",
        before,
        dryRun: dry_run,
        cascade: {
          subjects: subjects.length,
          final_exams: finalExams.length,
          tasks: tasks.length,
          notes: notes.length,
          materials: materials.length + subjectMaterials.length,
          exam_periods: periods.length,
          exam_terms: terms.length,
        },
        remove: () => db.deleteStudy(study_id),
      })
    },
  }),
]
