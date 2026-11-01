import { describe, expect, it } from "vitest"
import type { VenueDay } from "@/lib/constants"
import { generateGlobalSchedule, type GlobalRequirement, type GlobalStudyConfig, type GlobalTerm } from "../global-scheduler"
import {
  anchorsOf,
  expandWindowTerm,
  parseWindowCandidateId,
  scheduleWithWindowFallback,
  venueHours,
  windowCandidateId,
  type VenueCalendar,
} from "../windows"

const day = (date: string, open_from = "08:00", open_to = "20:00", occupancy: number | null = 40): VenueDay => ({
  venue: "tc_pef",
  date,
  open_from,
  open_to,
  occupancy,
})

function calendar(days: VenueDay[], publishedThrough: string | null): VenueCalendar {
  return { days: new Map(days.map((d) => [d.date, d])), publishedThrough }
}

const window = (overrides: Partial<Parameters<typeof expandWindowTerm>[0]> = {}) => ({
  termId: "win",
  date: "2027-01-04",
  windowEnd: "2027-01-08",
  startTime: "09:00",
  durationMinutes: 60,
  isOnline: false,
  note: null,
  partIds: ["w"],
  venue: "tc_pef" as const,
  ...overrides,
})

describe("window candidate ids", () => {
  it("round-trips", () => {
    const id = windowCandidateId("abc-1", "2027-01-05", "08:00")
    expect(id).toBe("abc-1@2027-01-05T08:00")
    expect(parseWindowCandidateId(id)).toEqual({ windowId: "abc-1", date: "2027-01-05", startTime: "08:00" })
    expect(parseWindowCandidateId("plain-term-id")).toBeNull()
  })
})

describe("venueHours", () => {
  const cal = calendar([day("2027-01-04"), day("2027-01-06", "10:00", "18:00", 95)], "2027-01-06")
  it("uses published days, treats unlisted published days as closed and later ones as unknown", () => {
    expect(venueHours("tc_pef", cal, "2027-01-04")).toEqual({ open: "08:00", close: "20:00", occupancy: 40, known: true })
    expect(venueHours("tc_pef", cal, "2027-01-05")).toBeNull()
    expect(venueHours("tc_pef", cal, "2027-01-07")).toEqual({ open: "08:00", close: "20:00", occupancy: null, known: false })
    expect(venueHours("tc_pef", undefined, "2027-01-07")?.known).toBe(false)
  })
})

describe("expandWindowTerm", () => {
  const cal = calendar([day("2027-01-04"), day("2027-01-06", "10:00", "11:30")], "2027-01-06")
  const opts = { today: "2026-12-20", periodStart: "2027-01-04", calendars: { tc_pef: cal } }

  it("offers an early and a late slot per open day, skips closed days, marks unknown days tentative", () => {
    const slots = expandWindowTerm(window(), opts)
    expect(slots.map((s) => `${s.date} ${s.startTime}${s.isTentative ? "?" : ""}`)).toEqual([
      "2027-01-04 08:00",
      "2027-01-04 19:00",
      // 01-05 closed (published, not listed); 01-06 open 10:00–11:30: one slot only
      "2027-01-06 10:00",
      "2027-01-07 08:00?",
      "2027-01-07 19:00?",
      "2027-01-08 08:00?",
      "2027-01-08 19:00?",
    ])
    expect(slots.every((s) => s.partIds?.[0] === "w" && !s.locked)).toBe(true)
  })

  it("respects the study's earliest arrival and drops days too short for the test", () => {
    const slots = expandWindowTerm(window({ durationMinutes: 120 }), { ...opts, earliestArrival: "09:30" })
    expect(slots.filter((s) => s.date === "2027-01-04").map((s) => s.startTime)).toEqual(["09:30", "18:00"])
    expect(slots.some((s) => s.date === "2027-01-06")).toBe(false)
  })

  it("starts today at the earliest and marks days before the period as předtermíny", () => {
    const unpublished = { ...opts, today: "2026-12-30", calendars: {} }
    const slots = expandWindowTerm(window({ date: "2026-12-14", windowEnd: "2027-01-04" }), unpublished)
    expect(slots[0].date).toBe("2026-12-30")
    expect(slots.find((s) => s.date === "2027-01-03")?.isPreTerm).toBe(true)
    expect(slots.find((s) => s.date === "2027-01-04")?.isPreTerm).toBe(false)
  })

  it("keeps only days with another exam of the study, in the slot clear of it, plus the first and last day", () => {
    const anchors = anchorsOf([
      { date: "2027-01-06", startTime: "15:00", durationMinutes: 60 }, // afternoon: the morning slot is clear
      { date: "2027-01-07", startTime: "08:30", durationMinutes: 60 }, // morning: the evening slot
      { date: "2027-01-08", startTime: "08:30", durationMinutes: 60 }, // morning and evening: both offered
      { date: "2027-01-08", startTime: "18:30", durationMinutes: 60 },
      { date: "2027-01-30", startTime: "09:00", durationMinutes: 60 }, // outside the window
    ])
    const slots = expandWindowTerm(window({ windowEnd: "2027-01-12" }), { ...opts, calendars: {}, anchors })
    expect(slots.map((s) => `${s.date} ${s.startTime}`)).toEqual([
      "2027-01-04 08:00", // first open day: both slots
      "2027-01-04 19:00",
      "2027-01-06 08:00", // both clear of the 15:00 exam
      "2027-01-06 19:00",
      "2027-01-07 19:00", // only the evening is clear
      "2027-01-08 08:00", // neither is clear: both
      "2027-01-08 19:00",
      "2027-01-12 08:00", // last open day
      "2027-01-12 19:00",
    ])
  })

  it("uses the term's own time every day when there is no venue", () => {
    const slots = expandWindowTerm(window({ venue: null, startTime: "13:00" }), opts)
    expect(slots.map((s) => s.startTime)).toEqual(["13:00", "13:00", "13:00", "13:00", "13:00"])
  })
})

