import {
  Subject,
  Exam,
  ExamWithSubject,
  ScheduleResult,
  ScheduleItem,
  SchedulerConfig,
  DEFAULT_CONFIG,
} from "./types";
import { canAddExam } from "./conflict-detector";
import { calculateCost, buildScheduleDays, computeEndTime } from "./cost-calculator";
import { formatDate, compareDate } from "./utils";

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
 * Sort exams by preference (earlier first, online preferred)
 */
function sortExamsByPreference(exams: ExamWithSubject[]): ExamWithSubject[] {
  return [...exams].sort((a, b) => {
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
    const sortedExams = sortExamsByPreference(exams);

    for (const exam of sortedExams) {
      // Check if this exam conflicts with current schedule
      if (!canAddExam(exam, currentExams)) {
        continue;
      }

      // Calculate new cost with this exam added
      const newExams = [...currentExams, exam];
      const { totalCost: newCost } = calculateCost(newExams, config);

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
 */
function buildScheduleItems(
  exams: ExamWithSubject[],
  config: SchedulerConfig
): ScheduleItem[] {
  if (exams.length === 0) {
    return [];
  }

  const days = buildScheduleDays(exams, config);
  const items: ScheduleItem[] = [];

  for (const day of days) {
    // Sort exams by start time
    const sortedExams = [...day.exams].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );

    // Travel to school (if needed)
    if (day.needsTravelTo) {
      const earliestExam = sortedExams.find((e) => !e.isOnline);
      if (earliestExam) {
        // Calculate travel start time
        const examMinutes =
          parseInt(earliestExam.startTime.split(":")[0]) * 60 +
          parseInt(earliestExam.startTime.split(":")[1]);
        const travelStartMinutes = examMinutes - config.travelDurationHours * 60;
        const travelStartHour = Math.floor(travelStartMinutes / 60);
        const travelStartMin = travelStartMinutes % 60;
        const travelStart = `${travelStartHour.toString().padStart(2, "0")}:${travelStartMin.toString().padStart(2, "0")}`;

        items.push({
          type: "travel_to",
          date: day.date,
          startTime: travelStart,
          description: `${formatDate(day.date)} - ${travelStart} - Cesta do školy`,
          cost: config.travelCostOneWay,
        });
      }
    }

    // Accommodation before (if needed)
    if (day.needsAccommodationBefore) {
      const prevDate = new Date(`${day.date}T00:00:00`);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split("T")[0];

      items.push({
        type: "accommodation",
        date: prevDateStr,
        description: `${formatDate(prevDateStr)} - ${formatDate(day.date)} - Ubytování`,
        cost: config.accommodationCostPerNight,
      });
    }

    // Exams
    for (const exam of sortedExams) {
      items.push({
        type: "exam",
        date: day.date,
        startTime: exam.startTime,
        endTime: exam.endTime,
        exam,
        description: `${formatDate(day.date)} - ${exam.startTime} - ${exam.endTime} - [${exam.subject.shortcut}] ${exam.subject.name}${exam.isOnline ? " (online)" : ""}`,
        cost: 0,
      });
    }

    // Travel from school (if needed)
    if (day.needsTravelFrom) {
      const latestExam = [...sortedExams]
        .filter((e) => !e.isOnline)
        .sort((a, b) => b.endTime.localeCompare(a.endTime))[0];

      if (latestExam) {
        items.push({
          type: "travel_from",
          date: day.date,
          startTime: latestExam.endTime,
          description: `${formatDate(day.date)} - ${latestExam.endTime} - Cesta domů`,
          cost: config.travelCostOneWay,
        });
      }
    }

    // Accommodation after (if needed)
    if (day.needsAccommodationAfter) {
      const nextDate = new Date(`${day.date}T00:00:00`);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split("T")[0];

      items.push({
        type: "accommodation",
        date: day.date,
        description: `${formatDate(day.date)} - ${formatDate(nextDateStr)} - Ubytování`,
        cost: config.accommodationCostPerNight,
      });
    }
  }

  // Sort items by date, then by type order, then by time
  const typeOrder = { accommodation: 0, travel_to: 1, exam: 2, travel_from: 3 };
  items.sort((a, b) => {
    const dateCompare = compareDate(a.date, b.date);
    if (dateCompare !== 0) return dateCompare;

    // Accommodation before should come first
    if (a.type === "accommodation" && b.type !== "accommodation") return -1;
    if (b.type === "accommodation" && a.type !== "accommodation") return 1;

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
      },
      error:
        "Nebyl nalezen platný rozvrh. Zkontrolujte, zda nejsou termíny v konfliktu.",
    };
  }

  const { exams: selectedExams, cost } = result;
  const items = buildScheduleItems(selectedExams, fullConfig);
  const breakdown = calculateCost(selectedExams, fullConfig);

  return {
    success: true,
    items,
    selectedExams,
    totalCost: cost,
    breakdown: {
      travelCost: breakdown.travelCost,
      accommodationCost: breakdown.accommodationCost,
      travelTrips: breakdown.travelTrips,
      accommodationNights: breakdown.accommodationNights,
    },
  };
}
