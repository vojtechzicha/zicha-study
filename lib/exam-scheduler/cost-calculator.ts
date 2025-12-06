import {
  ExamWithSubject,
  ScheduleDay,
  SchedulerConfig,
  computeTimeThresholds,
} from "./types";
import {
  addMinutesToTime,
  isBefore,
  isAfter,
  groupBy,
  getPreviousDay,
  compareDate,
} from "./utils";

/**
 * Compute end time for an exam
 */
export function computeEndTime(exam: ExamWithSubject): string {
  return addMinutesToTime(exam.startTime, exam.durationMinutes);
}

/**
 * Build schedule days from a list of exams
 */
export function buildScheduleDays(
  exams: ExamWithSubject[],
  config: SchedulerConfig
): ScheduleDay[] {
  const { earliestSameDayArrival, latestSameDayDeparture } = computeTimeThresholds(config);
  const examsByDate = groupBy(exams, (e) => e.date);
  const days: ScheduleDay[] = [];

  for (const [date, dayExams] of examsByDate) {
    const offlineExams = dayExams.filter((e) => !e.isOnline);
    const hasOfflineExam = offlineExams.length > 0;

    let needsTravelTo = false;
    let needsTravelFrom = false;
    let needsAccommodationBefore = false;
    let needsAccommodationAfter = false;

    if (hasOfflineExam) {
      // Find earliest and latest offline exam
      const sortedOffline = [...offlineExams].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      );
      const earliestStart = sortedOffline[0].startTime;
      const latestExam = sortedOffline[sortedOffline.length - 1];
      const latestEnd = computeEndTime(latestExam);

      // Check if we need accommodation before (exam starts too early for same-day travel)
      if (isBefore(earliestStart, earliestSameDayArrival)) {
        needsAccommodationBefore = true;
      } else {
        needsTravelTo = true;
      }

      // Check if we need accommodation after (exam ends too late for same-day travel)
      if (isAfter(latestEnd, latestSameDayDeparture)) {
        needsAccommodationAfter = true;
      } else {
        needsTravelFrom = true;
      }
    }

    days.push({
      date,
      exams: dayExams,
      hasOfflineExam,
      needsTravelTo,
      needsTravelFrom,
      needsAccommodationBefore,
      needsAccommodationAfter,
    });
  }

  // Sort by date
  days.sort((a, b) => compareDate(a.date, b.date));

  return days;
}

/**
 * Calculate total cost for a schedule
 * Handles consolidation of consecutive accommodation nights
 */
export function calculateCost(
  exams: ExamWithSubject[],
  config: SchedulerConfig
): {
  totalCost: number;
  travelCost: number;
  accommodationCost: number;
  travelTrips: number;
  accommodationNights: number;
} {
  if (exams.length === 0) {
    return {
      totalCost: 0,
      travelCost: 0,
      accommodationCost: 0,
      travelTrips: 0,
      accommodationNights: 0,
    };
  }

  const days = buildScheduleDays(exams, config);

  // Track accommodation nights (by the night's date - i.e., the night BEFORE the date you wake up)
  const accommodationNights = new Set<string>();
  let travelTrips = 0;

  for (const day of days) {
    if (!day.hasOfflineExam) continue;

    if (day.needsAccommodationBefore) {
      // Need to stay the night before this day
      accommodationNights.add(getPreviousDay(day.date));
    }

    if (day.needsTravelTo) {
      travelTrips++;
    }

    if (day.needsAccommodationAfter) {
      // Need to stay this night
      accommodationNights.add(day.date);
    }

    if (day.needsTravelFrom) {
      travelTrips++;
    }
  }

  const travelCost = travelTrips * config.travelCostOneWay;
  const accommodationCost = accommodationNights.size * config.accommodationCostPerNight;

  return {
    totalCost: travelCost + accommodationCost,
    travelCost,
    accommodationCost,
    travelTrips,
    accommodationNights: accommodationNights.size,
  };
}

/**
 * Quick cost estimate for branch-and-bound pruning
 * Returns a lower bound on the cost
 */
export function estimateMinimumCost(
  exams: ExamWithSubject[],
  config: SchedulerConfig
): number {
  // Simple estimate: just calculate actual cost
  // Could be optimized to be a true lower bound
  return calculateCost(exams, config).totalCost;
}
