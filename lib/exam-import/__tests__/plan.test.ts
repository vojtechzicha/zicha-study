import { describe, expect, it } from "vitest"
import { partIdsForForm, periodAssessment, pickPeriod, planImport, type PlanInput } from "@/lib/exam-import/plan"
import { importRequestSchema, importedTermSchema, type ImportedTerm } from "@/lib/exam-import/schema"

// Synthetic study: one subject split into written + oral, one with both a credit and an exam
// period, one only in the exam period.

const NOW = "2026-11-01T10:00:00.000Z"
const TODAY = "2026-11-01"

const periods = [
  { _id: "per-credit", study_id: "st", name: "Zápočet (ZS 2026/2027)", start_date: "2026-12-14", due_date: "2026-12-20", subject_ids: ["sub-fin"] },
  {
    _id: "per-exam",
    study_id: "st",
    name: "Zkoušky (ZS 2026/2027)",
    start_date: "2027-01-04",
    due_date: "2027-02-07",
    subject_ids: ["sub-fin", "sub-eko", "sub-vom"],
    exam_parts: {
      "sub-eko": { parts: [{ id: "p1", label: "Písemná" }, { id: "p2", label: "Ústní" }], ordered: true },
    },
  },
  { _id: "per-old", study_id: "st", name: "Zkoušky (LS 2025/2026)", start_date: "2026-05-01", due_date: "2026-06-30", subject_ids: ["sub-old"] },
]

const subjects = [
  { _id: "sub-fin", study_id: "st", abbreviation: "FIN01", name: "Finance" },
  { _id: "sub-eko", study_id: "st", abbreviation: "EKO01", name: "Ekonomika" },
  { _id: "sub-vom", study_id: "st", abbreviation: "VOM01", name: "Velkoobchod" },
  { _id: "sub-old", study_id: "st", abbreviation: "OLD01", name: "Starý", completed: true },
]

function term(overrides: Partial<ImportedTerm> = {}): ImportedTerm {
  return importedTermSchema.parse({
    external_id: "1001",
    subject_code: "VOM01",
    date: "2027-01-12",
    start_time: "09:00",
    assessment: "exam",
    status: "available",
    ...overrides,
  })
}

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return { source: "uis", today: TODAY, now: NOW, complete: true, periods, subjects, terms: [], incoming: [], ...overrides }
}

function synced(overrides: Record<string, any> = {}) {
  return {
    _id: "t-1",
    period_id: "per-exam",
    study_id: "st",
    subject_id: "sub-vom",
    date: "2027-01-12",
    start_time: "09:00",
    duration_minutes: 120,
    is_online: false,
    note: null,
    locked: false,
    part_ids: [],
    is_pre_term: false,
    is_tentative: false,
    source: "uis",
    external_id: "1001",
    external: {
      kind: null, term_type: null, room: null, examiners: null, listed_by: null, capacity: null, registered_count: null,
      registration_from: null, registration_to: null, deregistration_to: null, status: "available", status_note: null,
      auto_locked: false, removed_at: null, synced_at: "2026-10-31T10:00:00.000Z",
    },
    ...overrides,
  }
}

