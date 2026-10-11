import { describe, it, expect } from "vitest";
import {
  generateGlobalSchedule,
  type GlobalStudyConfig,
  type GlobalRequirement,
  type GlobalTerm,
  type GlobalScheduleResult,
} from "../global-scheduler";
import { parseTimeToMinutes } from "../utils";

// ─── Builders ────────────────────────────────────────────────────────────────

function cfg(studyId: string, opts: Partial<GlobalStudyConfig> = {}): GlobalStudyConfig {
  return {
    studyId,
    studyName: opts.studyName ?? studyId,
    travelCostOneWay: opts.travelCostOneWay ?? 200,
    travelDurationHours: opts.travelDurationHours ?? 2,
    accommodationCostPerNight: opts.accommodationCostPerNight ?? 2000,
    earliestArrivalTime: opts.earliestArrivalTime,
    preferFreeDayExams: opts.preferFreeDayExams ?? false,
    ptoDayCost: opts.ptoDayCost ?? 5500,
    workingDays: opts.workingDays ?? [1, 2, 3, 4, 5],
  };
}

function term(
  termId: string,
  date: string,
  startTime: string,
  opts: { dur?: number; online?: boolean; locked?: boolean; parts?: string[] } = {}
): GlobalTerm {
  return {
    termId,
    date,
    startTime,
    durationMinutes: opts.dur ?? 60,
    isOnline: opts.online ?? false,
    note: null,
    locked: opts.locked ?? false,
    partIds: opts.parts,
  };
}

function req(
  studyId: string,
  subjectId: string,
  terms: GlobalTerm[],
  window: { start?: string; end?: string } = {}
): GlobalRequirement {
  return {
    requirementId: `${subjectId}@${studyId}`,
    periodId: `period-${studyId}`,
    periodName: `Období ${studyId}`,
    studyId,
    subjectId,
    subjectShortcut: subjectId.toUpperCase(),
    subjectName: subjectId,
    windowStart: window.start ?? "2025-01-01",
    windowEnd: window.end ?? "2025-12-31",
    terms,
  };
}

// Exam split into separately registered parts (ids = labels), in this order.
function split(r: GlobalRequirement, partIds: string[], ordered = true): GlobalRequirement {
  return { ...r, parts: { parts: partIds.map((id) => ({ id, label: id })), ordered } };
}

// ─── Invariant: a produced plan must never contain a conflicting pair ─────────

interface ScheduledExam {
  date: string;
  start: number;
  end: number;
  studyId?: string;
  online: boolean;
  termId: string;
}

function scheduledExams(result: GlobalScheduleResult): ScheduledExam[] {
  return result.items
    .filter((i) => i.type === "exam" && i.exam)
    .map((i) => ({
      date: i.date,
      start: parseTimeToMinutes(i.startTime || "00:00"),
      end: parseTimeToMinutes(i.startTime || "00:00") + (i.exam!.durationMinutes || 0),
      studyId: i.studyId,
      online: !!i.exam!.isOnline,
      termId: i.exam!.id,
    }));
}

/**
 * Core safety property: for any pair of scheduled exams on the same day,
 * - same study OR at least one online  => time ranges must not overlap;
 * - different studies, both in person   => gap >= transit(A)+transit(B)+break.
 */
