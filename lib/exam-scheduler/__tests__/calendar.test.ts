import { describe, it, expect } from "vitest"
import {
  addDays,
  buildTrips,
  lockPriority,
  monthWeeks,
  registrationState,
  relevantMonths,
  termsToUnlock,
  weekTripSegments,
} from "../calendar"
import type { ScheduleItem } from "../types"
import type { ExamTermExternal } from "@/lib/constants"

const item = (type: ScheduleItem["type"], date: string, studyId: string, cost = 0, startTime?: string): ScheduleItem => ({
  type,
  date,
  studyId,
  startTime,
  description: "",
  cost,
})

const external = (over: Partial<ExamTermExternal>): ExamTermExternal => ({
  kind: null,
  term_type: null,
  room: null,
  examiners: null,
  listed_by: null,
  capacity: null,
  registered_count: null,
  registration_from: null,
  registration_to: null,
  deregistration_to: null,
  status: "available",
  status_note: null,
  auto_locked: false,
  removed_at: null,
  synced_at: "2026-11-01T08:00:00Z",
  ...over,
})

describe("monthWeeks", () => {
  it("covers the month in Monday-first weeks", () => {
    const weeks = monthWeeks("2027-01")
    expect(weeks[0][0]).toBe("2026-12-28")
    expect(weeks[weeks.length - 1][6]).toBe("2027-01-31")
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })

  it("adds a trailing week when the month ends mid-week", () => {
    const weeks = monthWeeks("2026-12")
    expect(weeks[weeks.length - 1]).toContain("2026-12-31")
    expect(weeks[weeks.length - 1][6]).toBe("2027-01-03")
  })
})

describe("relevantMonths", () => {
  it("lists months with content from today on, skipping empty ones", () => {
    const months = relevantMonths(["2026-10-20", "2026-11-21"], [{ start: "2027-01-04", end: "2027-02-07" }, { start: "2027-05-10", end: "2027-06-30" }], "2026-11-01")
    expect(months).toEqual(["2026-11", "2027-01", "2027-02", "2027-05", "2027-06"])
  })
})

describe("buildTrips", () => {
  it("joins travel and nights of one study into a trip", () => {
    const trips = buildTrips([
      item("travel_to", "2027-01-11", "a", 200, "14:00"),
      item("accommodation", "2027-01-11", "a", 2000),
      item("exam", "2027-01-12", "a"),
      item("travel_from", "2027-01-12", "a", 200, "09:00"),
      item("travel_to", "2027-01-20", "b", 300),
      item("travel_from", "2027-01-20", "b", 300),
    ])
    expect(trips).toEqual([
      { studyId: "a", start: "2027-01-11", end: "2027-01-12", nights: ["2027-01-11"], departTime: "14:00", returnTime: "09:00", cost: 2400 },
      { studyId: "b", start: "2027-01-20", end: "2027-01-20", nights: [], departTime: null, returnTime: null, cost: 600 },
    ])
  })
})

describe("weekTripSegments", () => {
  it("clips trips to the week and stacks overlapping ones", () => {
    const week = Array.from({ length: 7 }, (_, i) => addDays("2027-01-04", i))
    const segs = weekTripSegments(week, [
      { studyId: "a", start: "2027-01-02", end: "2027-01-05", nights: [], departTime: null, returnTime: null, cost: 0 },
      { studyId: "b", start: "2027-01-05", end: "2027-01-05", nights: [], departTime: null, returnTime: null, cost: 0 },
      { studyId: "a", start: "2027-01-09", end: "2027-01-12", nights: [], departTime: null, returnTime: null, cost: 0 },
    ])
    expect(segs.map((s) => [s.colStart, s.colEnd, s.startsHere, s.endsHere, s.lane])).toEqual([
      [0, 1, false, true, 0],
      [1, 1, true, true, 1],
      [5, 6, true, false, 0],
    ])
  })
})

describe("termsToUnlock", () => {
  const parts = { parts: [{ id: "p1", label: "Písemná" }, { id: "p2", label: "Ústní" }], ordered: true }

  it("releases the other lock of a plain subject", () => {
    expect(termsToUnlock([{ id: "1", locked: true }, { id: "2", locked: false }], "2")).toEqual(["1"])
  })

  it("keeps a lock on a different part of a split exam", () => {
    const terms = [
      { id: "1", locked: true, part_ids: ["p1"] },
      { id: "2", locked: true, part_ids: ["p2"] },
      { id: "3", locked: false, part_ids: ["p1"] },
    ]
    expect(termsToUnlock(terms, "3", parts)).toEqual(["1"])
  })
})

describe("registrationState and lockPriority", () => {
  const now = "2026-12-01T10:00"

  it("tells open, upcoming and closed sign-ups apart", () => {
    expect(registrationState(external({ registration_from: "2026-11-30T00:00", registration_to: "2026-12-11T23:59" }), now)).toEqual({ kind: "open", until: "2026-12-11T23:59" })
    expect(registrationState(external({ registration_from: "2026-12-05T00:00" }), now)).toEqual({ kind: "opens", from: "2026-12-05T00:00" })
    expect(registrationState(external({ registration_to: "2026-11-30T00:00" }), now)).toEqual({ kind: "closed" })
    expect(registrationState(external({ status: "registered" }), now)).toEqual({ kind: "registered" })
    expect(registrationState(null, now)).toEqual({ kind: "unknown" })
  })

  it("puts open sign-ups before upcoming ones and manual terms last", () => {
    const keys = [
      lockPriority({ kind: "unknown" }, "2027-01-05"),
      lockPriority({ kind: "opens", from: "2026-12-05T00:00" }, "2027-01-20"),
      lockPriority({ kind: "open", until: "2026-12-11T23:59" }, "2027-01-25"),
    ]
    const sorted = [...keys].sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]))
    expect(sorted.map((k) => k[0])).toEqual([0, 1, 2])
  })
})
