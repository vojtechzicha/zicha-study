/**
 * Builds a self-contained text prompt describing the current exam plan, so it
 * can be pasted into another assistant (study-session planning, tasks,
 * calendar). The prompt is in English for that assistant; names, notes and
 * labels stay as stored (Czech).
 *
 * The plan is the FORCED schedule (locked terms honored). Every candidate
 * term is listed too, so the other assistant knows the fallback options.
 */
import type {
  GlobalRequirement,
  GlobalScheduleComparison,
  GlobalStudyConfig,
  GlobalTerm,
} from "./global-scheduler";
import type { ScheduleItem } from "./types";
import { addMinutesToTime, getDayOfWeek } from "./utils";
import { getExamTermPartLabel, PRE_TERM_LABEL, TENTATIVE_TERM_LABEL } from "@/lib/constants";

export interface PlanPromptPeriod {
  id: string;
  studyId: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  subjectIds: string[];
}

export interface PlanPromptSubject {
  id: string;
  name: string;
  abbreviation?: string | null;
  completed?: boolean;
  completionType?: string | null;
  credits?: number | null;
}

export interface PlanPromptInput {
  comparison: GlobalScheduleComparison;
  requirements: GlobalRequirement[];
  studies: GlobalStudyConfig[];
  periods: PlanPromptPeriod[];
  subjects: PlanPromptSubject[];
  today: string; // YYYY-MM-DD
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function day(date: string): string {
  return `${date} (${WEEKDAYS[getDayOfWeek(date)]})`;
}

function czk(amount: number): string {
  return `${Math.round(amount).toLocaleString("cs-CZ").replace(/\s/g, " ")} CZK`;
}

function hours(h: number): string {
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

// The UI only offers the forced/optimal switch when locks change something.
export function locksChangeSchedule(c: GlobalScheduleComparison): boolean {
  return c.hasLocks && (c.droppedByLocks > 0 || c.savingsCost > 0 || c.optimal.score < c.forced.score);
}

function termFlags(term: GlobalTerm, req: GlobalRequirement): string[] {
  const flags = [term.isOnline ? "online" : "in person"];
  const part = getExamTermPartLabel({ part_ids: term.partIds }, req.parts);
  if (part) flags.push(`part: ${part}`);
  if (term.isPreTerm) flags.push(`pre-term (${PRE_TERM_LABEL})`);
  if (term.isTentative) flags.push(`tentative (${TENTATIVE_TERM_LABEL})`);
  if (term.locked) flags.push("locked");
  return flags;
}

function termLine(term: GlobalTerm, req: GlobalRequirement): string {
  const end = addMinutesToTime(term.startTime, term.durationMinutes);
  const note = term.note ? ` – note: ${term.note}` : "";
  return `${day(term.date)} ${term.startTime}–${end} · ${termFlags(term, req).join(" · ")}${note}`;
}

function subjectLabel(name: string, abbreviation?: string | null): string {
  return abbreviation ? `[${abbreviation}] ${name}` : name;
}

function subjectMeta(s: PlanPromptSubject | undefined): string {
  if (!s) return "";
  const meta: string[] = [];
  const completion = s.completionType?.replace(/\s*\n\s*/g, " ").trim();
  if (completion && completion !== "-") meta.push(completion);
  if (s.credits) meta.push(`${s.credits} credits`);
  return meta.length > 0 ? ` (${meta.join(", ")})` : "";
}

function scheduleLine(
  item: ScheduleItem,
  termById: Map<string, { term: GlobalTerm; req: GlobalRequirement }>,
  configByStudy: Map<string, GlobalStudyConfig>
): string {
  const study = item.studyName ? ` – ${item.studyName}` : "";
  const cost = item.cost > 0 ? ` · ${czk(item.cost)}` : "";
  const travel = item.studyId ? configByStudy.get(item.studyId)?.travelDurationHours : undefined;

  switch (item.type) {
    case "exam": {
      const exam = item.exam!;
      const found = termById.get(exam.id);
      const flags = found ? termFlags(found.term, found.req) : [exam.isOnline ? "online" : "in person"];
      if (item.requiresPto) flags.push("needs a day off work");
      const note = exam.note ? ` – note: ${exam.note}` : "";
      return `${item.startTime}–${item.endTime} EXAM ${subjectLabel(exam.subject.name, exam.subject.shortcut)}${study} · ${flags.join(" · ")}${note}`;
    }
    case "travel_to":
      return `${item.startTime} travel to school${study}${travel ? ` (about ${hours(travel)})` : ""}${cost}`;
    case "travel_from":
      return `${item.startTime} travel home${study}${travel ? ` (about ${hours(travel)})` : ""}${cost}`;
    case "accommodation":
      return `overnight stay near school${study}${cost}`;
  }
}

export function buildExamPlanPrompt(input: PlanPromptInput): string {
  const { comparison, requirements, studies, periods, subjects, today } = input;
  const plan = comparison.forced;
  const selected = new Set(plan.selectedTermIds);
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const configByStudy = new Map(studies.map((s) => [s.studyId, s]));
  const reqById = new Map(requirements.map((r) => [r.requirementId, r]));
  const termById = new Map<string, { term: GlobalTerm; req: GlobalRequirement }>();
  for (const req of requirements) for (const term of req.terms) termById.set(term.termId, { term, req });
  const unschedulable = new Map(plan.unschedulable.map((u) => [u.requirementId, u.reason]));

  const out: string[] = [];
  const line = (s = "") => out.push(s);

  line(`# My exam plan (snapshot from ${day(today)})`);
  line();
  line(
    "This is the current exam plan exported from my study tracker. Treat it as the source of truth for my exams " +
      "when you plan study sessions, tasks and calendar events. A newer snapshot I paste later replaces this one completely."
  );
  line();
  line("How to read it:");
  line("- A period is a date window in which I have to pass the subject; the plan picks one term per subject in each period.");
  line("- Selected = the term the plan counts on. Locked = I'm registered or otherwise committed to it. A selected term that isn't locked is the planned choice, but I haven't registered yet.");
  line("- Tentative = the school hasn't confirmed the date or time yet. Pre-term = an early term before the period starts.");
  line("- Some exams are split into parts (e.g. written and oral) taken on separate terms; each part then has its own term.");
  line("- Other terms are the remaining options: fallbacks if I fail, miss or move an exam.");
  line("- In-person exams mean travel to school and sometimes an overnight stay; online exams are taken from home.");
  line("- Dates are YYYY-MM-DD, times are 24-hour local time (Europe/Prague).");

  // ── Studies ──
  line();
  line("## Studies");
  for (const s of studies) {
    const details = [`travel to school about ${hours(s.travelDurationHours)} each way`];
    const workingDays = (s.workingDays ?? []).map((d) => WEEKDAYS[d]).join(", ");
    if (s.preferFreeDayExams && workingDays) details.push(`I work on ${workingDays}, so I prefer exams outside those days`);
    line(`- ${s.studyName}: ${details.join("; ")}`);
  }

  // ── Chronological schedule ──
  line();
  line("## Schedule");
  if (plan.error) {
    line(`The schedule could not be generated: ${plan.error}`);
  } else if (plan.items.length === 0) {
    line("No exams are scheduled yet.");
  } else {
    let current = "";
    for (const item of plan.items) {
      if (item.date !== current) {
        current = item.date;
        line();
        line(`### ${day(item.date)}`);
      }
      line(`- ${scheduleLine(item, termById, configByStudy)}`);
    }
  }

  // ── Per subject ──
  line();
  line("## Subjects by study and period");
  for (const study of studies) {
    const studyPeriods = periods
      .filter((p) => p.studyId === study.studyId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name, "cs"));
    if (studyPeriods.length === 0) continue;

    line();
    line(`### ${study.studyName}`);
    for (const period of studyPeriods) {
      line();
      line(`**${period.name}** (${period.startDate} – ${period.endDate})`);

      const subjectIds = Array.from(
        new Set([
          ...period.subjectIds,
          ...requirements.filter((r) => r.periodId === period.id).map((r) => r.subjectId),
        ])
      );
      if (subjectIds.length === 0) {
        line("- no subjects yet");
        continue;
      }

      for (const sid of subjectIds) {
        const subject = subjectById.get(sid);
        const req = reqById.get(`${period.id}:${sid}`);
        const name = subjectLabel(subject?.name ?? req?.subjectName ?? "Unknown subject", subject?.abbreviation);
        const head = `- ${name}${subjectMeta(subject)}`;

        if (subject?.completed) {
          line(`${head}: already passed, nothing to plan`);
          continue;
        }
        if (!req || req.terms.length === 0) {
          line(`${head}: no terms announced yet – still has to be passed in this period`);
          continue;
        }

        const parts = req.parts ? ` – split into parts: ${req.parts.parts.map((p) => p.label).join(", ")}${req.parts.ordered ? " (in this order)" : ""}` : "";
        const reason = unschedulable.get(req.requirementId);
        line(`${head}${parts}${reason ? ` – NOT SCHEDULED: ${reason}` : ""}`);

        const terms = [...req.terms].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
        const chosen = terms.filter((t) => selected.has(t.termId));
        const others = terms.filter((t) => !selected.has(t.termId));
        for (const t of chosen) line(`  - Selected: ${termLine(t, req)}`);
        if (others.length > 0) {
          line(`  - Other terms:`);
          for (const t of others) line(`    - ${termLine(t, req)}`);
        }
      }
    }
  }

  // ── Problems ──
  const problems: string[] = [];
  for (const u of plan.unschedulable) problems.push(`${u.periodName} – ${u.subjectName}: ${u.reason}`);
  if (plan.truncated) problems.push("The search hit its limit, so the plan may not be the best possible one.");
  if (locksChangeSchedule(comparison)) {
    problems.push(
      comparison.droppedByLocks > 0
        ? `The locked terms leave out ${comparison.droppedByLocks} exam(s) that an unlocked plan would fit in.`
        : `Without the locked terms the plan would cost ${czk(comparison.savingsCost)} less.`
    );
  }
  if (problems.length > 0) {
    line();
    line("## Open issues");
    for (const p of problems) line(`- ${p}`);
  }

  // ── Costs ──
  if (!plan.error && plan.breakdown.examCount > 0) {
    const b = plan.breakdown;
    line();
    line("## Costs");
    const pto = b.ptoDays > 0 ? `; ${b.ptoDays} in-person exam day(s) need a day off work.` : ".";
    line(
      `Total ${czk(plan.totalCost)}: travel ${czk(b.travelCost)} (${b.travelTrips} one-way trips), ` +
        `accommodation ${czk(b.accommodationCost)} (${b.accommodationNights} nights)${pto}`
    );
  }

  line();
  line(
    "Please keep my study sessions, tasks and calendar consistent with this plan: plan preparation before each selected exam, " +
      "block travel and exam time, and point out anything that doesn't fit. Ask me before acting on terms that are not selected."
  );

  return out.join("\n");
}
