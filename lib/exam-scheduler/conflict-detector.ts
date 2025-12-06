import { ExamWithSubject } from "./types";
import { parseTimeToMinutes } from "./utils";

/**
 * Check if two exams conflict with each other.
 * Exams conflict if:
 * 1. They're on the same day AND
 * 2. Their time ranges overlap (including travel buffer for offline exams)
 */
export function hasConflict(
  exam1: ExamWithSubject,
  exam2: ExamWithSubject
): boolean {
  // Different days = no conflict
  if (exam1.date !== exam2.date) {
    return false;
  }

  // Same day - check time overlap
  const start1 = parseTimeToMinutes(exam1.startTime);
  const end1 = start1 + exam1.durationMinutes;
  const start2 = parseTimeToMinutes(exam2.startTime);
  const end2 = start2 + exam2.durationMinutes;

  // Check if exam times overlap
  return start1 < end2 && start2 < end1;
}

/**
 * Check if an exam conflicts with any exam in a list
 */
export function hasConflictWithAny(
  exam: ExamWithSubject,
  exams: ExamWithSubject[]
): boolean {
  return exams.some((e) => hasConflict(exam, e));
}

/**
 * Check if a combination of exams is valid (no conflicts)
 */
export function isValidCombination(exams: ExamWithSubject[]): boolean {
  for (let i = 0; i < exams.length; i++) {
    for (let j = i + 1; j < exams.length; j++) {
      if (hasConflict(exams[i], exams[j])) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Check if adding an exam to existing schedule creates any conflict
 */
export function canAddExam(
  newExam: ExamWithSubject,
  existingExams: ExamWithSubject[]
): boolean {
  return !hasConflictWithAny(newExam, existingExams);
}