describe("period helpers", () => {
  it("reads the assessment from the period name", () => {
    expect(periodAssessment("Zápočet (ZS 2026/2027)")).toBe("credit")
    expect(periodAssessment("Zkoušky (LS)")).toBe("exam")
    expect(periodAssessment("Zkouškové období")).toBe("exam")
    expect(periodAssessment("Zápočet + zkouška")).toBeNull()
    expect(periodAssessment("Období")).toBeNull()
  })

  it("matches the exam form to parts", () => {
    const config = periods[1].exam_parts!["sub-eko"]
    expect(partIdsForForm(config, "písemná")).toEqual(["p1"])
    expect(partIdsForForm(config, "Ústní")).toEqual(["p2"])
    expect(partIdsForForm(config, "písemná a ústní")).toEqual([])
    expect(partIdsForForm(config, "kombinovaná")).toEqual([])
    expect(partIdsForForm(undefined, "písemná")).toEqual([])
  })

  it("sends credits and exams of one subject to their own periods", () => {
    const active = periods.slice(0, 2)
    expect(pickPeriod(term({ subject_code: "FIN01", assessment: "credit", date: "2026-12-10" }), "sub-fin", active).period?._id).toBe("per-credit")
    expect(pickPeriod(term({ subject_code: "FIN01", assessment: "exam", date: "2026-12-16" }), "sub-fin", active).period?._id).toBe("per-exam")
  })

  it("never puts a credit term into an exam-only period", () => {
    expect(pickPeriod(term({ assessment: "credit" }), "sub-vom", periods.slice(0, 2)).reason).toBe("no_period")
  })

  it("falls back to the date when the assessment is unknown", () => {
    const active = periods.slice(0, 2)
    expect(pickPeriod(term({ assessment: null, date: "2026-12-15" }), "sub-fin", active).period?._id).toBe("per-credit")
    expect(pickPeriod(term({ assessment: null, date: "2027-01-20" }), "sub-fin", active).period?._id).toBe("per-exam")
    // Before both periods: the nearest one that starts later.
    expect(pickPeriod(term({ assessment: null, date: "2026-12-01" }), "sub-fin", active).period?._id).toBe("per-credit")
    // After both: ambiguous.
    expect(pickPeriod(term({ assessment: null, date: "2027-03-01" }), "sub-fin", active).reason).toBe("ambiguous_period")
  })
})

describe("planImport: new terms", () => {
  it("creates a term with the source details", () => {
    const plan = planImport(input({ incoming: [term({ room: "AII", capacity: 30, registered_count: 4, registration_from: "2026-11-30T00:00" })] }))
    expect(plan.ops).toHaveLength(1)
    const op = plan.ops[0]
    expect(op.op).toBe("create")
    if (op.op !== "create") return
    expect(op.doc).toMatchObject({
      period_id: "per-exam",
      subject_id: "sub-vom",
      date: "2027-01-12",
      start_time: "09:00",
      duration_minutes: 120,
      locked: false,
      is_pre_term: false,
      is_tentative: false,
      source: "uis",
      external_id: "1001",
      external: { room: "AII", capacity: 30, registered_count: 4, status: "available", registration_from: "2026-11-30T00:00" },
    })
    expect(plan.events.map((e) => e.type)).toEqual(["created"])
    expect(plan.events[0]).toMatchObject({ subject_name: "Velkoobchod", period_name: "Zkoušky (ZS 2026/2027)" })
  })

  it("marks předtermíny, parts, online rooms and the duration", () => {
    const plan = planImport(
      input({ incoming: [term({ subject_code: "eko01", date: "2026-12-13", end_time: "10:30", form: "písemná", room: "Online (MS Teams)" })] })
    )
    const op = plan.ops[0]
    if (op.op !== "create") throw new Error("expected create")
    expect(op.doc).toMatchObject({ is_pre_term: true, part_ids: ["p1"], is_online: true, duration_minutes: 90 })
  })

  it("locks a term the student is already registered for", () => {
    const plan = planImport(input({ incoming: [term({ status: "registered" })] }))
    const op = plan.ops[0]
    if (op.op !== "create") throw new Error("expected create")
    expect(op.doc.locked).toBe(true)
    expect(op.doc.external.auto_locked).toBe(true)
    expect(plan.events.map((e) => e.type)).toEqual(["created", "registered"])
  })

  it("skips terms the user deleted", () => {
    const plan = planImport(input({ incoming: [term()], dismissed: new Set(["1001"]) }))
    expect(plan.ops).toHaveLength(0)
    expect(plan.skipped[0].reason).toBe("dismissed")
  })

  it("skips resits, unknown subjects and subjects without a current period", () => {
    const plan = planImport(
      input({
        incoming: [
          term({ external_id: "a", attempt: "resit" }),
          term({ external_id: "b", subject_code: "NOPE" }),
          term({ external_id: "c", subject_code: "OLD01" }),
        ],
      })
    )
    expect(plan.ops).toHaveLength(0)
    expect(plan.skipped.map((s) => [s.external_id, s.reason])).toEqual([
      ["a", "resit"],
      ["b", "unknown_subject"],
      ["c", "no_period"],
    ])
  })
})

