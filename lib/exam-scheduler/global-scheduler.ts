/**
 * Global (multi-study) exam scheduler.
 *
 * Generalizes the single-study optimizer to schedule exams across several
 * studies at once. The optimization objective is the SAME combined CZK score
 * used per-study (real travel + accommodation cost plus the virtual PTO
 * penalty), summed across studies — studies stay independent for cost.
 *
 * The only cross-study coupling is a calendar/timing constraint: when two
 * in-person exams of DIFFERENT studies fall on the same day, there must be a
 * gap of at least transit(A) + transit(B) + break between them (you travel
 * A -> home -> B). That same arithmetic is why per-study costs simply sum: each
 * study pays its own home<->city round trips, and a same-day transfer equals
 * "leave A (cost A) + arrive B (cost B)".
 *
 * For each requirement — a (period, subject) pair — exactly one of its
 * candidate terms must be selected, and that term must fall inside the period
 * window. The scheduler is run twice: once ignoring locks (the OPTIMAL
 * schedule) and once forcing every locked term (the FORCED / official
 * schedule), so the UI can show what a cheaper plan would look like.
 */
import {
  ExamWithSubject,
  ScheduleItem,
  ScheduleItemType,
  SchedulerConfig,
  DEFAULT_CONFIG,
} from "./types";
import { hasConflict } from "./conflict-detector";
import {
  calculateCost,
  calculateScheduleScore,
  calculatePtoPenalty,
  computeEndTime,
} from "./cost-calculator";
import { buildScheduleItems } from "./scheduler";
import { compareDate, parseTimeToMinutes } from "./utils";

// Safety cap on backtracking steps to avoid pathological blow-ups on huge
// inputs. If hit, the best solution found so far is returned (and reported).
const MAX_BACKTRACK_STEPS = 2_000_000;

// Virtual penalty for leaving a requirement unscheduled. Far larger than any
// realistic travel/accommodation/PTO cost, so the optimizer always prefers a
// complete, conflict-free assignment and only drops a requirement when no term
// can be placed without violating a timing constraint. This guarantees the
// emitted plan is never internally conflicting — at worst it is incomplete.
const SKIP_PENALTY = 1_000_000_000;

// ─── Public input/output types ───────────────────────────────────────────────

export interface GlobalStudyConfig extends SchedulerConfig {
  studyId: string;
  studyName: string;
}

export interface GlobalTerm {
  termId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM (seconds trimmed by caller)
  durationMinutes: number;
  isOnline: boolean;
  note: string | null;
  locked: boolean;
}

export interface GlobalRequirement {
  requirementId: string; // `${periodId}:${subjectId}`
  periodId: string;
  periodName: string;
  studyId: string;
  subjectId: string;
  subjectShortcut: string;
  subjectName: string;
  windowStart: string; // period start_date (inclusive)
  windowEnd: string; // period due_date (inclusive)
  terms: GlobalTerm[];
}

export interface UnschedulableRequirement {
  requirementId: string;
  periodName: string;
  subjectName: string;
  reason: string;
}

export interface PerStudyBreakdown {
  studyId: string;
  studyName: string;
  totalCost: number;
  travelCost: number;
  accommodationCost: number;
  travelTrips: number;
  accommodationNights: number;
  ptoDays: number;
  examCount: number;
}

export interface GlobalScheduleResult {
  success: boolean;
  items: ScheduleItem[];
  selectedTermIds: string[];
  totalCost: number; // real money (no PTO penalty)
  score: number; // optimization score (money + PTO penalty)
  breakdown: {
    travelCost: number;
    accommodationCost: number;
    travelTrips: number;
    accommodationNights: number;
    ptoDays: number;
    examCount: number;
  };
  perStudy: PerStudyBreakdown[];
  unschedulable: UnschedulableRequirement[];
  truncated: boolean; // true if the search hit MAX_BACKTRACK_STEPS
  error?: string;
}

