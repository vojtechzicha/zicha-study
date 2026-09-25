export { generateSchedule, buildScheduleItems } from "./scheduler";

export { generateGlobalSchedule } from "./global-scheduler";
export type {
  GlobalStudyConfig,
  GlobalTerm,
  GlobalRequirement,
  GlobalScheduleResult,
  GlobalScheduleComparison,
  PerStudyBreakdown,
  UnschedulableRequirement,
} from "./global-scheduler";

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

export { DEFAULT_CONFIG, computeTimeThresholds } from "./types";

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

// Exported for tests and advanced use.
export { calculateCost, calculatePtoPenalty, calculateScheduleScore, buildScheduleDays } from "./cost-calculator";
export { hasConflict, canAddExam, isValidCombination } from "./conflict-detector";
