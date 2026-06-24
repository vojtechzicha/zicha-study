import {
  Subject,
  Exam,
  ExamWithSubject,
  ScheduleResult,
  ScheduleItem,
  ScheduleItemType,
  SchedulerConfig,
  DEFAULT_CONFIG,
} from "./types";
import { canAddExam } from "./conflict-detector";
import {
  calculateCost,
  calculateScheduleScore,
  calculatePtoPenalty,
  buildScheduleDays,
  computeEndTime,
  buildTripSegments,
} from "./cost-calculator";
import { formatDate, compareDate, getNextDay, isWorkingDay } from "./utils";

// Days of week treated as working days when none are configured (Mon-Fri).
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

interface SubjectExams {
  subject: Subject;
  exams: ExamWithSubject[];
}

/**
 * Prepare exams with computed end times and subject info
 */
function prepareExams(subjects: Subject[], exams: Exam[]): ExamWithSubject[] {
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  return exams.map((exam) => {
    const subject = subjectMap.get(exam.subjectId);
    if (!subject) {
      throw new Error(`Subject not found for exam: ${exam.id}`);
    }
    const examWithSubject = {
      ...exam,
      subject,
      endTime: "", // Placeholder, computed next
    } as ExamWithSubject;
    examWithSubject.endTime = computeEndTime(examWithSubject);
    return examWithSubject;
  });
}

/**
 * Group exams by subject and filter out completed subjects
 */
function groupExamsBySubject(
  subjects: Subject[],
  exams: ExamWithSubject[]
): SubjectExams[] {
  const incompleteSubjects = subjects.filter((s) => !s.isComplete);
  const result: SubjectExams[] = [];

  for (const subject of incompleteSubjects) {
    const subjectExams = exams.filter((e) => e.subjectId === subject.id);
    if (subjectExams.length === 0) {
      // Subject has no exams - this is an error condition
      continue;
    }
    result.push({ subject, exams: subjectExams });
  }

  return result;
}

/**
 * Sort exams by preference (earlier first, online preferred).
 * When preferFreeDayExams is on, PTO-free options (online, or in-person on a
 * non-working day) are explored first. This only affects exploration order and
 * tie-breaking; the chosen optimum is still decided by the schedule score.
 */
function sortExamsByPreference(
  exams: ExamWithSubject[],
  config: SchedulerConfig
): ExamWithSubject[] {
  const preferFreeDay = !!config.preferFreeDayExams;
  const workingDays =
    config.workingDays && config.workingDays.length > 0
      ? config.workingDays
      : DEFAULT_WORKING_DAYS;

  const needsPto = (e: ExamWithSubject) =>
    !e.isOnline && isWorkingDay(e.date, workingDays);

  return [...exams].sort((a, b) => {
    // When preferring free days, explore PTO-free options first
    if (preferFreeDay) {
      const aPto = needsPto(a);
      const bPto = needsPto(b);
      if (aPto !== bPto) return aPto ? 1 : -1;
    }

    // First by date
    const dateCompare = compareDate(a.date, b.date);
    if (dateCompare !== 0) return dateCompare;

    // Then prefer online
    if (a.isOnline !== b.isOnline) {
      return a.isOnline ? -1 : 1;
    }

    // Then by start time
    return a.startTime.localeCompare(b.startTime);
  });
}

/**
 * Main scheduling algorithm using backtracking with branch-and-bound
 */
function findOptimalSchedule(
  subjectExams: SubjectExams[],
  config: SchedulerConfig
): {
  exams: ExamWithSubject[];
  cost: number;
} | null {
  if (subjectExams.length === 0) {
    return { exams: [], cost: 0 };
  }

  // Sort subjects by number of exams (most constrained first)
  const sortedSubjects = [...subjectExams].sort(
    (a, b) => a.exams.length - b.exams.length
  );

  let bestSolution: ExamWithSubject[] | null = null;
  let bestCost = Infinity;

  function backtrack(
    subjectIndex: number,
    currentExams: ExamWithSubject[],
    currentCost: number
  ): void {
    // Base case: all subjects assigned
    if (subjectIndex === sortedSubjects.length) {
      if (currentCost < bestCost) {
        bestCost = currentCost;
        bestSolution = [...currentExams];
      }
      return;
    }

    // Pruning: if current cost already exceeds best, skip
    if (currentCost >= bestCost) {
      return;
    }

    const { exams } = sortedSubjects[subjectIndex];
    const sortedExams = sortExamsByPreference(exams, config);

    for (const exam of sortedExams) {
      // Check if this exam conflicts with current schedule
      if (!canAddExam(exam, currentExams)) {
        continue;
      }

      // Calculate new score with this exam added (money + PTO penalty)
      const newExams = [...currentExams, exam];
      const newCost = calculateScheduleScore(newExams, config);

      // Pruning: skip if already worse than best
      if (newCost >= bestCost) {
        continue;
      }

      // Recurse
      backtrack(subjectIndex + 1, newExams, newCost);
    }
  }

  backtrack(0, [], 0);

  if (bestSolution === null) {
    return null;
  }

  return { exams: bestSolution, cost: bestCost };
}

