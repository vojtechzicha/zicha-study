import { z } from "zod"
import * as db from "@/lib/mongodb/db"
import { getTaskState } from "@/lib/constants"
import { dryRun, emptyToNull, isoDate, optionalText, recordId, requireFields, text } from "@/lib/mcp/schemas"
import { ToolError, commitCreate, commitDelete, commitUpdate, defineTool, requireDoc } from "@/lib/mcp/tool-kit"

const taskFields = z
  .object({
    title: text(200),
    description: optionalText(5000),
    start_date: isoDate.nullable(),
    deadline: isoDate,
    completed: z.boolean().describe("Mark the task done (stores completed_at) or reopen it."),
  })
  .partial()
  .strict()

function prepareTaskPatch(before: Record<string, any> | null, fields: z.infer<typeof taskFields>) {
  const { completed, ...rest } = fields
  const patch: Record<string, any> = emptyToNull(rest)
  if (completed !== undefined) {
    // Keep the original completion time when a done task is saved as done again.
    patch.completed_at = completed ? before?.completed_at || new Date().toISOString() : null
  }
  const merged = { ...(before ?? {}), ...patch }
  if (merged.start_date && merged.deadline && merged.start_date > merged.deadline) {
    throw new ToolError("start_date cannot be after deadline.")
  }
  return patch
}

function withState(task: Record<string, any> | null) {
  const doc = db.normalizeId(task)
  return doc ? { ...doc, state: getTaskState(doc as any) } : null
}

export const taskTools = [
  defineTool({
    name: "list_tasks",
    title: "List tasks",
    description:
      "Tasks of a study, with their state (overdue, running, upcoming, completed). Without study_id: tasks of all studies that have tasks enabled.",
    access: "read",
    input: { study_id: recordId.optional() },
    handler: async ({ study_id }) => {
      if (study_id) {
        requireDoc(await db.getStudyById(study_id), "Study", study_id)
        return (await db.getTasksByStudyId(study_id)).map(withState)
      }
      const rows = await db.getAllTasksWithStudyMeta()
      return rows.map((r) => ({ ...withState(r.task), study_name: r.study.name }))
    },
  }),

  defineTool({
    name: "create_task",
    title: "Create task",
    description: "Add a task to a study. Needs title and deadline.",
    access: "write",
    input: { study_id: recordId, fields: taskFields },
    handler: async ({ study_id, fields }, ctx) => {
      requireDoc(await db.getStudyById(study_id), "Study", study_id)
      requireFields(fields, ["title", "deadline"], "A task")
      const patch = prepareTaskPatch(null, fields)
      return commitCreate({ ctx, tool: "create_task", collection: "tasks" }, () =>
        db.createTask({ study_id, description: null, start_date: null, completed_at: null, ...patch })
      )
    },
  }),

  defineTool({
    name: "update_task",
    title: "Update task",
    description: "Change task fields or mark it done. Only the given fields change; null clears a field.",
    access: "write",
    input: { task_id: recordId, fields: taskFields, dry_run: dryRun },
    handler: async ({ task_id, fields, dry_run }, ctx) => {
      const before = requireDoc(await db.getTaskById(task_id), "Task", task_id)
      return commitUpdate({
        ctx,
        tool: "update_task",
        collection: "tasks",
        before,
        patch: prepareTaskPatch(before, fields),
        dryRun: dry_run,
        write: (p) => db.updateTask(task_id, p),
        reload: () => db.getTaskById(task_id),
      })
    },
  }),

  defineTool({
    name: "delete_task",
    title: "Delete task",
    description: "Permanently delete a task.",
    access: "delete",
    input: { task_id: recordId, dry_run: dryRun },
    handler: async ({ task_id, dry_run }, ctx) => {
      const before = requireDoc(await db.getTaskById(task_id), "Task", task_id)
      return commitDelete({
        ctx,
        tool: "delete_task",
        collection: "tasks",
        before,
        dryRun: dry_run,
        remove: () => db.deleteTask(task_id),
      })
    },
  }),
]
