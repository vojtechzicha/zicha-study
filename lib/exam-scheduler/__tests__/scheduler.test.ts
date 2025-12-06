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
      // Subject 1: two options
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
      // Subject 2: same day as e1 option - should prefer this to save travel
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

    // Should pick e1 and e3 (same day) for cheaper travel
    const selectedIds = result.selectedExams.map((e) => e.id).sort();
    expect(selectedIds).toEqual(["e1", "e3"]);

    // Cost should be just one day's travel (400 CZK = 2 trips)
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

    // Should pick e1 and e3 (non-conflicting)
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

    // Should have travel_to, exam, travel_from
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
    // FIXED: Need travel TO (to arrive day before) AND travel FROM (to leave after exam)
    expect(result.breakdown.travelTrips).toBe(2);
    expect(result.totalCost).toBe(2000 + 400); // FIXED: accommodation + 2 trips
  });

  // NEW TEST: Verify schedule items include travel_to BEFORE accommodation
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

    // Find travel_to and accommodation items
    const travelToIndex = result.items.findIndex((i) => i.type === "travel_to");
    const accommodationIndex = result.items.findIndex((i) => i.type === "accommodation");

    // Travel_to should come before accommodation in the sorted schedule
    expect(travelToIndex).toBeLessThan(accommodationIndex);

    // Travel_to should be on the day before exam
    const travelTo = result.items.find((i) => i.type === "travel_to");
    expect(travelTo?.date).toBe("2025-01-09");
  });

  // NEW TEST: Handle consecutive early morning exam days
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

  // NEW TEST: Late exam requiring overnight after
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
        startTime: "19:00", // Late exam
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

  // NEW TEST: Use custom config
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

  // REGRESSION TEST: User scenario - two exams on same day at 8:30 and 15:30
  // with 400 CZK/4h travel (200 CZK one way) and 500 CZK accommodation
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

    // Should need accommodation before (8:30 is too early for same-day travel with 4h trip)
    expect(result.breakdown.accommodationNights).toBe(1);
    expect(result.breakdown.travelTrips).toBe(2); // Travel to + travel from

    // Expected cost: 400 CZK (2 trips * 200) + 500 CZK (1 night) = 900 CZK
    expect(result.breakdown.travelCost).toBe(400);
    expect(result.breakdown.accommodationCost).toBe(500);
    expect(result.totalCost).toBe(900);

    // Verify schedule items are in correct order
    const types = result.items.map((i) => i.type);
    const travelToIndex = types.indexOf("travel_to");
    const accommodationIndex = types.indexOf("accommodation");
    const firstExamIndex = types.indexOf("exam");
    const travelFromIndex = types.indexOf("travel_from");

    // Order should be: travel_to, accommodation, exams, travel_from
    expect(travelToIndex).toBeLessThan(accommodationIndex);
    expect(accommodationIndex).toBeLessThan(firstExamIndex);
    expect(firstExamIndex).toBeLessThan(travelFromIndex);

    // travel_to should be on Jan 16 (day before exam)
    const travelTo = result.items.find((i) => i.type === "travel_to");
    expect(travelTo?.date).toBe("2025-01-16");

    // accommodation should be for night of Jan 16-17
    const accommodation = result.items.find((i) => i.type === "accommodation");
    expect(accommodation?.date).toBe("2025-01-16");

    // travel_from should be on Jan 17 (same day as exams, after they end)
    const travelFrom = result.items.find((i) => i.type === "travel_from");
    expect(travelFrom?.date).toBe("2025-01-17");
  });

  // REGRESSION TEST: Ensure no orphan accommodation (accommodation without travel before)
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
        startTime: "07:00", // Very early
        durationMinutes: 60,
        isOnline: false,
      },
    ];

    const result = generateSchedule(subjects, exams);

    expect(result.success).toBe(true);

    // If there's accommodation, there must be travel_to
    const hasAccommodation = result.items.some((i) => i.type === "accommodation");
    const hasTravelTo = result.items.some((i) => i.type === "travel_to");

    if (hasAccommodation) {
      expect(hasTravelTo).toBe(true);
    }

    // travel_to should always come before or on the same day as first accommodation
    const travelTo = result.items.find((i) => i.type === "travel_to");
    const firstAccommodation = result.items.find((i) => i.type === "accommodation");

    if (travelTo && firstAccommodation) {
      expect(travelTo.date <= firstAccommodation.date).toBe(true);
    }
  });

  // REGRESSION TEST: Gap between exam days - should go home if cheaper
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

    // Should have two separate trip segments
    const travelTos = result.items.filter((i) => i.type === "travel_to");
    const travelFroms = result.items.filter((i) => i.type === "travel_from");

    expect(travelTos).toHaveLength(2); // Travel to on Jan 10 and Jan 14
    expect(travelFroms).toHaveLength(2); // Travel from on Jan 10 and Jan 14
  });

  // REGRESSION TEST: Gap between exam days - should stay if cheaper
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
});
