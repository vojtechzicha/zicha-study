// Main algorithm export
export { generateSchedule } from "./scheduler";

// Types
export type {
  Subject,
  Exam,
  ExamWithSubject,
  ScheduleResult,
  ScheduleItem,
  ScheduleDay,
  ScheduleItemType,
  SchedulerConfig,
} from "./types";

// Config defaults
export { DEFAULT_CONFIG, computeTimeThresholds } from "./types";

// Adapters for converting between tracker and scheduler types
export {
  mapTrackerSubjectToSchedulerSubject,
  mapTrackerSubjectsToSchedulerSubjects,
  mapExamOptionsToSchedulerExams,
  createSchedulerConfigFromStudy,
  groupExamOptionsBySubject,
} from "./adapters";

export type {
  TrackerSubject,
  ExamOption,
  TrackerStudy,
} from "./adapters";

// Utilities (for testing and advanced use)
export { calculateCost, buildScheduleDays } from "./cost-calculator";
export { hasConflict, canAddExam, isValidCombination } from "./conflict-detector";
