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
    const exam = createExam("e1", "2025-01-10", "10:00", 60, false);
    const result = calculateCost([exam], DEFAULT_CONFIG);

    expect(result.travelTrips).toBe(2);
    expect(result.travelCost).toBe(2 * DEFAULT_CONFIG.travelCostOneWay);
    expect(result.accommodationNights).toBe(0);
    expect(result.totalCost).toBe(400);
  });

  it("calculates accommodation before for early exam (starts before 9:30)", () => {
    const exam = createExam("e1", "2025-01-10", "08:00", 60, false);
    const result = calculateCost([exam], DEFAULT_CONFIG);

    // Travel there the day before, one night, travel home after the exam.
    expect(result.accommodationNights).toBe(1);
    expect(result.accommodationCost).toBe(DEFAULT_CONFIG.accommodationCostPerNight);
    expect(result.travelTrips).toBe(2);
    expect(result.totalCost).toBe(2000 + 400);
  });

  it("calculates accommodation after for late exam (ends after 18:30)", () => {
    const exam = createExam("e1", "2025-01-10", "17:00", 120, false);
    const result = calculateCost([exam], DEFAULT_CONFIG);

    // Travel there, one night after the exam, travel home the next day.
    expect(result.accommodationNights).toBe(1);
    expect(result.travelTrips).toBe(2);
    expect(result.totalCost).toBe(400 + 2000);
  });

  it("calculates both accommodations for exam spanning both thresholds", () => {
    const exam = createExam("e1", "2025-01-10", "08:00", 660, false);
    const result = calculateCost([exam], DEFAULT_CONFIG);

    // Arrive the day before, leave the day after.
    expect(result.accommodationNights).toBe(2);
    expect(result.travelTrips).toBe(2);
    expect(result.totalCost).toBe(2 * 2000 + 400);
  });

  it("handles multiple exams on same day correctly", () => {
    const exam1 = createExam("e1", "2025-01-10", "10:00", 60, false);
    const exam2 = createExam("e2", "2025-01-10", "14:00", 60, false);
    const result = calculateCost([exam1, exam2], DEFAULT_CONFIG);

    expect(result.travelTrips).toBe(2);
    expect(result.totalCost).toBe(400);
  });

  it("handles mixed online and offline on same day", () => {
    const onlineExam = createExam("e1", "2025-01-10", "10:00", 60, true);
    const offlineExam = createExam("e2", "2025-01-10", "14:00", 60, false);
    const result = calculateCost([onlineExam, offlineExam], DEFAULT_CONFIG);

    expect(result.travelTrips).toBe(2);
    expect(result.totalCost).toBe(400);
  });

  it("consolidates accommodation across consecutive early morning exam days", () => {
    const exam1 = createExam("e1", "2025-01-10", "08:00", 60, false);
    const exam2 = createExam("e2", "2025-01-11", "08:00", 60, false);
    const result = calculateCost([exam1, exam2], DEFAULT_CONFIG);

    // Travel to (Jan 9), stay nights Jan 9 and Jan 10, travel from (Jan 11)
    expect(result.accommodationNights).toBe(2);
    expect(result.travelTrips).toBe(2);
    expect(result.totalCost).toBe(2 * 2000 + 400);
  });
});

describe("staying over between exam days", () => {
  it("does not stay when travel and accommodation are both free (a study in the home city)", () => {
    const homeCity = { ...DEFAULT_CONFIG, travelCostOneWay: 0, accommodationCostPerNight: 0, travelDurationHours: 1.5, earliestArrivalTime: "06:00" };
    const december = createExam("e1", "2026-12-13", "12:15", 120, false);
    const january = createExam("e2", "2027-01-04", "07:30", 50, false);
    const result = calculateCost([december, january], homeCity);

    // Two trips three weeks apart, not one trip with 22 nights in between.
    expect(result.accommodationNights).toBe(0);
    expect(result.travelTrips).toBe(4);
    expect(result.totalCost).toBe(0);
  });

  it("goes home when a night costs exactly as much as the round trip", () => {
    const tie = { ...DEFAULT_CONFIG, accommodationCostPerNight: 400 }; // round trip 2 × 200
    const exam1 = createExam("e1", "2025-01-10", "12:00", 60, false);
    const exam2 = createExam("e2", "2025-01-11", "12:00", 60, false);
    const result = calculateCost([exam1, exam2], tie);

    expect(result.accommodationNights).toBe(0);
    expect(result.travelTrips).toBe(4);
    expect(result.totalCost).toBe(800);
  });

  it("stays when the night is cheaper than the round trip", () => {
    const cheapNight = { ...DEFAULT_CONFIG, accommodationCostPerNight: 300 };
    const exam1 = createExam("e1", "2025-01-10", "12:00", 60, false);
    const exam2 = createExam("e2", "2025-01-11", "12:00", 60, false);
    const result = calculateCost([exam1, exam2], cheapNight);

    expect(result.accommodationNights).toBe(1);
    expect(result.travelTrips).toBe(2);
    expect(result.totalCost).toBe(300 + 400);
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