describe("planImport: adopting a term entered by hand", () => {
  const manual = {
    _id: "t-manual",
    period_id: "per-exam",
    study_id: "st",
    subject_id: "sub-vom",
    date: "2026-12-13",
    start_time: "15:45",
    duration_minutes: 120,
    locked: true,
    note: "my note",
    is_pre_term: true,
    is_tentative: true,
  }

  it("confirms the tentative term instead of adding a second one", () => {
    const plan = planImport(input({ terms: [manual], incoming: [term({ date: "2026-12-13", start_time: "15:45", room: "AII" })] }))
    expect(plan.ops).toHaveLength(1)
    const op = plan.ops[0]
    if (op.op !== "update") throw new Error("expected update")
    expect(op.id).toBe("t-manual")
    expect(op.patch).toMatchObject({ source: "uis", external_id: "1001", is_tentative: false, is_pre_term: true })
    expect(op.patch).not.toHaveProperty("locked")
    expect(op.patch).not.toHaveProperty("note")
    expect(plan.events[0].type).toBe("adopted")
  })

  it("adopts a term of the same day even when the time differs", () => {
    const plan = planImport(input({ terms: [manual], incoming: [term({ date: "2026-12-13", start_time: "16:00" })] }))
    const op = plan.ops[0]
    expect(op.op === "update" && op.patch.start_time).toBe("16:00")
  })

  it("adopts one manual term only once", () => {
    const plan = planImport(
      input({
        terms: [manual],
        incoming: [term({ external_id: "x", date: "2026-12-13" }), term({ external_id: "y", date: "2026-12-13", start_time: "18:00" })],
      })
    )
    expect(plan.ops.map((o) => o.op)).toEqual(["update", "create"])
  })
})

describe("planImport: terms synced before", () => {
  it("does nothing when nothing changed", () => {
    const plan = planImport(input({ terms: [synced()], incoming: [term()] }))
    expect(plan.ops).toHaveLength(0)
    expect(plan.unchanged).toBe(1)
  })

  it("moves a rescheduled term", () => {
    const plan = planImport(input({ terms: [synced()], incoming: [term({ start_time: "10:00" })] }))
    const op = plan.ops[0]
    expect(op.op === "update" && op.audit).toBe(true)
    expect(plan.events[0]).toMatchObject({ type: "rescheduled", changes: { start_time: { from: "09:00", to: "10:00" } } })
  })

  it("refreshes the number of registered students without logging it", () => {
    const plan = planImport(input({ terms: [synced()], incoming: [term({ registered_count: 7 })] }))
    const op = plan.ops[0]
    expect(op.op === "update" && op.audit).toBe(false)
    expect(plan.events).toHaveLength(0)
  })

  it("keeps the user's duration when the source has no end time", () => {
    const plan = planImport(input({ terms: [synced({ duration_minutes: 45 })], incoming: [term({ room: "B" })] }))
    const op = plan.ops[0]
    expect(op.op === "update" && op.patch).not.toHaveProperty("duration_minutes")
  })

  it("locks on registration and unlocks its own lock on deregistration", () => {
    const first = planImport(input({ terms: [synced()], incoming: [term({ status: "registered" })] }))
    const op = first.ops[0]
    if (op.op !== "update") throw new Error("expected update")
    expect(op.patch.locked).toBe(true)
    expect(op.patch.external.auto_locked).toBe(true)
    expect(first.events.map((e) => e.type)).toEqual(["registered"])

    const locked = synced({ locked: true, external: { ...synced().external, status: "registered", auto_locked: true } })
    const second = planImport(input({ terms: [locked], incoming: [term({ status: "available" })] }))
    const op2 = second.ops[0]
    if (op2.op !== "update") throw new Error("expected update")
    expect(op2.patch.locked).toBe(false)
    expect(second.events.map((e) => e.type)).toEqual(["deregistered"])
  })

  it("leaves a lock the user set when the student deregisters", () => {
    const locked = synced({ locked: true, external: { ...synced().external, status: "registered", auto_locked: false } })
    const plan = planImport(input({ terms: [locked], incoming: [term({ status: "available" })] }))
    const op = plan.ops[0]
    expect(op.op === "update" && op.patch).not.toHaveProperty("locked")
  })

  it("keeps the period of a synced term", () => {
    const plan = planImport(input({ terms: [synced()], incoming: [term({ date: "2027-02-20" })] }))
    const op = plan.ops[0]
    expect(op.op === "update" && op.patch).not.toHaveProperty("period_id")
  })
})