export interface GlobalScheduleComparison {
  forced: GlobalScheduleResult; // respects locked terms (official schedule)
  optimal: GlobalScheduleResult; // ignores locks (cheapest possible)
  hasLocks: boolean;
  // How much cheaper (CZK score) the optimal schedule is vs the forced one.
  // 0 when there are no locks or locks don't cost anything extra.
  savingsScore: number;
  savingsCost: number;
}

// ─── Internal selection type ─────────────────────────────────────────────────

interface SelectedExam extends ExamWithSubject {
  studyId: string;
  requirementId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function transitMinutes(config: SchedulerConfig): number {
  return Math.round((config.travelDurationHours || 0) * 60);
}

function withinWindow(date: string, start: string, end: string): boolean {
  return compareDate(date, start) >= 0 && compareDate(date, end) <= 0;
}

/**
 * Can `candidate` (for study S) be added without violating any timing rule
 * against already-selected exams? Online exams only need non-overlap; two
 * in-person exams of different studies on the same day need the transit gap.
 */
function canAddGlobal(
  candidate: SelectedExam,
  selected: SelectedExam[],
  configByStudy: Map<string, GlobalStudyConfig>,
  breakMinutes: number
): boolean {
  const candStart = parseTimeToMinutes(candidate.startTime);
  const candEnd = candStart + candidate.durationMinutes;

  for (const other of selected) {
    if (other.date !== candidate.date) continue;

    const sameStudy = other.studyId === candidate.studyId;
    const bothInPerson = !candidate.isOnline && !other.isOnline;

    if (sameStudy || !bothInPerson) {
      // Same study (single city) or at least one online exam: only forbid
      // overlapping time ranges.
      if (hasConflict(candidate, other)) return false;
      continue;
    }

    // Different studies, both in person: need transit(A) + transit(B) + break.
    const cfgA = configByStudy.get(candidate.studyId);
    const cfgB = configByStudy.get(other.studyId);
    const requiredGap =
      transitMinutes(cfgA || DEFAULT_CONFIG) +
      transitMinutes(cfgB || DEFAULT_CONFIG) +
      Math.max(0, breakMinutes);

    const otherStart = parseTimeToMinutes(other.startTime);
    const otherEnd = otherStart + other.durationMinutes;

    const candFirst = candEnd + requiredGap <= otherStart;
    const otherFirst = otherEnd + requiredGap <= candStart;
    if (!candFirst && !otherFirst) return false;
  }

  return true;
}

function makeSelectedExam(req: GlobalRequirement, term: GlobalTerm): SelectedExam {
  const subject = {
    id: req.subjectId,
    shortcut: req.subjectShortcut,
    name: req.subjectName,
    isComplete: false,
  };
  const exam: SelectedExam = {
    id: term.termId,
    subjectId: req.subjectId,
    note: term.note,
    date: term.date,
    startTime: term.startTime.substring(0, 5),
    durationMinutes: term.durationMinutes,
    isOnline: term.isOnline,
    subject,
    endTime: "",
    studyId: req.studyId,
    requirementId: req.requirementId,
  };
  exam.endTime = computeEndTime(exam);
  return exam;
}

/**
 * Score the selection by summing each study's standard schedule score.
 * Per-study score depends only on that study's own exams.
 */
function scoreByStudy(
  selectedByStudy: Map<string, SelectedExam[]>,
  configByStudy: Map<string, GlobalStudyConfig>
): number {
  let total = 0;
  for (const [studyId, exams] of selectedByStudy) {
    const config = configByStudy.get(studyId) || DEFAULT_CONFIG;
    total += calculateScheduleScore(exams, config);
  }
  return total;
}

// ─── Core solver ─────────────────────────────────────────────────────────────

function solve(
  requirements: GlobalRequirement[],
  configByStudy: Map<string, GlobalStudyConfig>,
  breakMinutes: number
): { selection: SelectedExam[]; skippedIds: string[]; truncated: boolean } {
  if (requirements.length === 0) {
    return { selection: [], skippedIds: [], truncated: false };
  }

  // Sort most-constrained-first (fewest candidate terms) for better pruning.
  const ordered = [...requirements].sort((a, b) => a.terms.length - b.terms.length);

  let bestSelection: SelectedExam[] | null = null;
  let bestSkipped: string[] | null = null;
  let bestScore = Infinity;
  let steps = 0;
  let truncated = false;

  const selectedByStudy = new Map<string, SelectedExam[]>();
  const flatSelected: SelectedExam[] = [];
  const skipped: string[] = [];

  const currentScore = () =>
    scoreByStudy(selectedByStudy, configByStudy) + skipped.length * SKIP_PENALTY;

  function backtrack(index: number): void {
    if (truncated) return;
    if (++steps > MAX_BACKTRACK_STEPS) {
      truncated = true;
      return;
    }

    if (index === ordered.length) {
      const score = currentScore();
      if (score < bestScore) {
        bestScore = score;
        bestSelection = [...flatSelected];
        bestSkipped = [...skipped];
      }
      return;
    }

    const req = ordered[index];
    // Candidate terms must fall inside the period window. Sort online/earlier
    // first as a light heuristic.
    const candidates = req.terms
      .filter((t) => withinWindow(t.date, req.windowStart, req.windowEnd))
      .map((t) => makeSelectedExam(req, t))
      .sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        const d = compareDate(a.date, b.date);
        if (d !== 0) return d;
        return a.startTime.localeCompare(b.startTime);
      });

