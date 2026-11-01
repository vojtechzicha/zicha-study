import { beforeEach, describe, expect, it, vi } from "vitest"

// In-memory exam_terms behind the db functions runExamTermImport uses.
const store = vi.hoisted(() => ({
  terms: new Map<string, Record<string, any>>(),
  audit: [] as Record<string, any>[],
  settings: {} as Record<string, any>,
  dismissed: [] as string[],
  deleteOptions: [] as unknown[],
  updateOptions: [] as unknown[],
  failCreate: false,
  seq: 0,
}))

vi.mock("@/lib/mongodb/db", () => ({
  getExamPeriodsByStudyId: async () => [
    { _id: "per-exam", study_id: "st", name: "Zkoušky (ZS)", start_date: "2099-01-04", due_date: "2099-02-07", subject_ids: ["sub-a"] },
  ],
  getSubjectsByStudyId: async () => [{ _id: "sub-a", study_id: "st", abbreviation: "AAA1", name: "Předmět A" }],
  getExamTermsByPeriodIds: async () => [...store.terms.values()],
  getExamTermById: async (id: string) => store.terms.get(id) ?? null,
  ensureExamTermImportIndexes: async () => {},
  createExamTerm: async (data: Record<string, any>) => {
    if (store.failCreate) throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 })
    const doc = { _id: `t-${++store.seq}`, ...data }
    store.terms.set(doc._id, doc)
    return doc
  },
  updateExamTerm: async (id: string, patch: Record<string, any>, options?: unknown) => {
    store.updateOptions.push(options)
    store.terms.set(id, { ...store.terms.get(id), ...patch })
  },
  deleteExamTerm: async (id: string, options?: unknown) => {
    store.deleteOptions.push(options)
    store.terms.delete(id)
  },
  getExamTermDismissals: async () => store.dismissed,
  insertMcpAuditEntry: async (entry: Record<string, any>) => {
    store.audit.push(entry)
  },
  upsertAppSettings: async (data: Record<string, any>) => {
    Object.assign(store.settings, data)
  },
  normalizeId: (doc: Record<string, any> | null) => {
    if (!doc) return null
    const { _id, ...rest } = doc
    return { id: String(_id), ...rest }
  },
}))

import { runExamTermImport } from "@/lib/exam-import/apply"
import { importRequestSchema } from "@/lib/exam-import/schema"

const request = (terms: Record<string, any>[], extra: Record<string, any> = {}) =>
  importRequestSchema.parse({ study_id: "st", source: "uis", complete: true, terms, ...extra })

const uisTerm = (overrides: Record<string, any> = {}) => ({
  external_id: "501",
  subject_code: "AAA1",
  date: "2099-01-10",
  start_time: "09:00",
  assessment: "exam",
  status: "available",
  ...overrides,
})

describe("runExamTermImport", () => {
  beforeEach(() => {
    store.terms.clear()
    store.audit.length = 0
    store.settings = {}
    store.dismissed = []
    store.deleteOptions = []
    store.updateOptions = []
    store.failCreate = false
    store.seq = 0
  })

  it("writes nothing on a dry run", async () => {
    const result = await runExamTermImport(request([uisTerm()], { dry_run: true }), { _id: "st" })
    expect(result).toMatchObject({ dry_run: true, counts: { created: 1 } })
    expect(store.terms.size).toBe(0)
    expect(store.audit).toHaveLength(0)
  })

  it("creates, logs and reports the new term id", async () => {
    const result = await runExamTermImport(request([uisTerm()]), { _id: "st" })
    expect(result.counts).toMatchObject({ created: 1, updated: 0, deleted: 0 })
    expect(result.events[0]).toMatchObject({ type: "created", term_id: "t-1", subject_name: "Předmět A" })
    expect(store.audit[0]).toMatchObject({ tool: "exam_import", action: "create", client_name: "UIS sync", grant_id: null })
    expect(store.settings["exam_import_runs.st"]).toMatchObject({ source: "uis", counts: { created: 1 } })
  })

  it("is idempotent and logs only meaningful updates", async () => {
    await runExamTermImport(request([uisTerm()]), { _id: "st" })
    const again = await runExamTermImport(request([uisTerm()]), { _id: "st" })
    expect(again.counts).toMatchObject({ created: 0, updated: 0, unchanged: 1 })

    await runExamTermImport(request([uisTerm({ registered_count: 3 })]), { _id: "st" })
    expect(store.terms.get("t-1")!.external.registered_count).toBe(3)
    expect(store.audit).toHaveLength(1)

    await runExamTermImport(request([uisTerm({ start_time: "10:00" })]), { _id: "st" })
    expect(store.terms.get("t-1")!.start_time).toBe("10:00")
    expect(store.audit.map((a) => a.action)).toEqual(["create", "update"])
    // The importer's own updates never take lock ownership away from it.
    expect(store.updateOptions.every((o) => (o as any)?.by === "import")).toBe(true)
  })

  it("skips a term an overlapping import already created", async () => {
    store.failCreate = true
    const result = await runExamTermImport(request([uisTerm()]), { _id: "st" })
    expect(result.counts.created).toBe(0)
    expect(result.events).toHaveLength(0)
    expect(result.warnings[0]).toMatch(/another import/)
    expect(store.audit).toHaveLength(0)
  })

  it("deletes a cancelled term and logs it", async () => {
    await runExamTermImport(request([uisTerm()]), { _id: "st" })
    const result = await runExamTermImport(request([uisTerm({ external_id: "502", date: "2099-01-11" })]), { _id: "st" })
    expect(result.counts).toMatchObject({ created: 1, deleted: 1 })
    expect(store.terms.has("t-1")).toBe(false)
    expect(store.audit.at(-1)).toMatchObject({ action: "delete", document_id: "t-1" })
    // The source dropped it, so it is not remembered as dismissed by the user.
    expect(store.deleteOptions).toEqual([{ dismiss: false }])
  })

  it("skips terms the user deleted", async () => {
    store.dismissed = ["501"]
    const result = await runExamTermImport(request([uisTerm()]), { _id: "st" })
    expect(result.counts.created).toBe(0)
    expect(result.skipped[0]).toMatchObject({ external_id: "501", reason: "dismissed" })
  })
})
