import { describe, it, expect } from "vitest";
import { calculateCost, buildScheduleDays } from "../cost-calculator";
import { ExamWithSubject, Subject, DEFAULT_CONFIG } from "../types";

const mockSubject: Subject = {
  id: "s1",
  shortcut: "TEST",
  name: "Test Subject",
  isComplete: false,
};

function createExam(
  id: string,
  date: string,
  startTime: string,
  durationMinutes: number,
  isOnline = false
): ExamWithSubject {
  const [hours, minutes] = startTime.split(":").map(Number);
  const endMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  const endTime = `${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`;

  return {
    id,
    subjectId: "s1",
    note: null,
    date,
    startTime,
    durationMinutes,
    isOnline,
    subject: mockSubject,
    endTime,
  };
}

describe("calculateCost", () => {
  it("returns zero cost for empty exam list", () => {
    const result = calculateCost([], DEFAULT_CONFIG);
    expect(result.totalCost).toBe(0);
    expect(result.travelCost).toBe(0);
    expect(result.accommodationCost).toBe(0);
  });

  it("returns zero cost for online-only exams", () => {
    const exam = createExam("e1", "2025-01-10", "10:00", 60, true);
    const result = calculateCost([exam], DEFAULT_CONFIG);
    expect(result.totalCost).toBe(0);
    expect(result.travelTrips).toBe(0);
    expect(result.accommodationNights).toBe(0);
  });

  it("calculates travel cost for same-day possible exam (starts after 9:30, ends before 18:30)", () => {
    // Exam from 10:00 to 11:00 - can travel same day
    const exam = createExam("e1", "2025-01-10", "10:00", 60, false);
    const result = calculateCost([exam], DEFAULT_CONFIG);

    // Should have 2 one-way trips (to and from)
    expect(result.travelTrips).toBe(2);
    expect(result.travelCost).toBe(2 * DEFAULT_CONFIG.travelCostOneWay);
    expect(result.accommodationNights).toBe(0);
    expect(result.totalCost).toBe(400);
  });

  it("calculates accommodation before for early exam (starts before 9:30)", () => {
    // Exam at 8:00 - too early for same-day travel
    const exam = createExam("e1", "2025-01-10", "08:00", 60, false);
    const result = calculateCost([exam], DEFAULT_CONFIG);

    // FIXED: Should need travel TO (day before) + accommodation night before + travel FROM
    expect(result.accommodationNights).toBe(1);
    expect(result.accommodationCost).toBe(DEFAULT_CONFIG.accommodationCostPerNight);
    expect(result.travelTrips).toBe(2); // FIXED: travel to AND from
    expect(result.totalCost).toBe(2000 + 400); // FIXED: accommodation + 2 trips
  });

  it("calculates accommodation after for late exam (ends after 18:30)", () => {
    // Exam from 17:00 to 19:00 - too late to travel home
    const exam = createExam("e1", "2025-01-10", "17:00", 120, false);
    const result = calculateCost([exam], DEFAULT_CONFIG);

    // FIXED: Should need travel TO + exam + accommodation night after + travel FROM (next day)
    expect(result.accommodationNights).toBe(1);
    expect(result.travelTrips).toBe(2); // FIXED: travel to AND from
    expect(result.totalCost).toBe(400 + 2000); // FIXED: 2 trips + accommodation
  });

  it("calculates both accommodations for exam spanning both thresholds", () => {
    // Exam from 08:00 to 19:00 - too early AND too late
    const exam = createExam("e1", "2025-01-10", "08:00", 660, false);
    const result = calculateCost([exam], DEFAULT_CONFIG);

    // Should need accommodation before AND after + 2 travel trips (arrive day before, leave day after)
    expect(result.accommodationNights).toBe(2);
    expect(result.travelTrips).toBe(2); // Travel to (day before), travel from (day after)
    expect(result.totalCost).toBe(2 * 2000 + 400);
  });

  it("handles multiple exams on same day correctly", () => {
    // Two exams on same day, both in the "same-day travel" window
    const exam1 = createExam("e1", "2025-01-10", "10:00", 60, false);
    const exam2 = createExam("e2", "2025-01-10", "14:00", 60, false);
    const result = calculateCost([exam1, exam2], DEFAULT_CONFIG);

    // Should only count travel once (to and from for the day)
    expect(result.travelTrips).toBe(2);
    expect(result.totalCost).toBe(400);
  });

  it("handles mixed online and offline on same day", () => {
    // One online, one offline
    const onlineExam = createExam("e1", "2025-01-10", "10:00", 60, true);
    const offlineExam = createExam("e2", "2025-01-10", "14:00", 60, false);
    const result = calculateCost([onlineExam, offlineExam], DEFAULT_CONFIG);

    // Online doesn't affect travel, only offline matters
    expect(result.travelTrips).toBe(2);
    expect(result.totalCost).toBe(400);
  });

  it("consolidates accommodation across consecutive early morning exam days", () => {
    // Two days with early morning exams (8:00) - need to stay overnight before each
    const exam1 = createExam("e1", "2025-01-10", "08:00", 60, false);
    const exam2 = createExam("e2", "2025-01-11", "08:00", 60, false);
    const result = calculateCost([exam1, exam2], DEFAULT_CONFIG);

    // Travel to (Jan 9), stay nights Jan 9 and Jan 10, travel from (Jan 11)
    expect(result.accommodationNights).toBe(2);
    expect(result.travelTrips).toBe(2);
    expect(result.totalCost).toBe(2 * 2000 + 400);
  });
});

describe("buildScheduleDays", () => {
  it("groups exams by date", () => {
    const exam1 = createExam("e1", "2025-01-10", "10:00", 60);
    const exam2 = createExam("e2", "2025-01-10", "14:00", 60);
    const exam3 = createExam("e3", "2025-01-11", "10:00", 60);

    const days = buildScheduleDays([exam1, exam2, exam3], DEFAULT_CONFIG);

    expect(days).toHaveLength(2);
    expect(days[0].date).toBe("2025-01-10");
    expect(days[0].exams).toHaveLength(2);
    expect(days[1].date).toBe("2025-01-11");
    expect(days[1].exams).toHaveLength(1);
  });

  it("correctly identifies offline days", () => {
    const offlineExam = createExam("e1", "2025-01-10", "10:00", 60, false);
    const onlineExam = createExam("e2", "2025-01-11", "10:00", 60, true);

    const days = buildScheduleDays([offlineExam, onlineExam], DEFAULT_CONFIG);

    expect(days[0].hasOfflineExam).toBe(true);
    expect(days[1].hasOfflineExam).toBe(false);
  });

  it("sorts days by date", () => {
    const exam1 = createExam("e1", "2025-01-15", "10:00", 60);
    const exam2 = createExam("e2", "2025-01-10", "10:00", 60);
    const exam3 = createExam("e3", "2025-01-12", "10:00", 60);

    const days = buildScheduleDays([exam1, exam2, exam3], DEFAULT_CONFIG);

    expect(days[0].date).toBe("2025-01-10");
    expect(days[1].date).toBe("2025-01-12");
    expect(days[2].date).toBe("2025-01-15");
  });
});
