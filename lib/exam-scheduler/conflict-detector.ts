import { ExamWithSubject } from "./types";
import { parseTimeToMinutes } from "./utils";

/**
 * Exams conflict when they are on the same day and their time ranges overlap.
 * No travel buffer is added; back-to-back exams do not conflict.
 */
export function hasConflict(
  exam1: ExamWithSubject,
  exam2: ExamWithSubject
): boolean {
  if (exam1.date !== exam2.date) {
    return false;
  }

  const start1 = parseTimeToMinutes(exam1.startTime);
  const end1 = start1 + exam1.durationMinutes;
  const start2 = parseTimeToMinutes(exam2.startTime);
  const end2 = start2 + exam2.durationMinutes;

  return start1 < end2 && start2 < end1;
}

export function hasConflictWithAny(
  exam: ExamWithSubject,
  exams: ExamWithSubject[]
): boolean {
  return exams.some((e) => hasConflict(exam, e));
}

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

export function canAddExam(
  newExam: ExamWithSubject,
  existingExams: ExamWithSubject[]
): boolean {
  return !hasConflictWithAny(newExam, existingExams);
}
