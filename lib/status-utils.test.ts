import { describe, expect, it } from "vitest"
import { getCompletionDateUpdates, getTodayDateString, isSubjectFailed } from "./status-utils"

describe("getCompletionDateUpdates", () => {
  it("stamps the date when a completion is ticked", () => {
    expect(getCompletionDateUpdates({ credit_completed: true }, null, "2026-05-20")).toEqual({
      credit_date: "2026-05-20",
    })
    expect(getCompletionDateUpdates({ exam_completed: true }, null, "2026-05-20")).toEqual({
      exam_date: "2026-05-20",
    })
  })

  it("defaults to today when no date is given", () => {
    expect(getCompletionDateUpdates({ credit_completed: true })).toEqual({
      credit_date: getTodayDateString(),
    })
  })

  it("keeps a date that is already stored", () => {
    expect(
      getCompletionDateUpdates({ credit_completed: true }, { credit_date: "2026-01-15" }, "2026-05-20")
    ).toEqual({})
  })

  it("stamps a missing date even when the completion was already ticked", () => {
    // Legacy subjects closed before credit_date existed
    expect(
      getCompletionDateUpdates({ credit_completed: true, exam_completed: true }, { exam_date: "2026-02-02" }, "2026-05-20")
    ).toEqual({ credit_date: "2026-05-20" })
  })

  it("clears the date when a completion is unticked", () => {
    expect(
      getCompletionDateUpdates(
        { credit_completed: false, exam_completed: false },
        { credit_date: "2026-01-15", exam_date: "2026-02-02" },
        "2026-05-20"
      )
    ).toEqual({ credit_date: null, exam_date: null })
  })

  it("leaves untouched completions alone", () => {
    expect(
      getCompletionDateUpdates({ exam_completed: true }, { credit_date: "2026-01-15" }, "2026-05-20")
    ).toEqual({ exam_date: "2026-05-20" })
  })
})

describe("isSubjectFailed", () => {
  it("treats F, FX, 4 and a dash as failing grades", () => {
    expect(isSubjectFailed({ completed: true, grade: "F" })).toBe(true)
    expect(isSubjectFailed({ completed: true, grade: "fx" })).toBe(true)
    expect(isSubjectFailed({ completed: true, grade: "4" })).toBe(true)
    expect(isSubjectFailed({ completed: true, grade: "-" })).toBe(true)
  })

  it("does not fail passing, ungraded or unfinished subjects", () => {
    expect(isSubjectFailed({ completed: true, grade: "A" })).toBe(false)
    expect(isSubjectFailed({ completed: true, grade: "Zp" })).toBe(false)
    expect(isSubjectFailed({ completed: true })).toBe(false)
    expect(isSubjectFailed({ completed: false, grade: "F" })).toBe(false)
  })
})
