import type { Subject as SchedulerSubject, Exam as SchedulerExam, SchedulerConfig } from "./types";

// Tracker types (from the main app)
export interface TrackerSubject {
  id: string;
  study_id: string;
  semester: string;
  abbreviation: string | null;
  name: string;
  completion_type: string;
  credits: number;
  completed: boolean;
  exam_completed: boolean;
  credit_completed: boolean;
  planned?: boolean;
  subject_type: string;
}

export interface ExamOption {
  id: string;
  subject_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS or HH:MM
  duration_minutes: number;
  is_online: boolean;
  note: string | null;
}

export interface TrackerStudy {
  id: string;
  exam_scheduler_enabled: boolean;
  transit_duration_hours: number;
  transit_cost_one_way: number;
  accommodation_cost_per_night: number;
}

/**
 * Check if a subject requires an exam (Zkouška or Zápočet+Zkouška)
 */
function requiresExam(completionType: string): boolean {
  return completionType.includes("Zk");
}

/**
 * Convert a tracker subject to scheduler subject
 */
export function mapTrackerSubjectToSchedulerSubject(
  subject: TrackerSubject
): SchedulerSubject {
  return {
    id: subject.id,
    shortcut: subject.abbreviation || subject.name.substring(0, 5).toUpperCase(),
    name: subject.name,
    // Mark as complete if: completed, planned, or doesn't require an exam
    isComplete: subject.completed || subject.planned === true || !requiresExam(subject.completion_type),
  };
}

/**
 * Convert multiple tracker subjects to scheduler subjects
 */
export function mapTrackerSubjectsToSchedulerSubjects(
  subjects: TrackerSubject[]
): SchedulerSubject[] {
  return subjects.map(mapTrackerSubjectToSchedulerSubject);
}

/**
 * Convert exam options to scheduler exams
 */
export function mapExamOptionsToSchedulerExams(
  examOptions: ExamOption[]
): SchedulerExam[] {
  return examOptions.map((option) => ({
    id: option.id,
    subjectId: option.subject_id,
    date: option.date,
    // Handle both HH:MM:SS and HH:MM formats
    startTime: option.start_time.substring(0, 5),
    durationMinutes: option.duration_minutes,
    isOnline: option.is_online,
    note: option.note,
  }));
}

/**
 * Create scheduler config from study settings
 */
export function createSchedulerConfigFromStudy(
  study: TrackerStudy
): SchedulerConfig {
  return {
    travelCostOneWay: study.transit_cost_one_way,
    travelDurationHours: study.transit_duration_hours,
    accommodationCostPerNight: study.accommodation_cost_per_night,
  };
}

/**
 * Helper to group exam options by subject
 */
export function groupExamOptionsBySubject(
  examOptions: ExamOption[]
): Map<string, ExamOption[]> {
  const map = new Map<string, ExamOption[]>();
  for (const option of examOptions) {
    const existing = map.get(option.subject_id) || [];
    existing.push(option);
    map.set(option.subject_id, existing);
  }
  return map;
}