    for (const exam of candidates) {
      if (truncated) return;
      // Conflict guard: NEVER place a term that collides with an already
      // selected one (same-study overlap or cross-study insufficient gap).
      if (!canAddGlobal(exam, flatSelected, configByStudy, breakMinutes)) continue;

      const studyExams = selectedByStudy.get(exam.studyId) || [];
      studyExams.push(exam);
      selectedByStudy.set(exam.studyId, studyExams);
      flatSelected.push(exam);

      if (currentScore() < bestScore) {
        backtrack(index + 1);
      }

      // Undo
      studyExams.pop();
      flatSelected.pop();
    }

    // Skip branch: leave this requirement unscheduled (heavily penalized). Lets
    // the rest of the plan still be produced when a term is unplaceable.
    if (truncated) return;
    skipped.push(req.requirementId);
    if (currentScore() < bestScore) {
      backtrack(index + 1);
    }
    skipped.pop();
  }

  backtrack(0);

  return {
    selection: bestSelection || [],
    skippedIds: bestSkipped || ordered.map((r) => r.requirementId),
    truncated,
  };
}

// ─── Result assembly ─────────────────────────────────────────────────────────

function buildResult(
  selection: SelectedExam[],
  configByStudy: Map<string, GlobalStudyConfig>,
  unschedulable: UnschedulableRequirement[],
  truncated: boolean
): GlobalScheduleResult {
  const byStudy = new Map<string, SelectedExam[]>();
  for (const exam of selection) {
    const list = byStudy.get(exam.studyId) || [];
    list.push(exam);
    byStudy.set(exam.studyId, list);
  }

  const items: ScheduleItem[] = [];
  const perStudy: PerStudyBreakdown[] = [];
  let totalCost = 0;
  let score = 0;
  let travelCost = 0;
  let accommodationCost = 0;
  let travelTrips = 0;
  let accommodationNights = 0;
  let ptoDays = 0;

  for (const [studyId, exams] of byStudy) {
    const config = configByStudy.get(studyId) || DEFAULT_CONFIG;
    const studyName = (config as GlobalStudyConfig).studyName || studyId;

    const studyItems = buildScheduleItems(exams, config).map((it) => ({
      ...it,
      studyId,
      studyName,
    }));
    items.push(...studyItems);

    const cost = calculateCost(exams, config);
    const { ptoDays: studyPto } = calculatePtoPenalty(exams, config);
    const studyScore = calculateScheduleScore(exams, config);

    totalCost += cost.totalCost;
    score += studyScore;
    travelCost += cost.travelCost;
    accommodationCost += cost.accommodationCost;
    travelTrips += cost.travelTrips;
    accommodationNights += cost.accommodationNights;
    ptoDays += studyPto;

    perStudy.push({
      studyId,
      studyName,
      totalCost: cost.totalCost,
      travelCost: cost.travelCost,
      accommodationCost: cost.accommodationCost,
      travelTrips: cost.travelTrips,
      accommodationNights: cost.accommodationNights,
      ptoDays: studyPto,
      examCount: exams.length,
    });
  }

  // Sort merged timeline by date, then type, then time.
  const typeOrder: Record<ScheduleItemType, number> = {
    travel_to: 0,
    accommodation: 1,
    exam: 2,
    travel_from: 3,
  };
  items.sort((a, b) => {
    const d = compareDate(a.date, b.date);
    if (d !== 0) return d;
    const o = typeOrder[a.type] - typeOrder[b.type];
    if (o !== 0) return o;
    return (a.startTime || "").localeCompare(b.startTime || "");
  });

  perStudy.sort((a, b) => a.studyName.localeCompare(b.studyName, "cs"));

  return {
    success: true,
    items,
    selectedTermIds: selection.map((e) => e.id),
    totalCost,
    score,
    breakdown: {
      travelCost,
      accommodationCost,
      travelTrips,
      accommodationNights,
      ptoDays,
      examCount: selection.length,
    },
    perStudy,
    unschedulable,
    truncated,
  };
}

