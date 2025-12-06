import { describe, it, expect } from "vitest";
import { hasConflict, canAddExam, isValidCombination } from "../conflict-detector";
import { ExamWithSubject, Subject } from "../types";

const mockSubject: Subject = {
  id: "s1",
  shortcut: "TEST",
  name: "Test Subject",
  isComplete: false,
};

function createExam(
  id: string,
  date: string,
  startTime: string,
  durationMinutes: number,
  isOnline = false
): ExamWithSubject {
  const [hours, minutes] = startTime.split(":").map(Number);
  const endMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  const endTime = `${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`;

  return {
    id,
    subjectId: "s1",
    note: null,
    date,
    startTime,
    durationMinutes,
    isOnline,
    subject: mockSubject,
    endTime,
  };
}

describe("hasConflict", () => {
  it("returns false for exams on different days", () => {
    const exam1 = createExam("e1", "2025-01-10", "10:00", 60);
    const exam2 = createExam("e2", "2025-01-11", "10:00", 60);
    expect(hasConflict(exam1, exam2)).toBe(false);
  });

  it("returns false for non-overlapping exams on same day", () => {
    const exam1 = createExam("e1", "2025-01-10", "10:00", 60);
    const exam2 = createExam("e2", "2025-01-10", "12:00", 60);
    expect(hasConflict(exam1, exam2)).toBe(false);
  });

  it("returns true for overlapping exams", () => {
    const exam1 = createExam("e1", "2025-01-10", "10:00", 90);
    const exam2 = createExam("e2", "2025-01-10", "11:00", 60);
    expect(hasConflict(exam1, exam2)).toBe(true);
  });

  it("returns false for adjacent exams (no gap)", () => {
    const exam1 = createExam("e1", "2025-01-10", "10:00", 60);
    const exam2 = createExam("e2", "2025-01-10", "11:00", 60);
    expect(hasConflict(exam1, exam2)).toBe(false);
  });

  it("returns true for identical time slots", () => {
    const exam1 = createExam("e1", "2025-01-10", "10:00", 60);
    const exam2 = createExam("e2", "2025-01-10", "10:00", 60);
    expect(hasConflict(exam1, exam2)).toBe(true);
  });

  it("returns true when exam1 contains exam2", () => {
    const exam1 = createExam("e1", "2025-01-10", "09:00", 180);
    const exam2 = createExam("e2", "2025-01-10", "10:00", 60);
    expect(hasConflict(exam1, exam2)).toBe(true);
  });
});

describe("canAddExam", () => {
  it("returns true when adding to empty schedule", () => {
    const exam = createExam("e1", "2025-01-10", "10:00", 60);
    expect(canAddExam(exam, [])).toBe(true);
  });

  it("returns true when no conflicts", () => {
    const existing = createExam("e1", "2025-01-10", "10:00", 60);
    const newExam = createExam("e2", "2025-01-10", "14:00", 60);
    expect(canAddExam(newExam, [existing])).toBe(true);
  });

  it("returns false when conflicts with existing exam", () => {
    const existing = createExam("e1", "2025-01-10", "10:00", 120);
    const newExam = createExam("e2", "2025-01-10", "11:00", 60);
    expect(canAddExam(newExam, [existing])).toBe(false);
  });
});

describe("isValidCombination", () => {
  it("returns true for empty list", () => {
    expect(isValidCombination([])).toBe(true);
  });

  it("returns true for single exam", () => {
    const exam = createExam("e1", "2025-01-10", "10:00", 60);
    expect(isValidCombination([exam])).toBe(true);
  });

  it("returns true for non-conflicting exams", () => {
    const exam1 = createExam("e1", "2025-01-10", "10:00", 60);
    const exam2 = createExam("e2", "2025-01-10", "14:00", 60);
    const exam3 = createExam("e3", "2025-01-11", "10:00", 60);
    expect(isValidCombination([exam1, exam2, exam3])).toBe(true);
  });

  it("returns false when any exams conflict", () => {
    const exam1 = createExam("e1", "2025-01-10", "10:00", 60);
    const exam2 = createExam("e2", "2025-01-10", "14:00", 60);
    const exam3 = createExam("e3", "2025-01-10", "10:30", 60);
    expect(isValidCombination([exam1, exam2, exam3])).toBe(false);
  });
});
