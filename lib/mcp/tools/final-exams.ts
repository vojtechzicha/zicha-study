import { z } from "zod"
import * as db from "@/lib/mongodb/db"
import { getStudyTerminology } from "@/lib/study-kind"
import { dryRun, emptyToNull, isoDate, optionalText, recordId, requireFields, text } from "@/lib/mcp/schemas"
import { ToolError, commitCreate, commitDelete, commitUpdate, defineTool, requireDoc } from "@/lib/mcp/tool-kit"

// Státní závěrečná zkouška (university) or maturita (high school).
const finalExamFields = z
  .object({
    name: text(200),
    shortcut: optionalText(20),
    grade: optionalText(5).describe('University: "A"–"F" or "N"; high school: "1"–"5".'),
    exam_date: isoDate.nullable(),
    examiner: optionalText(200),
    examination_committee_head: optionalText(200),
  })
  .partial()
  .strict()

function prepareFinalExamPatch(study: Record<string, any>, fields: z.infer<typeof finalExamFields>) {
  const patch: Record<string, any> = emptyToNull(fields)
  const grades = getStudyTerminology(study.type).finalExamGrades
  if (patch.grade && !grades.includes(patch.grade)) {
    throw new ToolError(`grade must be one of ${grades.join(", ")} for this study.`)
  }
  return patch
}

export const finalExamTools = [
  defineTool({
    name: "list_final_exams",
    title: "List final exams",
    description: "Final exams of a study (státní závěrečná zkouška or maturita subjects).",
    access: "read",
    input: { study_id: recordId },
    handler: async ({ study_id }) => {
      requireDoc(await db.getStudyById(study_id), "Study", study_id)
      return db.normalizeIds(await db.getFinalExamsByStudyId(study_id))
    },
  }),

  defineTool({
    name: "create_final_exam",
    title: "Create final exam",
    description: "Add a final exam subject to a study. Needs name.",
    access: "write",
    input: { study_id: recordId, fields: finalExamFields },
    handler: async ({ study_id, fields }, ctx) => {
      const study = requireDoc(await db.getStudyById(study_id), "Study", study_id)
      requireFields(fields, ["name"], "A final exam")
      const patch = prepareFinalExamPatch(study, fields)
      return commitCreate({ ctx, tool: "create_final_exam", collection: "final_exams" }, () =>
        db.createFinalExam({
          study_id,
          shortcut: null,
          grade: null,
          exam_date: null,
          examiner: null,
          examination_committee_head: null,
          ...patch,
        })
      )
    },
  }),

  defineTool({
    name: "update_final_exam",
    title: "Update final exam",
    description: "Change final exam fields. Only the given fields change; null clears a field.",
    access: "write",
    input: { final_exam_id: recordId, fields: finalExamFields, dry_run: dryRun },
    handler: async ({ final_exam_id, fields, dry_run }, ctx) => {
      const before = requireDoc(await db.getFinalExamById(final_exam_id), "Final exam", final_exam_id)
      const study = requireDoc(await db.getStudyById(before.study_id), "Study", before.study_id)
      return commitUpdate({
        ctx,
        tool: "update_final_exam",
        collection: "final_exams",
        before,
        patch: prepareFinalExamPatch(study, fields),
        dryRun: dry_run,
        write: (p) => db.updateFinalExam(final_exam_id, p),
        reload: () => db.getFinalExamById(final_exam_id),
      })
    },
  }),

  defineTool({
    name: "delete_final_exam",
    title: "Delete final exam",
    description: "Permanently delete a final exam.",
    access: "delete",
    input: { final_exam_id: recordId, dry_run: dryRun },
    handler: async ({ final_exam_id, dry_run }, ctx) => {
      const before = requireDoc(await db.getFinalExamById(final_exam_id), "Final exam", final_exam_id)
      return commitDelete({
        ctx,
        tool: "delete_final_exam",
        collection: "final_exams",
        before,
        dryRun: dry_run,
        remove: () => db.deleteFinalExam(final_exam_id),
      })
    },
  }),
]
