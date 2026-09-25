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

export function computeEndTime(exam: ExamWithSubject): string {
  return addMinutesToTime(exam.startTime, exam.durationMinutes);
}

/**
 * Groups exams by date. For each day with an in-person exam, decides whether
 * same-day travel works or a night is needed before and/or after.
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
      const sortedOffline = [...offlineExams].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      );
      const earliestStart = sortedOffline[0].startTime;
      const latestExam = sortedOffline[sortedOffline.length - 1];
      const latestEnd = computeEndTime(latestExam);

      // Starts before a same-day arrival is possible.
      if (isBefore(earliestStart, earliestSameDayArrival)) {
        needsAccommodationBefore = true;
      } else {
        needsTravelTo = true;
      }

      // Ends too late to get home the same day.
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

  days.sort((a, b) => compareDate(a.date, b.date));

  return days;
}

/**
 * Splits in-person exam days into trips. For each gap between consecutive days,
 * stays in the city if the extra nights cost no more than a round trip home.
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

    // Only count nights that staying adds. The night before an early exam and
    // the night after a late exam are paid whether we stay or go home.
    let additionalStayNights = gapNights;

    if (nextDay.needsAccommodationBefore) {
      additionalStayNights = Math.max(0, gapNights - 1);
    }

    if (currentDay.needsAccommodationAfter) {
      additionalStayNights = Math.max(0, additionalStayNights - 1);
    }

    const stayCost = additionalStayNights * config.accommodationCostPerNight;
    const goHomeCost = 2 * config.travelCostOneWay; // Round trip

    if (stayCost <= goHomeCost) {
      currentSegmentDays.push(nextDay);
    } else {
      segments.push(createSegment(currentSegmentDays, config));
      currentSegmentDays = [nextDay];
    }
  }

  segments.push(createSegment(currentSegmentDays, config));

  return segments;
}

function createSegment(days: ScheduleDay[], _config: SchedulerConfig): TripSegment {
  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  const arrivalDate = firstDay.needsAccommodationBefore
    ? getPreviousDay(firstDay.date)
    : firstDay.date;

  const departureDate = lastDay.needsAccommodationAfter
    ? getNextDay(lastDay.date)
    : lastDay.date;

  // Each night is identified by the date it starts on.
  const accommodationNights: string[] = [];

  if (firstDay.needsAccommodationBefore) {
    accommodationNights.push(getPreviousDay(firstDay.date));
  }

  for (let i = 0; i < days.length - 1; i++) {
    const currentDay = days[i];
    const nextDay = days[i + 1];
    const gapNights = daysBetween(currentDay.date, nextDay.date);

    let currentDate = currentDay.date;
    for (let j = 0; j < gapNights; j++) {
      accommodationNights.push(currentDate);
      currentDate = getNextDay(currentDate);
    }
  }

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
 * Real money cost of a schedule: travel and accommodation per trip segment
 * (see buildTripSegments). Online-only days cost nothing.
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

  if (offlineDays.length === 0) {
    return {
      totalCost: 0,
      travelCost: 0,
      accommodationCost: 0,
      travelTrips: 0,
      accommodationNights: 0,
    };
  }

  const segments = buildTripSegments(offlineDays, config);

  // One trip there and one back per segment.
  const travelTrips = segments.length * 2;

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
 * A PTO day is a working day with at least one in-person exam; online-only days
 * never count. Each costs config.ptoDayCost. Zero when preferFreeDayExams is off
 * or no cost is set.
 *
 * The penalty is additive per exam day, so it never decreases as exams are
 * added. The scheduler's branch-and-bound pruning relies on that.
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
 * What the scheduler minimizes: real money cost plus the virtual PTO penalty.
 * The user-facing total stays the pure money value from calculateCost().
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
 * Unused. Returns the exact cost of `exams`, not a lower bound for extending
 * them; the schedulers prune on the real score instead.
 */
export function estimateMinimumCost(
  exams: ExamWithSubject[],
  config: SchedulerConfig
): number {
  return calculateCost(exams, config).totalCost;
}