function assertNoConflicts(
  result: GlobalScheduleResult,
  configs: GlobalStudyConfig[],
  breakMinutes: number
) {
  const cfgMap = new Map(configs.map((c) => [c.studyId, c]));
  const transit = (studyId?: string) =>
    Math.round((cfgMap.get(studyId || "")?.travelDurationHours ?? 0) * 60);

  const exams = scheduledExams(result);
  for (let i = 0; i < exams.length; i++) {
    for (let j = i + 1; j < exams.length; j++) {
      const a = exams[i];
      const b = exams[j];
      if (a.date !== b.date) continue;

      const overlap = a.start < b.end && b.start < a.end;
      const sameStudy = a.studyId === b.studyId;
      const bothInPerson = !a.online && !b.online;

      if (sameStudy || !bothInPerson) {
        expect(
          overlap,
          `overlap on ${a.date} between ${a.termId} and ${b.termId}`
        ).toBe(false);
      } else {
        const gap = transit(a.studyId) + transit(b.studyId) + breakMinutes;
        const ok = a.end + gap <= b.start || b.end + gap <= a.start;
        expect(
          ok,
          `cross-study gap on ${a.date} between ${a.termId} (${a.studyId}) and ${b.termId} (${b.studyId}); need ${gap}min`
        ).toBe(true);
      }
    }
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("generateGlobalSchedule – cross-study conflicts", () => {
  it("never produces a conflicting plan when two studies collide with no alternative", () => {
    // Study A transit 120min, Study B transit 30min, break 0 => required gap 150min.
    const configs = [
      cfg("A", { travelDurationHours: 2, travelCostOneWay: 200 }),
      cfg("B", { travelDurationHours: 0.5, travelCostOneWay: 50 }),
    ];
    const requirements = [
      req("A", "alg", [term("a1", "2025-03-10", "09:00", { dur: 60 })]), // 09:00-10:00
      req("B", "db", [term("b1", "2025-03-10", "10:30", { dur: 60 })]), // 10:30-11:30, gap only 30 < 150
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);

    // The plan must NOT contain both — one is reported unschedulable.
    assertNoConflicts(forced, configs, 0);
    expect(forced.selectedTermIds).toHaveLength(1);
    expect(forced.unschedulable).toHaveLength(1);
    expect(forced.unschedulable[0].reason).toMatch(/konflikt/i);
  });

  it("schedules both studies on the same day when the gap is sufficient", () => {
    const configs = [
      cfg("A", { travelDurationHours: 2 }),
      cfg("B", { travelDurationHours: 0.5 }),
    ];
    // gap needed = 120 + 30 + 0 = 150. A ends 10:00, B starts 13:00 (180 >= 150) → OK.
    const requirements = [
      req("A", "alg", [term("a1", "2025-03-10", "09:00", { dur: 60 })]),
      req("B", "db", [term("b1", "2025-03-10", "13:00", { dur: 60 })]),
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);

    assertNoConflicts(forced, configs, 0);
    expect(forced.selectedTermIds.sort()).toEqual(["a1", "b1"]);
    expect(forced.unschedulable).toHaveLength(0);
  });

  it("the global break is added on top of both transit times", () => {
    const configs = [cfg("A", { travelDurationHours: 1 }), cfg("B", { travelDurationHours: 1 })];
    // transit 60+60 = 120; with break 120 => required gap 240min.
    // A 09:00-10:00, B 13:00 => gap 180 < 240 → cannot coexist.
    const requirements = [
      req("A", "alg", [term("a1", "2025-03-10", "09:00", { dur: 60 })]),
      req("B", "db", [term("b1", "2025-03-10", "13:00", { dur: 60 })]),
    ];

    const withoutBreak = generateGlobalSchedule(requirements, configs, 0).forced;
    expect(withoutBreak.selectedTermIds).toHaveLength(2); // 180 >= 120 ok

    const withBreak = generateGlobalSchedule(requirements, configs, 120).forced;
    assertNoConflicts(withBreak, configs, 120);
    expect(withBreak.selectedTermIds).toHaveLength(1); // 180 < 240 → one dropped
  });

  it("picks a non-colliding alternative term instead of dropping a requirement", () => {
    const configs = [cfg("A", { travelDurationHours: 2 }), cfg("B", { travelDurationHours: 2 })];
    const requirements = [
      req("A", "alg", [term("a1", "2025-03-10", "09:00", { dur: 60 })]),
      // B has a colliding same-day term AND a clean next-day term.
      req("B", "db", [
        term("b_collide", "2025-03-10", "09:30", { dur: 60 }),
        term("b_clean", "2025-03-11", "09:00", { dur: 60 }),
      ]),
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);

    assertNoConflicts(forced, configs, 0);
    expect(forced.selectedTermIds.sort()).toEqual(["a1", "b_clean"]);
    expect(forced.unschedulable).toHaveLength(0);
  });

  it("two online exams of different studies must not overlap, but need no transit gap", () => {
    const configs = [cfg("A"), cfg("B")];
    const requirements = [
      req("A", "alg", [term("a1", "2025-03-10", "09:00", { dur: 60, online: true })]),
      // Online, immediately after A with zero travel gap → allowed (no overlap).
      req("B", "db", [term("b1", "2025-03-10", "10:00", { dur: 60, online: true })]),
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 60);
    assertNoConflicts(forced, configs, 60);
    expect(forced.selectedTermIds.sort()).toEqual(["a1", "b1"]);
  });

  it("an online exam overlapping an in-person one (different study) is forbidden", () => {
    const configs = [cfg("A"), cfg("B")];
    const requirements = [
      req("A", "alg", [term("a1", "2025-03-10", "09:00", { dur: 120 })]), // 09:00-11:00 in person
      req("B", "db", [term("b1", "2025-03-10", "10:00", { dur: 60, online: true })]), // overlaps
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);
    assertNoConflicts(forced, configs, 0);
    expect(forced.selectedTermIds).toHaveLength(1);
  });
});

describe("generateGlobalSchedule – same-study & windows", () => {
  it("forbids overlapping same-study exams (single city, no travel between)", () => {
    const configs = [cfg("A")];
    const requirements = [
      req("A", "alg", [term("a1", "2025-03-10", "09:00", { dur: 120 })]), // 09:00-11:00
      req("A", "db", [term("b1", "2025-03-10", "10:00", { dur: 60 })]), // overlaps, only option
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);
    assertNoConflicts(forced, configs, 0);
    expect(forced.selectedTermIds).toHaveLength(1);
    expect(forced.unschedulable).toHaveLength(1);
  });

  it("allows back-to-back same-study exams (no overlap, no gap required)", () => {
    const configs = [cfg("A")];
    const requirements = [
      req("A", "alg", [term("a1", "2025-03-10", "09:00", { dur: 60 })]), // 09:00-10:00
      req("A", "db", [term("b1", "2025-03-10", "10:00", { dur: 60 })]), // 10:00-11:00
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);
    assertNoConflicts(forced, configs, 0);
    expect(forced.selectedTermIds.sort()).toEqual(["a1", "b1"]);
  });

  it("never selects a term outside its period window", () => {
    const configs = [cfg("A")];
    const requirements = [
      req(
        "A",
        "alg",
        [
          term("out", "2025-03-20", "09:00"), // outside window
          term("in", "2025-03-10", "09:00"), // inside window
        ],
        { start: "2025-03-01", end: "2025-03-15" }
      ),
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);
    expect(forced.selectedTermIds).toEqual(["in"]);
  });

  it("reports a requirement unschedulable when all its terms fall outside the window", () => {
    const configs = [cfg("A")];
    const requirements = [
      req("A", "alg", [term("out", "2025-04-01", "09:00")], { start: "2025-03-01", end: "2025-03-15" }),
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);
    expect(forced.selectedTermIds).toHaveLength(0);
    expect(forced.unschedulable).toHaveLength(1);
    expect(forced.unschedulable[0].reason).toMatch(/období/i);
  });
});

describe("generateGlobalSchedule – cost & locking", () => {
  it("sums per-study cost independently across studies", () => {
    // Two studies, separate days, in person → each pays its own round trip.
    const configs = [
      cfg("A", { travelCostOneWay: 200, travelDurationHours: 2 }),
      cfg("B", { travelCostOneWay: 50, travelDurationHours: 2 }),
    ];
    const requirements = [
      req("A", "alg", [term("a1", "2025-03-10", "12:00", { dur: 60 })]),
      req("B", "db", [term("b1", "2025-03-18", "12:00", { dur: 60 })]),
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);
    // 2*200 (A round trip) + 2*50 (B round trip) = 500
    expect(forced.totalCost).toBe(500);
    expect(forced.perStudy).toHaveLength(2);
  });

  it("forced schedule honors a locked term; optimal ignores it and is cheaper", () => {
    const configs = [cfg("A", { travelCostOneWay: 200, travelDurationHours: 2 })];
    const requirements = [
      req("A", "alg", [
        term("cheap", "2025-03-15", "12:00", { dur: 60, online: true }), // online → free
        term("locked", "2025-03-10", "12:00", { dur: 60, locked: true }), // in person → travel cost
      ]),
    ];

    const comparison = generateGlobalSchedule(requirements, configs, 0);
    expect(comparison.hasLocks).toBe(true);

    // Forced must use the locked (in-person) term.
    expect(comparison.forced.selectedTermIds).toEqual(["locked"]);
    expect(comparison.forced.totalCost).toBe(400);

    // Optimal ignores the lock and picks the free online term.
    expect(comparison.optimal.selectedTermIds).toEqual(["cheap"]);
    expect(comparison.optimal.totalCost).toBe(0);

    expect(comparison.savingsCost).toBe(400);
  });

  it("prefers combining same-study exams on one day to save travel", () => {
    const configs = [cfg("A", { travelCostOneWay: 200, travelDurationHours: 2 })];
    const requirements = [
      req("A", "alg", [term("a1", "2025-03-10", "12:00", { dur: 60 })]),
      req("A", "db", [
        term("b_same", "2025-03-10", "14:00", { dur: 60 }), // same day as a1
        term("b_other", "2025-03-20", "12:00", { dur: 60 }), // separate trip
      ]),
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);
    assertNoConflicts(forced, configs, 0);
    expect(forced.selectedTermIds.sort()).toEqual(["a1", "b_same"]);
    expect(forced.totalCost).toBe(400); // one round trip
  });

  it("returns an empty successful schedule when there are no requirements", () => {
    const { forced } = generateGlobalSchedule([], [cfg("A")], 0);
    expect(forced.success).toBe(true);
    expect(forced.selectedTermIds).toHaveLength(0);
    expect(forced.items).toHaveLength(0);
    expect(forced.totalCost).toBe(0);
  });

  it("when there are no locks, forced and optimal are identical (no false savings)", () => {
    const configs = [cfg("A")];
    const requirements = [
      req("A", "alg", [term("a1", "2025-03-10", "12:00"), term("a2", "2025-03-12", "12:00")]),
    ];
    const comparison = generateGlobalSchedule(requirements, configs, 0);
    expect(comparison.hasLocks).toBe(false);
    expect(comparison.savingsCost).toBe(0);
    expect(comparison.savingsScore).toBe(0);
    expect(comparison.forced.selectedTermIds).toEqual(comparison.optimal.selectedTermIds);
  });
});

describe("generateGlobalSchedule – invariant under a denser multi-study mix", () => {
  it("keeps the no-conflict invariant across three studies with overlapping terms", () => {
    const configs = [
      cfg("A", { travelDurationHours: 2 }),
      cfg("B", { travelDurationHours: 1 }),
      cfg("C", { travelDurationHours: 3 }),
    ];
    const requirements = [
      req("A", "a1", [
        term("a1_x", "2025-03-10", "09:00", { dur: 90 }),
        term("a1_y", "2025-03-11", "09:00", { dur: 90 }),
      ]),
      req("A", "a2", [term("a2_x", "2025-03-10", "11:00", { dur: 60 })]),
      req("B", "b1", [
        term("b1_x", "2025-03-10", "09:30", { dur: 60 }),
        term("b1_y", "2025-03-12", "14:00", { dur: 60 }),
      ]),
      req("C", "c1", [
        term("c1_x", "2025-03-10", "10:00", { dur: 60, online: true }),
        term("c1_y", "2025-03-13", "09:00", { dur: 60 }),
      ]),
      req("C", "c2", [term("c2_x", "2025-03-13", "13:00", { dur: 120 })]),
    ];

    const breakMinutes = 45;
    const { forced, optimal } = generateGlobalSchedule(requirements, configs, breakMinutes);

    assertNoConflicts(forced, configs, breakMinutes);
    assertNoConflicts(optimal, configs, breakMinutes);
  });
});

describe("generateGlobalSchedule – exams split into parts", () => {
  // Transit 2 h, 200 Kč one way: a same-day trip costs 400.
  const configs = [cfg("A", { travelCostOneWay: 200, travelDurationHours: 2 })];
  const WO = ["Písemná", "Ústní"];
  const P4 = ["1", "2", "3", "4"];

  it("picks a whole-exam term when it is cheaper than separate parts", () => {
    const requirements = [
      split(
        req("A", "fyz", [
          term("whole", "2025-03-20", "12:00", { online: true }),
          term("w", "2025-03-10", "09:00", { parts: ["Písemná"] }),
          term("o", "2025-03-10", "13:00", { parts: ["Ústní"] }),
        ]),
        WO
      ),
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);
    expect(forced.selectedTermIds).toEqual(["whole"]);
    expect(forced.totalCost).toBe(0);
  });

  it("picks separate parts when they are cheaper and labels them", () => {
    const requirements = [
      req("A", "alg", [term("a1", "2025-03-10", "11:00")]),
      split(
        req("A", "fyz", [
          term("whole", "2025-03-20", "12:00"), // separate trip
          term("w", "2025-03-10", "09:00", { parts: ["Písemná"] }),
          term("o", "2025-03-10", "14:00", { parts: ["Ústní"] }),
        ]),
        WO
      ),
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);
    assertNoConflicts(forced, configs, 0);
    expect(forced.selectedTermIds.sort()).toEqual(["a1", "o", "w"]);
    expect(forced.breakdown.examCount).toBe(3);
    expect(forced.totalCost).toBe(400);
    const labels = forced.items.filter((i) => i.type === "exam").map((i) => i.exam!.partLabel);
    expect(labels).toEqual(["Písemná", undefined, "Ústní"]);
  });

  it("a term may cover several parts; the remaining parts follow it", () => {
    // {1,3} → {2} → {4}: valid, each term starts with a higher part.
    const requirements = [
      split(
        req("A", "mat", [
          term("t13", "2025-03-10", "09:00", { parts: ["1", "3"] }),
          term("t2", "2025-03-10", "11:00", { parts: ["2"] }),
          term("t4", "2025-03-10", "13:00", { parts: ["4"] }),
        ]),
        P4
      ),
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);
    expect(forced.selectedTermIds).toEqual(["t13", "t2", "t4"]);
    const labels = forced.items.filter((i) => i.type === "exam").map((i) => i.exam!.partLabel);
    expect(labels).toEqual(["1 + 3", "2", "4"]);
  });

  it("a binding order rejects starting with a higher part; a free order accepts it", () => {
    const terms = [
      term("t13", "2025-03-10", "09:00", { parts: ["1", "3"] }),
      term("t4", "2025-03-10", "11:00", { parts: ["4"] }),
      term("t2", "2025-03-10", "13:00", { parts: ["2"] }),
    ];

    const ordered = generateGlobalSchedule([split(req("A", "mat", terms), P4)], configs, 0);
    expect(ordered.forced.selectedTermIds).toHaveLength(0);
    expect(ordered.forced.unschedulable[0].reason).toMatch(/pořadí/);

    const free = generateGlobalSchedule([split(req("A", "mat", terms), P4, false)], configs, 0);
    expect(free.forced.selectedTermIds).toEqual(["t13", "t4", "t2"]);
  });

  it("a binding order compares the time of the terms", () => {
    const terms = [
      term("w_before", "2025-03-05", "12:00", { parts: ["Písemná"] }),
      term("o", "2025-03-10", "09:00", { parts: ["Ústní"] }),
      term("w_after", "2025-03-10", "11:00", { parts: ["Písemná"] }), // same trip, but after the oral
    ];

    const ordered = generateGlobalSchedule([split(req("A", "fyz", terms), WO)], configs, 0);
    expect(ordered.forced.selectedTermIds).toEqual(["w_before", "o"]);
    expect(ordered.forced.totalCost).toBe(800);

    const free = generateGlobalSchedule([split(req("A", "fyz", terms), WO, false)], configs, 0);
    expect(free.forced.selectedTermIds).toEqual(["o", "w_after"]);
    expect(free.forced.totalCost).toBe(400);
  });

  it("keeps the minimum gap between parts, measured from end to start", () => {
    const terms = [
      term("w", "2025-03-10", "10:00", { parts: ["Písemná"] }), // 10:00–11:00
      term("o_soon", "2025-03-10", "11:30", { parts: ["Ústní"] }), // 30 min after
      term("o_ok", "2025-03-10", "12:00", { parts: ["Ústní"] }), // 60 min after
    ];

    const { forced } = generateGlobalSchedule([split(req("A", "fyz", terms), WO)], configs, 0, 60);
    expect(forced.selectedTermIds).toEqual(["w", "o_ok"]);

    const tight = generateGlobalSchedule(
      [split(req("A", "fyz", [terms[0], terms[1]]), WO)],
      configs,
      0,
      60
    );
    expect(tight.forced.selectedTermIds).toHaveLength(0);
    expect(tight.forced.unschedulable[0].reason).toMatch(/pauzou/);

    const noGap = generateGlobalSchedule([split(req("A", "fyz", [terms[0], terms[1]]), WO)], configs, 0, 0);
    expect(noGap.forced.selectedTermIds).toEqual(["w", "o_soon"]);
  });

  it("never picks overlapping parts, even in a free order", () => {
    const requirements = [
      split(
        req("A", "fyz", [
          term("w", "2025-03-10", "10:00", { dur: 120, parts: ["Písemná"] }),
          term("o", "2025-03-10", "11:00", { parts: ["Ústní"] }),
        ]),
        WO,
        false
      ),
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0, 0);
    expect(forced.selectedTermIds).toHaveLength(0);
  });

  it("names a part without any term", () => {
    const requirements = [split(req("A", "fyz", [term("w", "2025-03-10", "09:00", { parts: ["Písemná"] })]), WO)];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);
    expect(forced.selectedTermIds).toHaveLength(0);
    expect(forced.unschedulable[0].reason).toBe("chybí termín části „Ústní“");
  });

  it("a locked multi-part term is kept and the remaining parts are scheduled after it", () => {
    const requirements = [
      split(
        req("A", "mat", [
          term("whole", "2025-03-20", "12:00", { online: true }),
          term("t13", "2025-03-10", "09:00", { parts: ["1", "3"], locked: true }),
          term("t2", "2025-03-10", "11:00", { parts: ["2"] }),
          term("t2_later", "2025-03-15", "11:00", { parts: ["2"] }),
          term("t4", "2025-03-10", "13:00", { parts: ["4"] }),
          term("t24", "2025-03-12", "09:00", { parts: ["2", "4"] }),
        ]),
        P4
      ),
    ];

    const comparison = generateGlobalSchedule(requirements, configs, 0);
    expect(comparison.forced.selectedTermIds).toEqual(["t13", "t2", "t4"]);
    expect(comparison.optimal.selectedTermIds).toEqual(["whole"]);
  });

  it("locked terms sharing a part leave the exam unschedulable", () => {
    const requirements = [
      split(
        req("A", "fyz", [
          term("w1", "2025-03-10", "09:00", { parts: ["Písemná"], locked: true }),
          term("w2", "2025-03-11", "09:00", { parts: ["Písemná"], locked: true }),
          term("o", "2025-03-12", "09:00", { parts: ["Ústní"] }),
        ]),
        WO
      ),
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);
    expect(forced.selectedTermIds).toHaveLength(0);
    expect(forced.unschedulable[0].reason).toMatch(/zamčené/);
  });

  it("treats terms without parts as the whole exam", () => {
    const requirements = [
      split(
        req("A", "fyz", [
          term("whole", "2025-03-10", "09:00"),
          term("w", "2025-03-10", "12:00", { parts: ["Písemná"] }),
        ]),
        WO
      ),
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);
    expect(forced.selectedTermIds).toEqual(["whole"]);
    expect(forced.items.find((i) => i.type === "exam")!.exam!.partLabel).toBeUndefined();
  });

  it("ignores parts when the subject is not split", () => {
    const requirements = [
      req("A", "fyz", [
        term("w", "2025-03-10", "09:00", { parts: ["Písemná"] }),
        term("o", "2025-03-10", "14:00", { parts: ["Ústní"] }),
      ]),
    ];

    const { forced } = generateGlobalSchedule(requirements, configs, 0);
    expect(forced.selectedTermIds).toHaveLength(1);
    expect(forced.items.find((i) => i.type === "exam")!.exam!.partLabel).toBeUndefined();
  });
});
