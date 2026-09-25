import { describe, it, expect } from "vitest";
import { generateSchedule } from "../scheduler";
import { Subject, Exam } from "../types";

describe("generateSchedule", () => {
  it("returns empty schedule when all subjects are complete", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: true },
      { id: "s2", shortcut: "DB", name: "Databases", isComplete: true },
    ];
    const exams: Exam[] = [];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(true);
    expect(result.selectedExams).toHaveLength(0);
    expect(result.totalCost).toBe(0);
  });

  it("returns error when incomplete subject has no exams", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
    ];
    const exams: Exam[] = [];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("selects single exam for single incomplete subject", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "10:00",
        durationMinutes: 60,
        isOnline: false,
      },
    ];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(true);
    expect(result.selectedExams).toHaveLength(1);
    expect(result.selectedExams[0].id).toBe("e1");
  });

  it("prefers earlier exam when multiple options available", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-15",
        startTime: "10:00",
        durationMinutes: 60,
        isOnline: false,
      },
      {
        id: "e2",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "10:00",
        durationMinutes: 60,
        isOnline: false,
      },
    ];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(true);
    expect(result.selectedExams[0].id).toBe("e2"); // Earlier date
  });

  it("prefers online exam when dates are equal", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "10:00",
        durationMinutes: 60,
        isOnline: false,
      },
      {
        id: "e2",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "14:00",
        durationMinutes: 60,
        isOnline: true,
      },
    ];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(true);
    expect(result.selectedExams[0].id).toBe("e2"); // Online preferred
    expect(result.totalCost).toBe(0); // Online = no travel cost
  });

  it("finds cheapest schedule with multiple subjects", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
      { id: "s2", shortcut: "DB", name: "Databases", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "10:00",
        durationMinutes: 60,
        isOnline: false,
      },
      {
        id: "e2",
        subjectId: "s1",
        note: null,
        date: "2025-01-12",
        startTime: "10:00",
        durationMinutes: 60,
        isOnline: false,
      },
      // Same day as e1, so pairing them saves a trip.
      {
        id: "e3",
        subjectId: "s2",
        note: null,
        date: "2025-01-10",
        startTime: "14:00",
        durationMinutes: 60,
        isOnline: false,
      },
      {
        id: "e4",
        subjectId: "s2",
        note: null,
        date: "2025-01-15",
        startTime: "10:00",
        durationMinutes: 60,
        isOnline: false,
      },
    ];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(true);
    expect(result.selectedExams).toHaveLength(2);

    const selectedIds = result.selectedExams.map((e) => e.id).sort();
    expect(selectedIds).toEqual(["e1", "e3"]);

    // One round trip (2 × 200).
    expect(result.totalCost).toBe(400);
  });

  it("avoids conflicting exams", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
      { id: "s2", shortcut: "DB", name: "Databases", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "10:00",
        durationMinutes: 120, // 10:00 - 12:00
        isOnline: false,
      },
      {
        id: "e2",
        subjectId: "s2",
        note: null,
        date: "2025-01-10",
        startTime: "11:00", // Conflicts with e1
        durationMinutes: 60,
        isOnline: false,
      },
      {
        id: "e3",
        subjectId: "s2",
        note: null,
        date: "2025-01-10",
        startTime: "14:00", // No conflict
        durationMinutes: 60,
        isOnline: false,
      },
    ];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(true);
    expect(result.selectedExams).toHaveLength(2);

    const selectedIds = result.selectedExams.map((e) => e.id).sort();
    expect(selectedIds).toEqual(["e1", "e3"]);
  });

  it("returns error when no valid schedule exists due to conflicts", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
      { id: "s2", shortcut: "DB", name: "Databases", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "10:00",
        durationMinutes: 120,
        isOnline: false,
      },
      {
        id: "e2",
        subjectId: "s2",
        note: null,
        date: "2025-01-10",
        startTime: "11:00", // Only option, conflicts with e1
        durationMinutes: 60,
        isOnline: false,
      },
    ];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("generates correct schedule items for display", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "10:00",
        durationMinutes: 60,
        isOnline: false,
      },
    ];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);

    const types = result.items.map((i) => i.type);
    expect(types).toContain("travel_to");
    expect(types).toContain("exam");
    expect(types).toContain("travel_from");
  });

  it("handles accommodation correctly for early morning exam", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "08:00", // Too early for same-day travel
        durationMinutes: 60,
        isOnline: false,
      },
    ];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(true);
    expect(result.breakdown.accommodationNights).toBe(1);
    // Arrive the day before, leave after the exam.
    expect(result.breakdown.travelTrips).toBe(2);
    expect(result.totalCost).toBe(2000 + 400);
  });

  it("generates travel_to before accommodation for early morning exam", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "08:00", // Too early for same-day travel
        durationMinutes: 60,
        isOnline: false,
      },
    ];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(true);

    // Should have: travel_to (Jan 9), accommodation (Jan 9-10), exam (Jan 10), travel_from (Jan 10)
    const types = result.items.map((i) => i.type);
    expect(types).toContain("travel_to");
    expect(types).toContain("accommodation");
    expect(types).toContain("exam");
    expect(types).toContain("travel_from");

    const travelToIndex = result.items.findIndex((i) => i.type === "travel_to");
    const accommodationIndex = result.items.findIndex((i) => i.type === "accommodation");

    expect(travelToIndex).toBeLessThan(accommodationIndex);

    const travelTo = result.items.find((i) => i.type === "travel_to");
    expect(travelTo?.date).toBe("2025-01-09");
  });

  it("handles multi-day consecutive early morning exams", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
      { id: "s2", shortcut: "DB", name: "Databases", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "08:00",
        durationMinutes: 60,
        isOnline: false,
      },
      {
        id: "e2",
        subjectId: "s2",
        note: null,
        date: "2025-01-11",
        startTime: "08:00",
        durationMinutes: 60,
        isOnline: false,
      },
    ];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(true);
    expect(result.selectedExams).toHaveLength(2);

    // Should need: travel Jan 9, stay nights Jan 9 and Jan 10, exams Jan 10 & 11, travel home Jan 11
    expect(result.breakdown.accommodationNights).toBe(2);
    expect(result.breakdown.travelTrips).toBe(2);
    expect(result.totalCost).toBe(2 * 2000 + 400); // 2 nights + 2 trips
  });

  it("generates correct schedule for late exam requiring overnight after", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "19:00",
        durationMinutes: 120, // Ends at 21:00
        isOnline: false,
      },
    ];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(true);

    // Should have: travel_to (Jan 10), exam (Jan 10), accommodation (Jan 10-11), travel_from (Jan 11)
    expect(result.breakdown.accommodationNights).toBe(1);
    expect(result.breakdown.travelTrips).toBe(2);

    const travelFrom = result.items.find((i) => i.type === "travel_from");
    expect(travelFrom?.date).toBe("2025-01-11"); // Travel home next day
  });

  it("respects custom config for travel and accommodation costs", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "08:00",
        durationMinutes: 60,
        isOnline: false,
      },
    ];

    const customConfig = {
      travelCostOneWay: 100,
      travelDurationHours: 4,
      accommodationCostPerNight: 500,
    };

    const result = generateSchedule(subjects, exams, customConfig);

    expect(result.success).toBe(true);
    expect(result.breakdown.accommodationCost).toBe(500);
    expect(result.breakdown.travelCost).toBe(200); // 2 trips * 100
    expect(result.totalCost).toBe(700);
  });

  // Reported scenario: exams at 8:30 and 15:30 on one day, 4 h travel at
  // 200 CZK one way, 500 CZK per night.
  it("handles user scenario: two exams on same day with early start", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "MAT", name: "Matematika", isComplete: false },
      { id: "s2", shortcut: "FYZ", name: "Fyzika", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-17",
        startTime: "08:30",
        durationMinutes: 90,
        isOnline: false,
      },
      {
        id: "e2",
        subjectId: "s2",
        note: null,
        date: "2025-01-17",
        startTime: "15:30",
        durationMinutes: 90,
        isOnline: false,
      },
    ];

    const userConfig = {
      travelCostOneWay: 200, // 400 CZK total for round trip
      travelDurationHours: 4,
      accommodationCostPerNight: 500,
    };

    const result = generateSchedule(subjects, exams, userConfig);

    expect(result.success).toBe(true);
    expect(result.selectedExams).toHaveLength(2);

    // 8:30 is before the 9:30 same-day arrival, so one night before.
    expect(result.breakdown.accommodationNights).toBe(1);
    expect(result.breakdown.travelTrips).toBe(2);

    // Expected cost: 400 CZK (2 trips * 200) + 500 CZK (1 night) = 900 CZK
    expect(result.breakdown.travelCost).toBe(400);
    expect(result.breakdown.accommodationCost).toBe(500);
    expect(result.totalCost).toBe(900);

    const types = result.items.map((i) => i.type);
    const travelToIndex = types.indexOf("travel_to");
    const accommodationIndex = types.indexOf("accommodation");
    const firstExamIndex = types.indexOf("exam");
    const travelFromIndex = types.indexOf("travel_from");

    expect(travelToIndex).toBeLessThan(accommodationIndex);
    expect(accommodationIndex).toBeLessThan(firstExamIndex);
    expect(firstExamIndex).toBeLessThan(travelFromIndex);

    const travelTo = result.items.find((i) => i.type === "travel_to");
    expect(travelTo?.date).toBe("2025-01-16");

    const accommodation = result.items.find((i) => i.type === "accommodation");
    expect(accommodation?.date).toBe("2025-01-16");

    const travelFrom = result.items.find((i) => i.type === "travel_from");
    expect(travelFrom?.date).toBe("2025-01-17");
  });

  it("never generates accommodation without travel_to before it", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-17",
        startTime: "07:00",
        durationMinutes: 60,
        isOnline: false,
      },
    ];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(true);

    const hasAccommodation = result.items.some((i) => i.type === "accommodation");
    const hasTravelTo = result.items.some((i) => i.type === "travel_to");

    if (hasAccommodation) {
      expect(hasTravelTo).toBe(true);
    }

    const travelTo = result.items.find((i) => i.type === "travel_to");
    const firstAccommodation = result.items.find((i) => i.type === "accommodation");

    if (travelTo && firstAccommodation) {
      expect(travelTo.date <= firstAccommodation.date).toBe(true);
    }
  });

  it("handles gap between exam days - goes home if cheaper than staying", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "MAT", name: "Matematika", isComplete: false },
      { id: "s2", shortcut: "FYZ", name: "Fyzika", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "15:30", // Afternoon, same-day travel possible
        durationMinutes: 90,
        isOnline: false,
      },
      {
        id: "e2",
        subjectId: "s2",
        note: null,
        date: "2025-01-14", // 4 days later
        startTime: "11:00",
        durationMinutes: 90,
        isOnline: false,
      },
    ];

    const userConfig = {
      travelCostOneWay: 200,
      travelDurationHours: 4,
      accommodationCostPerNight: 500,
    };

    const result = generateSchedule(subjects, exams, userConfig);

    expect(result.success).toBe(true);
    expect(result.selectedExams).toHaveLength(2);

    // Cost comparison:
    // Option A (stay): 2 trips (400 CZK) + 4 nights Jan 10,11,12,13 (2000 CZK) = 2400 CZK
    // Option B (go home): 4 trips (800 CZK) + 0 nights = 800 CZK
    // Going home is cheaper, so should be 4 trips, 0 nights

    expect(result.breakdown.travelTrips).toBe(4); // 2 trips for each exam day
    expect(result.breakdown.accommodationNights).toBe(0);
    expect(result.totalCost).toBe(800);

    const travelTos = result.items.filter((i) => i.type === "travel_to");
    const travelFroms = result.items.filter((i) => i.type === "travel_from");

    expect(travelTos).toHaveLength(2); // Travel to on Jan 10 and Jan 14
    expect(travelFroms).toHaveLength(2); // Travel from on Jan 10 and Jan 14
  });

  it("handles gap between exam days - stays if cheaper than going home", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "MAT", name: "Matematika", isComplete: false },
      { id: "s2", shortcut: "FYZ", name: "Fyzika", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "15:30",
        durationMinutes: 90,
        isOnline: false,
      },
      {
        id: "e2",
        subjectId: "s2",
        note: null,
        date: "2025-01-12", // Only 2 days later
        startTime: "11:00",
        durationMinutes: 90,
        isOnline: false,
      },
    ];

    const userConfig = {
      travelCostOneWay: 200,
      travelDurationHours: 4,
      accommodationCostPerNight: 100, // Very cheap accommodation
    };

    const result = generateSchedule(subjects, exams, userConfig);

    expect(result.success).toBe(true);
    expect(result.selectedExams).toHaveLength(2);

    // Cost comparison:
    // Option A (stay): 2 trips (400 CZK) + 2 nights Jan 10,11 (200 CZK) = 600 CZK
    // Option B (go home): 4 trips (800 CZK) + 0 nights = 800 CZK
    // Staying is cheaper, so should be 2 trips, 2 nights

    expect(result.breakdown.travelTrips).toBe(2);
    expect(result.breakdown.accommodationNights).toBe(2);
    expect(result.totalCost).toBe(600);
  });

  it("respects custom earliestArrivalTime for early morning exams", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ALG", name: "Algorithms", isComplete: false },
    ];
    const exams: Exam[] = [
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2025-01-10",
        startTime: "09:00",
        durationMinutes: 90,
        isOnline: false,
      },
    ];

    // With default config (4h travel, 5:30 AM departure = 9:30 AM arrival),
    // a 9:00 AM exam would require overnight stay
    const defaultResult = generateSchedule(subjects, exams, {
      travelCostOneWay: 200,
      travelDurationHours: 4,
      accommodationCostPerNight: 2000,
    });

    expect(defaultResult.success).toBe(true);
    expect(defaultResult.breakdown.accommodationNights).toBe(1);
    expect(defaultResult.totalCost).toBe(2400); // 400 travel + 2000 accommodation

    // With custom earliestArrivalTime of 08:50, same-day travel is possible
    const customResult = generateSchedule(subjects, exams, {
      travelCostOneWay: 200,
      travelDurationHours: 4,
      accommodationCostPerNight: 2000,
      earliestArrivalTime: "08:50",
    });

    expect(customResult.success).toBe(true);
    expect(customResult.breakdown.accommodationNights).toBe(0);
    expect(customResult.totalCost).toBe(400); // Just 2 trips, no accommodation
  });

  it("prefers earlier exam date when earliestArrivalTime makes it feasible", () => {
    const subjects: Subject[] = [
      { id: "s1", shortcut: "ACJ", name: "Anglický jazyk", isComplete: false },
      { id: "s2", shortcut: "EFP", name: "Etika a filozofie", isComplete: false },
    ];
    const exams: Exam[] = [
      // ACJ_1 option 1: Jan 10 at 9:00 AM (early, might need overnight)
      {
        id: "e1",
        subjectId: "s1",
        note: null,
        date: "2026-01-10",
        startTime: "09:00",
        durationMinutes: 90,
        isOnline: false,
      },
      // ACJ_1 option 2: Jan 24 at 11:00 AM (later, safe for same-day travel)
      {
        id: "e2",
        subjectId: "s1",
        note: null,
        date: "2026-01-24",
        startTime: "11:00",
        durationMinutes: 90,
        isOnline: false,
      },
      // EFP exam on Jan 10 at 12:10 (we're already traveling there this day)
      {
        id: "e3",
        subjectId: "s2",
        note: null,
        date: "2026-01-10",
        startTime: "12:10",
        durationMinutes: 110,
        isOnline: false,
      },
    ];

    // With earliestArrivalTime of 08:50, both Jan 10 exams can be done same-day
    const result = generateSchedule(subjects, exams, {
      travelCostOneWay: 200,
      travelDurationHours: 4,
      accommodationCostPerNight: 2000,
      earliestArrivalTime: "08:50",
    });

    expect(result.success).toBe(true);
    expect(result.selectedExams).toHaveLength(2);

    // Both Jan 10 exams share one trip.
    const selectedIds = result.selectedExams.map((e) => e.id).sort();
    expect(selectedIds).toEqual(["e1", "e3"]);

    expect(result.breakdown.travelTrips).toBe(2);
    expect(result.breakdown.accommodationNights).toBe(0);
    expect(result.totalCost).toBe(400);
  });
});