describe("windows in the global scheduler", () => {
  const czu: GlobalStudyConfig = {
    studyId: "czu",
    studyName: "ČZU",
    travelCostOneWay: 300,
    travelDurationHours: 3,
    accommodationCostPerNight: 1500,
    preferFreeDayExams: true,
    ptoDayCost: 5500,
    workingDays: [1, 2, 3, 4, 5],
  }
  const uhk: GlobalStudyConfig = { ...czu, studyId: "uhk", studyName: "UHK", travelCostOneWay: 150, travelDurationHours: 2 }
  const t = (id: string, date: string, startTime: string, partIds?: string[], extra: Partial<GlobalTerm> = {}): GlobalTerm => ({
    termId: id,
    date,
    startTime,
    durationMinutes: 90,
    isOnline: false,
    note: null,
    locked: false,
    partIds,
    ...extra,
  })
  const split = (minGapDays?: number) => ({
    parts: [{ id: "w", label: "Písemná" }, { id: "o", label: "Ústní" }],
    ordered: true,
    ...(minGapDays ? { min_gap_days: minGapDays } : {}),
  })
  const req = (studyId: string, subjectId: string, terms: GlobalTerm[], parts?: ReturnType<typeof split>): GlobalRequirement => ({
    requirementId: `${studyId}:${subjectId}`,
    periodId: `${studyId}-exams`,
    periodName: "Zkoušky",
    studyId,
    subjectId,
    subjectShortcut: subjectId.toUpperCase(),
    subjectName: subjectId,
    windowStart: "2027-01-04",
    windowEnd: "2027-02-07",
    terms,
    parts,
  })
  const czuTerms: GlobalTerm[] = [
    ...["2027-01-08", "2027-01-15", "2027-01-22", "2027-02-03"].map((d, i) => t(`fin-o${i}`, d, "09:00", ["o"])),
    ...["2027-01-09", "2027-01-16", "2027-01-30"].map((d, i) => t(`epm-o${i}`, d, "09:00", ["o"])),
    ...["2027-01-10", "2027-01-17", "2027-01-24"].map((d, i) => t(`mkr-o${i}`, d, "09:00", ["o"])),
    t("vom1", "2026-12-13", "15:45", undefined, { isPreTerm: true }), t("vom2", "2027-01-09", "10:00"), t("vom3", "2027-01-23", "10:00"),
    t("mke1", "2027-01-08", "13:00"), t("mke2", "2027-01-15", "13:00"), t("mke3", "2027-01-29", "13:00"),
    t("ine1", "2027-01-16", "13:00"), t("ine2", "2027-01-30", "13:00"),
  ]
  const anchors = anchorsOf(czuTerms)
  const tc = (id: string, from: string, to: string) =>
    expandWindowTerm(window({ termId: id, date: from, windowEnd: to, durationMinutes: 90 }), {
      today: "2026-11-01",
      periodStart: "2027-01-04",
      calendars: {},
      anchors,
    })
  const orals = (prefix: string) => czuTerms.filter((x) => x.termId.startsWith(`${prefix}-o`))

  // Roughly the winter 2026/27 exam season: three TC subjects at ČZU with oral terms, three
  // plain ČZU subjects and four UHK subjects.
  const requirements: GlobalRequirement[] = [
    req("czu", "fin", [...tc("fin-tc", "2026-12-14", "2027-02-05"), ...orals("fin")], split()),
    req("czu", "epm", [...tc("epm-tc", "2027-01-04", "2027-02-05"), ...orals("epm")], split()),
    req("czu", "mkr", [...tc("mkr-tc", "2027-01-04", "2027-02-05"), ...orals("mkr")], split(1)),
    req("czu", "vom", czuTerms.filter((x) => x.termId.startsWith("vom"))),
    req("czu", "mke", czuTerms.filter((x) => x.termId.startsWith("mke"))),
    req("czu", "ine", czuTerms.filter((x) => x.termId.startsWith("ine"))),
    req("uhk", "dmo", [t("dmo1", "2027-01-11", "09:00"), t("dmo2", "2027-01-18", "09:00"), t("dmo3", "2027-01-25", "09:00")]),
    req("uhk", "nosq", [t("nosq1", "2027-01-12", "09:00"), t("nosq2", "2027-01-19", "09:00")]),
    req("uhk", "obda", [t("obda1", "2027-01-13", "09:00"), t("obda2", "2027-01-20", "09:00")]),
    req("uhk", "kos", [t("kos1", "2027-01-14", "09:00"), t("kos2", "2027-01-21", "09:00")]),
  ]

  it("keeps the later clear slot when a split exam's order needs it", () => {
    // Written part at 10:00, the TC part (oral here) must follow it the same day.
    const written = t("w", "2027-01-11", "10:00", ["w"])
    const slots = expandWindowTerm(window({ termId: "tc", date: "2027-01-11", windowEnd: "2027-01-11", partIds: ["o"], durationMinutes: 60 }), {
      today: "2026-11-01",
      periodStart: "2027-01-04",
      calendars: {},
      anchors: anchorsOf([written]),
    })
    const { forced } = generateGlobalSchedule([req("czu", "x", [written, ...slots], split())], [czu], 60, 60)
    expect(forced.unschedulable).toEqual([])
    expect(forced.selectedTermIds).toContain("tc@2027-01-11T19:00")
  })

  it("falls back to every open day when windows alone can't be placed", () => {
    // Three one-hour windows on the same five days and no other exams to anchor them.
    const ids = ["a", "b", "c"]
    const build = (full: Set<string>) =>
      ids.map((id) =>
        req(
          "czu",
          id,
          expandWindowTerm(window({ termId: id, date: "2027-01-04", windowEnd: "2027-01-08", durationMinutes: 60, venue: null, startTime: "09:00" }), {
            today: "2026-11-01",
            periodStart: "2027-01-04",
            calendars: {},
            anchors: full.has(`czu:${id}`) ? undefined : anchorsOf([]),
          })
        )
      )
    const { comparison } = scheduleWithWindowFallback(build, (r) => generateGlobalSchedule(r, [czu], 60, 60), new Set(ids.map((id) => `czu:${id}`)))
    expect(comparison.forced.unschedulable).toEqual([])
    expect(comparison.forced.selectedTermIds).toHaveLength(3)
  })

  it("schedules a realistic season with three TC windows completely, quickly and without truncation", () => {
    const started = performance.now()
    const { forced } = generateGlobalSchedule(requirements, [czu, uhk], 60, 60)
    const ms = performance.now() - started
    expect(forced.unschedulable).toEqual([])
    expect(forced.truncated).toBe(false)
    expect(ms).toBeLessThan(1500)

    const picked = new Map(forced.items.filter((i) => i.type === "exam").map((i) => [i.exam!.id, i.exam!]))
    const tcPick = (prefix: string) => [...picked.values()].find((e) => e.id.startsWith(`${prefix}-tc@`))!
    const oralPick = (prefix: string) => [...picked.values()].find((e) => e.id.startsWith(`${prefix}-o`))!
    // Finance: the TC test before the oral (same day allowed); MKR: the oral at least a day later.
    expect(`${tcPick("fin").date}T${tcPick("fin").startTime}` < `${oralPick("fin").date}T${oralPick("fin").startTime}`).toBe(true)
    expect(tcPick("mkr").date < oralPick("mkr").date).toBe(true)
    // TC days go where there is a trip to Prague anyway (no extra travel for the test).
    const czuDays = new Set([...picked.values()].filter((e) => !e.id.includes("-tc@")).map((e) => e.date))
    for (const p of ["fin", "epm", "mkr"]) expect(czuDays.has(tcPick(p).date)).toBe(true)
  })
})
