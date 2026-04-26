import { describe, expect, it } from "vitest"
import { calculateGpa, gradeToGpaPoints, type GradeCalculationSubject } from "./grade-utils"

const subject = (
  grade: string,
  credits: number,
  completionType = "Zk",
  options: Partial<GradeCalculationSubject> = {}
): GradeCalculationSubject => ({
  ...options,
  completion_type: completionType,
  credits,
  grade,
})

describe("gradeToGpaPoints", () => {
  it("maps ECTS grades to US GPA points", () => {
    expect(gradeToGpaPoints("A")).toBe(4)
    expect(gradeToGpaPoints("B")).toBe(3.5)
    expect(gradeToGpaPoints("C")).toBe(3)
    expect(gradeToGpaPoints("D")).toBe(2.5)
    expect(gradeToGpaPoints("E")).toBe(2)
    expect(gradeToGpaPoints("FX")).toBe(0)
    expect(gradeToGpaPoints("F")).toBe(0)
  })

  it("excludes pass/fail and withdrawn grades from GPA", () => {
    expect(gradeToGpaPoints("Z")).toBeNull()
    expect(gradeToGpaPoints("Zp")).toBeNull()
    expect(gradeToGpaPoints("P")).toBeNull()
    expect(gradeToGpaPoints("W")).toBeNull()
  })
})

describe("calculateGpa", () => {
  it("calculates a credit-weighted GPA", () => {
    const gpa = calculateGpa([
      subject("A", 6),
      subject("B", 4),
      subject("E", 2),
    ])

    expect(gpa).toBeCloseTo(3.5)
  })

  it("counts failed graded subjects as zero GPA points", () => {
    const gpa = calculateGpa([
      subject("A", 6),
      subject("F", 6),
    ])

    expect(gpa).toBeCloseTo(2)
  })

  it("uses a repeated subject grade instead of counting the failed original", () => {
    const gpa = calculateGpa([
      subject("FX", 6, "Zk", { id: "original" }),
      subject("B", 6, "Zk", {
        id: "repeat",
        is_repeat: true,
        repeats_subject_id: "original",
      }),
    ])

    expect(gpa).toBeCloseTo(3.5)
  })

  it("counts an uncorrected failed subject as zero GPA points", () => {
    const gpa = calculateGpa([
      subject("FX", 5, "Zk", { id: "failed" }),
      subject("A", 5, "Zk", { id: "passed" }),
    ])

    expect(gpa).toBeCloseTo(2)
  })

  it("excludes credit-only and pass/fail subjects from the denominator", () => {
    const gpa = calculateGpa([
      subject("A", 6),
      subject("A", 6, "Zp"),
      subject("P", 3),
      subject("W", 3),
    ])

    expect(gpa).toBeCloseTo(4)
  })
})
