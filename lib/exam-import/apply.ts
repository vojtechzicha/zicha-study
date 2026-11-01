import * as db from "@/lib/mongodb/db"
import { EXAM_TERM_SOURCE_LABELS } from "@/lib/constants"
import { planImport, type ImportPlan } from "@/lib/exam-import/plan"
import type { ImportRequest } from "@/lib/exam-import/schema"

// Loads what the planner needs, applies its operations and logs every audited write to
// mcp_audit (tool "exam_import"), so list_recent_changes shows synced changes too.

export function pragueToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}

export interface ImportResult {
  dry_run: boolean
  counts: { created: number; updated: number; deleted: number; unchanged: number; skipped: number }
  events: ImportPlan["events"]
  skipped: ImportPlan["skipped"]
  warnings: string[]
}

function summarize(plan: ImportPlan, dryRun: boolean): ImportResult {
  return {
    dry_run: dryRun,
    counts: {
      created: plan.ops.filter((o) => o.op === "create").length,
      updated: plan.ops.filter((o) => o.op === "update").length,
      deleted: plan.ops.filter((o) => o.op === "delete").length,
      unchanged: plan.unchanged,
      skipped: plan.skipped.length,
    },
    events: plan.events,
    skipped: plan.skipped,
    warnings: plan.warnings,
  }
}

export async function runExamTermImport(body: ImportRequest, study: Record<string, any>): Promise<ImportResult> {
  const studyId = String(study._id)
  const periods = await db.getExamPeriodsByStudyId(studyId)
  const [subjects, terms, dismissed] = await Promise.all([
    db.getSubjectsByStudyId(studyId),
    db.getExamTermsByPeriodIds(periods.map((p) => String(p._id))),
    db.getExamTermDismissals(studyId, body.source),
  ])
  const now = new Date()
  const plan = planImport({
    source: body.source,
    today: pragueToday(now),
    now: now.toISOString(),
    complete: body.complete,
    periods,
    subjects,
    terms,
    dismissed: new Set(dismissed),
    incoming: body.terms,
  })
  if (body.dry_run) return summarize(plan, true)
  await db.ensureExamTermImportIndexes()

  const auditBase = {
    tool: "exam_import",
    collection: "exam_terms",
    grant_id: null,
    client_name: `${EXAM_TERM_SOURCE_LABELS[body.source]} sync`,
    email: null,
  }
  async function applyOp(op: (typeof plan.ops)[number]) {
    if (op.op === "create") {
      const doc = db.normalizeId(await db.createExamTerm(op.doc))!
      for (const e of plan.events) if (e.external_id === op.doc.external_id && e.term_id === null) e.term_id = doc.id
      await db.insertMcpAuditEntry({ ...auditBase, action: "create", document_id: doc.id, before: null, after: doc })
    } else if (op.op === "update") {
      await db.updateExamTerm(op.id, op.patch, { by: "import" })
      if (op.audit) {
        const after = db.normalizeId(await db.getExamTermById(op.id))
        await db.insertMcpAuditEntry({ ...auditBase, action: "update", document_id: op.id, before: db.normalizeId(op.before), after })
      }
    } else {
      await db.deleteExamTerm(op.id, { dismiss: false })
      await db.insertMcpAuditEntry({ ...auditBase, action: "delete", document_id: op.id, before: db.normalizeId(op.before), after: null })
    }
  }

  for (const op of plan.ops) {
    try {
      await applyOp(op)
    } catch (err: any) {
      // The unique index on (study, source, external id): an overlapping import got there first.
      if (err?.code !== 11000) throw err
      const externalId = op.op === "create" ? op.doc.external_id : op.op === "update" ? (op.patch.external_id ?? op.before.external_id) : op.before.external_id
      plan.warnings.push(`Term ${externalId} was written by another import at the same time; skipped.`)
      plan.ops = plan.ops.filter((o) => o !== op)
      plan.events = plan.events.filter((e) => e.external_id !== externalId)
    }
  }

  const result = summarize(plan, false)
  await db.upsertAppSettings({
    [`exam_import_runs.${studyId}`]: { source: body.source, at: now.toISOString(), counts: result.counts, warnings: result.warnings },
  })
  return result
}
