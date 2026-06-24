import { describe, it, expect } from "vitest";
import { generateSchedule } from "../scheduler";
import { Subject, Exam, SchedulerConfig } from "../types";

// Date reference (2025): Jan 10 = Friday (working), Jan 11 = Saturday (free),
// Jan 12 = Sunday (free), Jan 13 = Monday (working).
const FRIDAY = "2025-01-10";
const SATURDAY = "2025-01-11";
const SUNDAY = "2025-01-12";

const BASE_CONFIG: SchedulerConfig = {
  travelCostOneWay: 200,
  travelDurationHours: 4, // earliest same-day arrival 09:30, latest departure 18:30
  accommodationCostPerNight: 2000,
};

const subject: Subject = {
  id: "s1",
  shortcut: "ALG",
  name: "Algorithms",
  isComplete: false,
};

function exam(id: string, date: string, startTime: string, isOnline = false): Exam {
  return { id, subjectId: "s1", note: null, date, startTime, durationMinutes: 60, isOnline };
}

describe("free-day (weekend) preference", () => {
  it("is off by default: still prefers the earliest date", () => {
    const exams = [exam("fri", FRIDAY, "10:00"), exam("sat", SATURDAY, "10:00")];
    const result = generateSchedule([subject], exams, BASE_CONFIG);

    expect(result.success).toBe(true);
    expect(result.selectedExams[0].id).toBe("fri"); // earlier date wins
    expect(result.breakdown.ptoDays).toBe(0); // not tracked when feature is off
  });

  it("prefers the free-day term when monetary cost is equal", () => {
    const exams = [exam("fri", FRIDAY, "10:00"), exam("sat", SATURDAY, "10:00")];
    const result = generateSchedule([subject], exams, {
      ...BASE_CONFIG,
      preferFreeDayExams: true,
      ptoDayCost: 5500,
      workingDays: [1, 2, 3, 4, 5],
    });

    expect(result.success).toBe(true);
    expect(result.selectedExams[0].id).toBe("sat"); // weekend chosen despite being later
    expect(result.breakdown.ptoDays).toBe(0); // Saturday is a free day
    expect(result.totalCost).toBe(400); // pure money (one round trip), penalty excluded
  });

  it("balances: keeps the cheaper working-day term when the PTO cost is low", () => {
    // Weekday term is midday (no accommodation); weekend term starts early and
    // needs a night before (+2000). PTO day costs only 100, so it is not worth it.
    const exams = [exam("fri", FRIDAY, "10:00"), exam("sat", SATURDAY, "08:00")];
    const result = generateSchedule([subject], exams, {
      ...BASE_CONFIG,
      preferFreeDayExams: true,
      ptoDayCost: 100,
      workingDays: [1, 2, 3, 4, 5],
    });

    expect(result.success).toBe(true);
    expect(result.selectedExams[0].id).toBe("fri");
    expect(result.breakdown.ptoDays).toBe(1); // working-day in-person exam
    expect(result.totalCost).toBe(400); // money only — the 100 penalty is NOT added
  });

  it("balances: switches to the free-day term when the PTO cost outweighs travel", () => {
    const exams = [exam("fri", FRIDAY, "10:00"), exam("sat", SATURDAY, "08:00")];
    const result = generateSchedule([subject], exams, {
      ...BASE_CONFIG,
      preferFreeDayExams: true,
      ptoDayCost: 5500, // saving a PTO day is worth more than the +2000 accommodation
      workingDays: [1, 2, 3, 4, 5],
    });

    expect(result.success).toBe(true);
    expect(result.selectedExams[0].id).toBe("sat");
    expect(result.breakdown.ptoDays).toBe(0);
    expect(result.totalCost).toBe(2400); // 1 round trip (400) + 1 night (2000)
  });

  it("does not penalize online exams on working days", () => {
    const exams = [exam("fri", FRIDAY, "10:00", true), exam("sat", SATURDAY, "10:00")];
    const result = generateSchedule([subject], exams, {
      ...BASE_CONFIG,
      preferFreeDayExams: true,
      ptoDayCost: 5500,
      workingDays: [1, 2, 3, 4, 5],
    });

    expect(result.success).toBe(true);
    // Online Friday exam costs nothing (no travel, no PTO) and is cheaper than a
    // Saturday in-person trip, so it should win.
    expect(result.selectedExams[0].id).toBe("fri");
    expect(result.breakdown.ptoDays).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it("respects a custom working-days set (Saturday as a working day)", () => {
    const exams = [exam("sat", SATURDAY, "10:00"), exam("sun", SUNDAY, "10:00")];
    const result = generateSchedule([subject], exams, {
      ...BASE_CONFIG,
      preferFreeDayExams: true,
      ptoDayCost: 5500,
      workingDays: [1, 2, 3, 4, 5, 6], // Saturday now counts as a working day
    });

    expect(result.success).toBe(true);
    // Saturday is now a PTO day, Sunday is free -> Sunday should be chosen.
    expect(result.selectedExams[0].id).toBe("sun");
    expect(result.breakdown.ptoDays).toBe(0);
  });
});