/**
 * Run the scheduler for one mode (optimal = ignore locks, forced = honor them).
 * Requirements whose locked term falls outside the window, or that have no
 * candidate term inside the window, are reported as unschedulable and left out
 * of the optimization (the rest is still scheduled, best effort).
 */
function runMode(
  requirements: GlobalRequirement[],
  configByStudy: Map<string, GlobalStudyConfig>,
  breakMinutes: number,
  respectLocks: boolean
): GlobalScheduleResult {
  const unschedulable: UnschedulableRequirement[] = [];
  const solvable: GlobalRequirement[] = [];

  for (const req of requirements) {
    let terms = req.terms.filter((t) =>
      withinWindow(t.date, req.windowStart, req.windowEnd)
    );

    if (respectLocks) {
      const locked = terms.filter((t) => t.locked);
      if (locked.length > 0) {
        // Honor the (first) locked term as a fixed selection.
        terms = [locked[0]];
      }
    }

    if (terms.length === 0) {
      const hasAnyTerm = req.terms.length > 0;
      unschedulable.push({
        requirementId: req.requirementId,
        periodName: req.periodName,
        subjectName: req.subjectName,
        reason: hasAnyTerm
          ? "Žádný termín nespadá do období"
          : "Žádné termíny",
      });
      continue;
    }

    solvable.push({ ...req, terms });
  }

  const { selection, skippedIds, truncated } = solve(solvable, configByStudy, breakMinutes);

  // Requirements the solver could not place without a conflict.
  const reqById = new Map(solvable.map((r) => [r.requirementId, r]));
  for (const id of skippedIds) {
    const req = reqById.get(id);
    if (!req) continue;
    unschedulable.push({
      requirementId: req.requirementId,
      periodName: req.periodName,
      subjectName: req.subjectName,
      reason: "Termín nelze umístit bez konfliktu",
    });
  }

  return buildResult(selection, configByStudy, unschedulable, truncated);
}

/**
 * Main entry point. Returns both the forced (locks honored) and the optimal
 * (locks ignored) schedules, plus the potential savings of dropping the locks.
 */
export function generateGlobalSchedule(
  requirements: GlobalRequirement[],
  studyConfigs: GlobalStudyConfig[],
  breakMinutes: number
): GlobalScheduleComparison {
  const configByStudy = new Map(studyConfigs.map((c) => [c.studyId, c]));
  const hasLocks = requirements.some((r) => r.terms.some((t) => t.locked));

  const forced = runMode(requirements, configByStudy, breakMinutes, true);
  const optimal = hasLocks
    ? runMode(requirements, configByStudy, breakMinutes, false)
    : forced;

  const savingsScore = Math.max(0, forced.score - optimal.score);
  const savingsCost = Math.max(0, forced.totalCost - optimal.totalCost);

  return { forced, optimal, hasLocks, savingsScore, savingsCost };
}
