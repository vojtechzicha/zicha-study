import { describe, expect, it } from "vitest"
import type { VenueDay } from "@/lib/constants"
import { planVenueDays, venueDaysRequestSchema } from "../import"

const d = (date: string, open_from = "08:00", open_to = "20:00", occupancy: number | null = 10): VenueDay => ({
  venue: "tc_pef",
  date,
  open_from,
  open_to,
  occupancy,
})
const req = (days: VenueDay[]) =>
  venueDaysRequestSchema.parse({ venue: "tc_pef", days: days.map(({ venue: _venue, ...rest }) => rest) })

describe("planVenueDays", () => {
  it("adds new days and moves the published range forward", () => {
    const plan = planVenueDays([d("2026-11-02")], req([d("2026-11-02", "08:00", "20:00", 50), d("2026-11-03")]), "2026-11-02")
    expect(plan.added).toEqual(["2026-11-03"])
    expect(plan.changed).toEqual([]) // occupancy only
    expect(plan.upserts.map((x) => x.date)).toEqual(["2026-11-02", "2026-11-03"])
    expect(plan.publishedThrough).toBe("2026-11-03")
  })

  it("removes days inside the listed range that are gone, keeps days outside it", () => {
    const existing = [d("2026-11-01"), d("2026-11-02"), d("2026-11-03"), d("2026-11-04"), d("2026-11-20")]
    const plan = planVenueDays(existing, req([d("2026-11-02"), d("2026-11-04", "10:00", "18:00")]), "2026-11-20")
    expect(plan.removed).toEqual(["2026-11-03"])
    expect(plan.changed).toEqual(["2026-11-04"])
    // The past day before the range and the later day after it stay; the range never shrinks.
    expect(plan.deletes).toEqual(["2026-11-03"])
    expect(plan.publishedThrough).toBe("2026-11-20")
  })

  it("does nothing with an empty list", () => {
    const plan = planVenueDays([d("2026-11-02")], req([]), "2026-11-02")
    expect(plan).toMatchObject({ upserts: [], deletes: [], added: [], publishedThrough: "2026-11-02" })
  })

  it("validates the request", () => {
    expect(venueDaysRequestSchema.safeParse({ venue: "tc_pef", days: [{ date: "2.11.2026", open_from: "08:00", open_to: "20:00" }] }).success).toBe(false)
    expect(venueDaysRequestSchema.safeParse({ venue: "tc_pef", days: [{ date: "2026-11-02", open_from: "20:00", open_to: "08:00" }] }).success).toBe(false)
    expect(venueDaysRequestSchema.safeParse({ venue: "other", days: [] }).success).toBe(false)
  })
})