describe("planImport: terms the source dropped", () => {
  it("deletes unlocked terms and flags locked ones", () => {
    const plan = planImport(
      input({
        terms: [synced(), synced({ _id: "t-2", external_id: "1002", locked: true })],
        incoming: [term({ external_id: "9999", date: "2027-01-20" })],
      })
    )
    expect(plan.ops.map((o) => [o.op, o.op === "create" ? null : o.id])).toEqual([
      ["create", null],
      ["delete", "t-1"],
      ["update", "t-2"],
    ])
    const flag = plan.ops[2]
    expect(flag.op === "update" && flag.patch.external.removed_at).toBe(NOW)
    expect(plan.events.map((e) => e.type)).toEqual(["created", "removed", "removed_locked"])
    expect(plan.events[1].subject_code).toBe("VOM01")
  })

  it("flags a locked term only once and restores it when it comes back", () => {
    const flagged = synced({ locked: true, external: { ...synced().external, removed_at: "2026-10-31T00:00:00.000Z" } })
    const again = planImport(input({ terms: [flagged], incoming: [term({ external_id: "other", date: "2027-01-21" })] }))
    expect(again.ops.filter((o) => o.op !== "create")).toHaveLength(0)

    const back = planImport(input({ terms: [flagged], incoming: [term()] }))
    expect(back.events.map((e) => e.type)).toEqual(["restored"])
    const op = back.ops[0]
    expect(op.op === "update" && op.patch.external.removed_at).toBeNull()
  })

  it("keeps past terms, terms of past periods and everything on a partial snapshot", () => {
    const past = synced({ _id: "t-past", external_id: "p", date: "2026-10-20" })
    const oldPeriod = synced({ _id: "t-old", external_id: "o", period_id: "per-old", date: "2026-12-01" })
    const other = term({ external_id: "z", date: "2027-01-22" })
    expect(planImport(input({ terms: [past, oldPeriod], incoming: [other] })).ops.map((o) => o.op)).toEqual(["create"])
    expect(planImport(input({ terms: [synced()], incoming: [other], complete: false })).ops.map((o) => o.op)).toEqual(["create"])
  })

  it("refuses to remove anything on an empty snapshot", () => {
    const plan = planImport(input({ terms: [synced()], incoming: [] }))
    expect(plan.ops).toHaveLength(0)
    expect(plan.warnings[0]).toMatch(/empty/)
  })

  it("does not remove a term only because it is now skipped", () => {
    const plan = planImport(input({ terms: [synced()], incoming: [term({ attempt: "resit", start_time: "11:00" })] }))
    expect(plan.ops.some((o) => o.op === "delete")).toBe(false)
  })
})

describe("import request schema", () => {
  const body = { study_id: "st", source: "uis", complete: true, terms: [{ external_id: "1", subject_code: "A", date: "2027-01-01", start_time: "09:00", status: "available" }] }

  it("fills defaults", () => {
    const parsed = importRequestSchema.parse(body)
    expect(parsed.dry_run).toBe(false)
    expect(parsed.terms[0]).toMatchObject({ room: null, capacity: null, assessment: null, end_time: null })
  })

  it("turns empty strings into null", () => {
    const parsed = importRequestSchema.parse({ ...body, terms: [{ ...body.terms[0], room: "  " }] })
    expect(parsed.terms[0].room).toBeNull()
  })

  it("rejects duplicate ids, unknown fields and bad dates", () => {
    expect(importRequestSchema.safeParse({ ...body, terms: [body.terms[0], body.terms[0]] }).success).toBe(false)
    expect(importRequestSchema.safeParse({ ...body, terms: [{ ...body.terms[0], extra: 1 }] }).success).toBe(false)
    expect(importRequestSchema.safeParse({ ...body, terms: [{ ...body.terms[0], date: "1.1.2027" }] }).success).toBe(false)
    expect(importRequestSchema.safeParse({ ...body, source: "stag" }).success).toBe(false)
  })
})