/**
 * Build schedule items from selected exams for display
 * Uses trip segments: each segment represents a contiguous stay in the city
 */
export function buildScheduleItems(
  exams: ExamWithSubject[],
  config: SchedulerConfig
): ScheduleItem[] {
  if (exams.length === 0) {
    return [];
  }

  const days = buildScheduleDays(exams, config);
  const offlineDays = days.filter((d) => d.hasOfflineExam);
  const items: ScheduleItem[] = [];

  // Whether an in-person exam on a given date requires a PTO day
  const preferFreeDay = !!config.preferFreeDayExams;
  const workingDays =
    config.workingDays && config.workingDays.length > 0
      ? config.workingDays
      : DEFAULT_WORKING_DAYS;
  const requiresPto = (exam: ExamWithSubject, date: string) =>
    preferFreeDay && !exam.isOnline && isWorkingDay(date, workingDays);

  // If no offline exams, just add online exam items
  if (offlineDays.length === 0) {
    for (const day of days) {
      const sortedExams = [...day.exams].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      );
      for (const exam of sortedExams) {
        items.push({
          type: "exam",
          date: day.date,
          startTime: exam.startTime,
          endTime: exam.endTime,
          exam,
          description: `${formatDate(day.date)} - ${exam.startTime} - ${exam.endTime} - [${exam.subject.shortcut}] ${exam.subject.name}${exam.isOnline ? " (online)" : ""}`,
          cost: 0,
          requiresPto: requiresPto(exam, day.date),
        });
      }
    }
    return items;
  }

  // Build trip segments (decides when to go home vs stay based on cost)
  const segments = buildTripSegments(offlineDays, config);

  // For each segment, add travel and accommodation items
  for (const segment of segments) {
    const firstDay = segment.days[0];
    const lastDay = segment.days[segment.days.length - 1];

    // Add travel_to on arrival day
    if (firstDay.needsAccommodationBefore) {
      // Arrive day before, travel in the afternoon
      items.push({
        type: "travel_to",
        date: segment.arrivalDate,
        startTime: "14:00",
        description: `${formatDate(segment.arrivalDate)} - 14:00 - Cesta do školy`,
        cost: config.travelCostOneWay,
      });
    } else {
      // Arrive same day, calculate travel start based on first exam
      const firstOfflineExam = [...firstDay.exams]
        .filter((e) => !e.isOnline)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];

      if (firstOfflineExam) {
        const examMinutes =
          parseInt(firstOfflineExam.startTime.split(":")[0]) * 60 +
          parseInt(firstOfflineExam.startTime.split(":")[1]);
        const travelStartMinutes = examMinutes - config.travelDurationHours * 60;
        const travelStartHour = Math.floor(travelStartMinutes / 60);
        const travelStartMin = travelStartMinutes % 60;
        const travelStart = `${Math.max(0, travelStartHour).toString().padStart(2, "0")}:${travelStartMin.toString().padStart(2, "0")}`;

        items.push({
          type: "travel_to",
          date: segment.arrivalDate,
          startTime: travelStart,
          description: `${formatDate(segment.arrivalDate)} - ${travelStart} - Cesta do školy`,
          cost: config.travelCostOneWay,
        });
      }
    }

    // Add accommodation nights from the segment
    for (const nightDate of segment.accommodationNights) {
      const nextDateStr = getNextDay(nightDate);
      items.push({
        type: "accommodation",
        date: nightDate,
        description: `${formatDate(nightDate)} - ${formatDate(nextDateStr)} - Ubytování`,
        cost: config.accommodationCostPerNight,
      });
    }

    // Add travel_from on departure day
    if (lastDay.needsAccommodationAfter) {
      // Leave next day morning
      items.push({
        type: "travel_from",
        date: segment.departureDate,
        startTime: "09:00",
        description: `${formatDate(segment.departureDate)} - 09:00 - Cesta domů`,
        cost: config.travelCostOneWay,
      });
    } else {
      // Leave same day after last exam
      const lastOfflineExam = [...lastDay.exams]
        .filter((e) => !e.isOnline)
        .sort((a, b) => b.endTime.localeCompare(a.endTime))[0];

      if (lastOfflineExam) {
        items.push({
          type: "travel_from",
          date: segment.departureDate,
          startTime: lastOfflineExam.endTime,
          description: `${formatDate(segment.departureDate)} - ${lastOfflineExam.endTime} - Cesta domů`,
          cost: config.travelCostOneWay,
        });
      }
    }
  }

  // Add all exams (including online)
  for (const day of days) {
    const sortedExams = [...day.exams].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
    for (const exam of sortedExams) {
      items.push({
        type: "exam",
        date: day.date,
        startTime: exam.startTime,
        endTime: exam.endTime,
        exam,
        description: `${formatDate(day.date)} - ${exam.startTime} - ${exam.endTime} - [${exam.subject.shortcut}] ${exam.subject.name}${exam.isOnline ? " (online)" : ""}`,
        cost: 0,
        requiresPto: requiresPto(exam, day.date),
      });
    }
  }

  // Sort items by date, then by type order, then by time
  const typeOrder: Record<ScheduleItemType, number> = { travel_to: 0, accommodation: 1, exam: 2, travel_from: 3 };
  items.sort((a, b) => {
    const dateCompare = compareDate(a.date, b.date);
    if (dateCompare !== 0) return dateCompare;

    const orderCompare = typeOrder[a.type] - typeOrder[b.type];
    if (orderCompare !== 0) return orderCompare;

    if (a.startTime && b.startTime) {
      return a.startTime.localeCompare(b.startTime);
    }
    return 0;
  });

  return items;
}

