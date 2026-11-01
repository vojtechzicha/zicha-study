import { describe, expect, it } from "vitest"
import { formatCapacity, formatRegistrationWindow, formatSourceDateTime, sourceLabel } from "@/lib/exam-import/format"

describe("synced term formatting", () => {
  it("formats source times without a time zone", () => {
    expect(formatSourceDateTime("2026-11-30T08:05", 2026)).toBe("30. 11. 8:05")
    expect(formatSourceDateTime("2027-01-04T00:00", 2026)).toBe("4. 1. 2027 0:00")
    expect(formatSourceDateTime("2027-01-04T00:00")).toBe("4. 1. 2027 0:00")
    expect(formatSourceDateTime(null)).toBeNull()
    expect(formatSourceDateTime("30.11.2026")).toBeNull()
  })

  it("formats the registration window", () => {
    expect(formatRegistrationWindow({ registration_from: "2026-11-30T00:00", registration_to: "2026-12-11T23:59" }, 2026)).toBe(
      "Přihlašování 30. 11. 0:00 – 11. 12. 23:59"
    )
    expect(formatRegistrationWindow({ registration_from: "2026-11-30T00:00", registration_to: null }, 2026)).toBe("Přihlašování od 30. 11. 0:00")
    expect(formatRegistrationWindow({ registration_from: null, registration_to: "2026-12-11T23:59" }, 2026)).toBe("Přihlašování do 11. 12. 23:59")
    expect(formatRegistrationWindow({ registration_from: null, registration_to: null })).toBeNull()
  })

  it("formats the capacity", () => {
    expect(formatCapacity({ capacity: 30, registered_count: 4 })).toBe("4/30 přihlášeno")
    expect(formatCapacity({ capacity: null, registered_count: 4 })).toBe("4 přihlášeno")
    expect(formatCapacity({ capacity: 30, registered_count: null })).toBe("kapacita 30")
    expect(formatCapacity({ capacity: null, registered_count: null })).toBeNull()
  })

  it("labels known sources only", () => {
    expect(sourceLabel("uis")).toBe("UIS")
    expect(sourceLabel("other")).toBeNull()
    expect(sourceLabel(null)).toBeNull()
  })
})
