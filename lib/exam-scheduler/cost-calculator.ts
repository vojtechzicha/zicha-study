import {
  ExamWithSubject,
  ScheduleDay,
  SchedulerConfig,
  TripSegment,
  computeTimeThresholds,
} from "./types";
import {
  addMinutesToTime,
  isBefore,
  isAfter,
  groupBy,
  getPreviousDay,
  getNextDay,
  compareDate,
  daysBetween,
  isWorkingDay,
} from "./utils";

// Days of week treated as working days when none are configured (Mon-Fri).
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

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
 * Build trip segments from offline days, deciding when to go home vs stay
 * For each gap between exam days, compares cost of staying vs going home
 */
export function buildTripSegments(
  offlineDays: ScheduleDay[],
  config: SchedulerConfig
): TripSegment[] {
  if (offlineDays.length === 0) {
    return [];
  }

  const segments: TripSegment[] = [];
  let currentSegmentDays: ScheduleDay[] = [offlineDays[0]];

  for (let i = 0; i < offlineDays.length - 1; i++) {
    const currentDay = offlineDays[i];
    const nextDay = offlineDays[i + 1];
    const gapNights = daysBetween(currentDay.date, nextDay.date);

    // Calculate the ADDITIONAL cost of staying vs going home for this gap
    // Key insight: if the next day requires accommodation before (early exam),
    // that night is mandatory regardless of staying or going home
    // So we only count the gap nights MINUS any mandatory nights

    let additionalStayNights = gapNights;

    // If next day has early exam (needsAccommodationBefore), the night before is mandatory
    // When we split, we'd still need that night in the new segment
    // When we stay, that night is part of the gap
    // So it's NOT an "additional" cost of staying - it's required either way
    if (nextDay.needsAccommodationBefore) {
      additionalStayNights = Math.max(0, gapNights - 1);
    }

    // Similarly, if current day has late exam (needsAccommodationAfter), that night is mandatory
    if (currentDay.needsAccommodationAfter) {
      additionalStayNights = Math.max(0, additionalStayNights - 1);
    }

    const stayCost = additionalStayNights * config.accommodationCostPerNight;
    const goHomeCost = 2 * config.travelCostOneWay; // Round trip

    if (stayCost <= goHomeCost) {
      // Cheaper to stay - continue current segment
      currentSegmentDays.push(nextDay);
    } else {
      // Cheaper to go home - end current segment and start new one
      segments.push(createSegment(currentSegmentDays, config));
      currentSegmentDays = [nextDay];
    }
  }

  // Add the last segment
  segments.push(createSegment(currentSegmentDays, config));

  return segments;
}

/**
 * Create a trip segment from a list of consecutive (or to-be-stayed) exam days
 */
function createSegment(days: ScheduleDay[], _config: SchedulerConfig): TripSegment {
  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  // Determine arrival date
  const arrivalDate = firstDay.needsAccommodationBefore
    ? getPreviousDay(firstDay.date)
    : firstDay.date;

  // Determine departure date
  const departureDate = lastDay.needsAccommodationAfter
    ? getNextDay(lastDay.date)
    : lastDay.date;

  // Calculate accommodation nights
  const accommodationNights: string[] = [];

  // Add night before first day if needed
  if (firstDay.needsAccommodationBefore) {
    accommodationNights.push(getPreviousDay(firstDay.date));
  }

  // Add nights between exam days
  for (let i = 0; i < days.length - 1; i++) {
    const currentDay = days[i];
    const nextDay = days[i + 1];
    const gapNights = daysBetween(currentDay.date, nextDay.date);

    // Add all nights in the gap
    let currentDate = currentDay.date;
    for (let j = 0; j < gapNights; j++) {
      accommodationNights.push(currentDate);
      currentDate = getNextDay(currentDate);
    }
  }

  // Add night after last day if needed
  if (lastDay.needsAccommodationAfter) {
    accommodationNights.push(lastDay.date);
  }

  return {
    arrivalDate,
    departureDate,
    days,
    accommodationNights,
  };
}

/**
 * Calculate total cost for a schedule
 * Uses trip-based logic with gap analysis to decide when to go home vs stay
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
  const offlineDays = days.filter((d) => d.hasOfflineExam);

  // If no offline exams, no travel or accommodation needed
  if (offlineDays.length === 0) {
    return {
      totalCost: 0,
      travelCost: 0,
      accommodationCost: 0,
      travelTrips: 0,
      accommodationNights: 0,
    };
  }

  // Build trip segments (decides when to go home vs stay)
  const segments = buildTripSegments(offlineDays, config);

  // Each segment requires 2 travel trips (to and from)
  const travelTrips = segments.length * 2;

  // Collect all accommodation nights from all segments
  const allNights = new Set<string>();
  for (const segment of segments) {
    for (const night of segment.accommodationNights) {
      allNights.add(night);
    }
  }

  const travelCost = travelTrips * config.travelCostOneWay;
  const accommodationCost = allNights.size * config.accommodationCostPerNight;

  return {
    totalCost: travelCost + accommodationCost,
    travelCost,
    accommodationCost,
    travelTrips,
    accommodationNights: allNights.size,
  };
}

/**
 * Count the PTO days a schedule requires and the resulting virtual penalty.
 *
 * A "PTO day" is a day with at least one in-person (offline) exam that falls on
 * a configured working day. Online-only days never count. Each such day is
 * charged config.ptoDayCost. When preferFreeDayExams is off (or no cost set),
 * the penalty is always zero, so behavior is unchanged.
 *
 * The penalty is additive per exam day, which keeps the total optimization
 * score monotonic non-decreasing as exams are added — preserving the validity
 * of the branch-and-bound pruning in the scheduler.
 */
export function calculatePtoPenalty(
  exams: ExamWithSubject[],
  config: SchedulerConfig
): { penalty: number; ptoDays: number } {
  if (!config.preferFreeDayExams || !config.ptoDayCost) {
    return { penalty: 0, ptoDays: 0 };
  }

  const workingDays =
    config.workingDays && config.workingDays.length > 0
      ? config.workingDays
      : DEFAULT_WORKING_DAYS;

  const days = buildScheduleDays(exams, config);
  let ptoDays = 0;
  for (const day of days) {
    if (day.hasOfflineExam && isWorkingDay(day.date, workingDays)) {
      ptoDays++;
    }
  }

  return { penalty: ptoDays * config.ptoDayCost, ptoDays };
}

/**
 * Optimization score used by the scheduler: real monetary cost plus the
 * virtual PTO penalty. This is what the backtracking minimizes; the
 * user-facing total cost remains the pure money value from calculateCost().
 */
export function calculateScheduleScore(
  exams: ExamWithSubject[],
  config: SchedulerConfig
): number {
  return (
    calculateCost(exams, config).totalCost +
    calculatePtoPenalty(exams, config).penalty
  );
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
