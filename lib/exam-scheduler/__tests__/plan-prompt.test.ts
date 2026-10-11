import { describe, it, expect } from "vitest";
import {
  generateGlobalSchedule,
  type GlobalRequirement,
  type GlobalStudyConfig,
  type GlobalTerm,
} from "../global-scheduler";
import { buildExamPlanPrompt, type PlanPromptInput } from "../plan-prompt";

function cfg(studyId: string, studyName: string): GlobalStudyConfig {
  return {
    studyId,
    studyName,
    travelCostOneWay: 200,
    travelDurationHours: 2,
    accommodationCostPerNight: 2000,
    preferFreeDayExams: false,
    ptoDayCost: 5500,
    workingDays: [1, 2, 3, 4, 5],
  };
}

function term(termId: string, date: string, startTime: string, opts: Partial<GlobalTerm> = {}): GlobalTerm {
  return {
    termId,
    date,
    startTime,
    durationMinutes: 90,
    isOnline: false,
    note: null,
    locked: false,
    ...opts,
  };
}

function req(periodId: string, subjectId: string, name: string, terms: GlobalTerm[]): GlobalRequirement {
  return {
    requirementId: `${periodId}:${subjectId}`,
    periodId,
    periodName: "Zimní zkouškové",
    studyId: "s1",
    subjectId,
    subjectShortcut: subjectId.toUpperCase(),
    subjectName: name,
    windowStart: "2027-01-04",
    windowEnd: "2027-02-12",
    terms,
  };
}

function build(requirements: GlobalRequirement[], extra: Partial<PlanPromptInput> = {}): string {
  const studies = [cfg("s1", "VŠE – Informatika")];
  return buildExamPlanPrompt({
    comparison: generateGlobalSchedule(requirements, studies, 60),
    requirements,
    studies,
    periods: [
      { id: "p1", studyId: "s1", name: "Zimní zkouškové", startDate: "2027-01-04", endDate: "2027-02-12", subjectIds: ["mat", "eko", "pra", "dej"] },
    ],
    subjects: [
      { id: "mat", name: "Matematika", abbreviation: "MAT", completionType: "Zápočet + Zkouška\n(Zp+Zk)", credits: 6 },
      { id: "eko", name: "Ekonomie", abbreviation: "EKO" },
      { id: "pra", name: "Právo", abbreviation: "PRA" },
      { id: "dej", name: "Dějiny", abbreviation: "DEJ", completed: true },
    ],
    today: "2026-10-11",
    ...extra,
  });
}

describe("buildExamPlanPrompt", () => {
  const requirements = [
    req("p1", "mat", "Matematika", [
      term("m1", "2027-01-11", "09:00", { locked: true, note: "učebna RB 101" }),
      term("m2", "2027-01-25", "09:00"),
    ]),
    req("p1", "eko", "Ekonomie", [term("e1", "2027-01-13", "10:00", { isOnline: true, isTentative: true })]),
  ];

  it("lists the chronological schedule with travel and exams", () => {
    const prompt = build(requirements);
    expect(prompt).toContain("# My exam plan (snapshot from 2026-10-11 (Sun))");
    expect(prompt).toContain("### 2027-01-11 (Mon)");
    expect(prompt).toContain("07:00 travel to school – VŠE – Informatika (about 2 h) · 200 CZK");
    expect(prompt).toContain(
      "09:00–10:30 EXAM [MAT] Matematika – VŠE – Informatika · in person · locked – note: učebna RB 101"
    );
    expect(prompt).toContain("10:30 travel home – VŠE – Informatika (about 2 h) · 200 CZK");
    expect(prompt).toContain("10:00–11:30 EXAM [EKO] Ekonomie – VŠE – Informatika · online · tentative (Předběžný)");
  });

  it("lists selected and other terms per subject", () => {
    const prompt = build(requirements);
    expect(prompt).toContain("**Zimní zkouškové** (2027-01-04 – 2027-02-12)");
    expect(prompt).toContain("- [MAT] Matematika (Zápočet + Zkouška (Zp+Zk), 6 credits)");
    expect(prompt).toContain("  - Selected: 2027-01-11 (Mon) 09:00–10:30 · in person · locked");
    expect(prompt).toContain("    - 2027-01-25 (Mon) 09:00–10:30 · in person");
  });

  it("marks subjects without terms and completed subjects", () => {
    const prompt = build(requirements);
    expect(prompt).toContain("- [PRA] Právo: no terms announced yet – still has to be passed in this period");
    expect(prompt).toContain("- [DEJ] Dějiny: already passed, nothing to plan");
  });

  it("reports unscheduled requirements and costs", () => {
    const prompt = build([
      ...requirements,
      req("p1", "pra", "Právo", [term("x1", "2027-03-01", "09:00")]),
    ]);
    expect(prompt).toContain("- [PRA] Právo – NOT SCHEDULED: žádný termín nespadá do období");
    expect(prompt).toContain("## Open issues");
    expect(prompt).toContain("## Costs");
    expect(prompt).toContain("Total 400 CZK");
  });

  it("handles an empty plan", () => {
    const prompt = build([]);
    expect(prompt).toContain("No exams are scheduled yet.");
    expect(prompt).not.toContain("## Costs");
  });
});