/**
 * Main entry point: generate optimal exam schedule
 */
export function generateSchedule(
  subjects: Subject[],
  exams: Exam[],
  config: Partial<SchedulerConfig> = {}
): ScheduleResult {
  const fullConfig: SchedulerConfig = { ...DEFAULT_CONFIG, ...config };

  // Check for subjects without exams that aren't complete
  const incompleteSubjects = subjects.filter((s) => !s.isComplete);
  const subjectsWithExams = new Set(exams.map((e) => e.subjectId));

  const subjectsWithoutExams = incompleteSubjects.filter(
    (s) => !subjectsWithExams.has(s.id)
  );

  if (subjectsWithoutExams.length > 0) {
    const names = subjectsWithoutExams.map((s) => s.name).join(", ");
    return {
      success: false,
      items: [],
      selectedExams: [],
      totalCost: 0,
      breakdown: {
        travelCost: 0,
        accommodationCost: 0,
        travelTrips: 0,
        accommodationNights: 0,
        ptoDays: 0,
      },
      error: `Následující předměty nemají žádné termíny zkoušek: ${names}`,
    };
  }

  // If all subjects are complete, return empty schedule
  if (incompleteSubjects.length === 0) {
    return {
      success: true,
      items: [],
      selectedExams: [],
      totalCost: 0,
      breakdown: {
        travelCost: 0,
        accommodationCost: 0,
        travelTrips: 0,
        accommodationNights: 0,
        ptoDays: 0,
      },
    };
  }

  // Prepare and group exams
  const preparedExams = prepareExams(subjects, exams);
  const subjectExams = groupExamsBySubject(subjects, preparedExams);

  // Find optimal schedule
  const result = findOptimalSchedule(subjectExams, fullConfig);

  if (result === null) {
    return {
      success: false,
      items: [],
      selectedExams: [],
      totalCost: 0,
      breakdown: {
        travelCost: 0,
        accommodationCost: 0,
        travelTrips: 0,
        accommodationNights: 0,
        ptoDays: 0,
      },
      error:
        "Nebyl nalezen platný rozvrh. Zkontrolujte, zda nejsou termíny v konfliktu.",
    };
  }

  const { exams: selectedExams } = result;
  const items = buildScheduleItems(selectedExams, fullConfig);
  const breakdown = calculateCost(selectedExams, fullConfig);
  const { ptoDays } = calculatePtoPenalty(selectedExams, fullConfig);

  return {
    success: true,
    items,
    selectedExams,
    // User-facing total is the real monetary cost, not the optimization score
    // (which may include the virtual PTO penalty).
    totalCost: breakdown.totalCost,
    breakdown: {
      travelCost: breakdown.travelCost,
      accommodationCost: breakdown.accommodationCost,
      travelTrips: breakdown.travelTrips,
      accommodationNights: breakdown.accommodationNights,
      ptoDays,
    },
  };
}
