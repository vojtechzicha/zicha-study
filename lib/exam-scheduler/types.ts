// Configurable scheduler settings
export interface SchedulerConfig {
  travelCostOneWay: number;
  travelDurationHours: number;
  accommodationCostPerNight: number;
  // Optional: direct earliest arrival time (HH:MM format)
  // If provided, overrides the computed arrival from travelDurationHours
  earliestArrivalTime?: string;
}

// Default constants (used if no config provided)
export const DEFAULT_CONFIG: SchedulerConfig = {
  travelCostOneWay: 200, // CZK
  travelDurationHours: 4,
  accommodationCostPerNight: 2000, // CZK
  // earliestArrivalTime: undefined - will be computed from travelDurationHours
};

// Computed time thresholds based on travel duration
export function computeTimeThresholds(config: SchedulerConfig): {
  earliestSameDayArrival: string;
  latestSameDayDeparture: string;
} {
  let earliestSameDayArrival: string;

  // If direct arrival time is provided, use it; otherwise compute from travel duration
  if (config.earliestArrivalTime) {
    earliestSameDayArrival = config.earliestArrivalTime;
  } else {
    // If travel takes 4 hours, earliest you can arrive is 4 hours after midnight start
    // Assuming you leave at 5:30 AM, you arrive at 9:30 AM
    const travelMinutes = config.travelDurationHours * 60;
    const departureTime = 5 * 60 + 30; // 5:30 AM
    const arrivalMinutes = departureTime + travelMinutes;
    const arrivalHour = Math.floor(arrivalMinutes / 60);
    const arrivalMin = arrivalMinutes % 60;
    earliestSameDayArrival = `${arrivalHour.toString().padStart(2, "0")}:${arrivalMin.toString().padStart(2, "0")}`;
  }

  // For departure, if you need to be home by 10:30 PM and travel takes 4 hours,
  // you must leave by 6:30 PM
  const travelMinutes = config.travelDurationHours * 60;
  const homeTime = 22 * 60 + 30; // 10:30 PM
  const latestDepartureMinutes = homeTime - travelMinutes;
  const departHour = Math.floor(latestDepartureMinutes / 60);
  const departMin = latestDepartureMinutes % 60;
  const latestSameDayDeparture = `${departHour.toString().padStart(2, "0")}:${departMin.toString().padStart(2, "0")}`;

  return { earliestSameDayArrival, latestSameDayDeparture };
}

// Input types
export interface Subject {
  id: string;
  shortcut: string;
  name: string;
  isComplete: boolean;
}

export interface Exam {
  id: string;
  subjectId: string;
  note: string | null;
  date: string; // YYYY-MM-DD format
  startTime: string; // HH:MM format
  durationMinutes: number;
  isOnline: boolean;
}

export interface ExamWithSubject extends Exam {
  subject: Subject;
  endTime: string; // Computed HH:MM
}

// Scheduling types
export interface ScheduleDay {
  date: string;
  exams: ExamWithSubject[];
  hasOfflineExam: boolean;
  needsTravelTo: boolean;
  needsTravelFrom: boolean;
  needsAccommodationBefore: boolean;
  needsAccommodationAfter: boolean;
}

export type ScheduleItemType =
  | "travel_to"
  | "travel_from"
  | "accommodation"
  | "exam";

export interface ScheduleItem {
  type: ScheduleItemType;
  date: string;
  startTime?: string;
  endTime?: string;
  exam?: ExamWithSubject;
  description: string;
  cost: number;
}

export interface ScheduleResult {
  success: boolean;
  items: ScheduleItem[];
  selectedExams: ExamWithSubject[];
  totalCost: number;
  breakdown: {
    travelCost: number;
    accommodationCost: number;
    travelTrips: number;
    accommodationNights: number;
  };
  error?: string;
}

// Algorithm internal types
export interface ScheduleCandidate {
  exams: ExamWithSubject[];
  cost: number;
}

// Trip segment - represents a contiguous stay in the city
export interface TripSegment {
  arrivalDate: string; // Day you travel TO the city
  departureDate: string; // Day you travel FROM the city
  days: ScheduleDay[]; // Exam days in this segment
  accommodationNights: string[]; // Nights you need to stay
}
