import {
  EXAM_SCHEDULER_DEFAULTS,
  EXTERNAL_TERM_STATUS,
  type ExamPartsConfig,
  type ExamTermExternal,
  type ExamTermSource,
} from "@/lib/constants"
import type { ImportedTerm } from "@/lib/exam-import/schema"

// Turns a snapshot of exam terms from a university system into writes on exam_terms. Pure: the
// caller loads the study's periods, subjects and terms and applies the returned operations
// (lib/exam-import/apply.ts). Rules are documented in docs/EXAM_IMPORT.md.

type Doc = Record<string, any>

export type ImportOp =
  | { op: "create"; doc: Doc }
  // audit: false for updates that only refresh volatile details (how many are signed up),
  // so the change log isn't flooded twice a day.
  | { op: "update"; id: string; before: Doc; patch: Doc; audit: boolean }
  | { op: "delete"; id: string; before: Doc }

export type ImportEventType =
  | "created" // a new term
  | "adopted" // a term entered by hand is now the synced one
  | "rescheduled" // date or time changed
  | "registered" // the student signed up (the term was locked)
  | "deregistered" // the student signed off (the sync's own lock was released)
  | "removed" // gone from the source, unlocked term deleted
  | "removed_locked" // gone from the source, locked term kept and flagged
  | "restored" // a flagged term is listed again

export interface ImportEvent {
  type: ImportEventType
  external_id: string
  term_id: string | null
  subject_id: string
  subject_code: string
  subject_name: string | null
  period_name: string | null
  date: string
  start_time: string
  room: string | null
  status: string | null
  registration_from: string | null
  changes?: Record<string, { from: unknown; to: unknown }>
}

export type SkipReason =
  | "unknown_subject"
  | "ambiguous_subject"
  | "no_period"
  | "ambiguous_period"
  | "resit"
  | "dismissed" // the user deleted this synced term

export interface ImportSkip {
  external_id: string
  subject_code: string
  date: string
  start_time: string
  reason: SkipReason
}

export interface ImportPlan {
  ops: ImportOp[]
  events: ImportEvent[]
  skipped: ImportSkip[]
  warnings: string[]
  unchanged: number
}

export interface PlanInput {
  source: ExamTermSource
  today: string // YYYY-MM-DD, Prague
  now: string // ISO timestamp for synced_at / removed_at
  complete: boolean
  periods: Doc[]
  subjects: Doc[]
  terms: Doc[] // all terms of the study's periods
  dismissed?: Set<string> // external ids of synced terms the user deleted
  incoming: ImportedTerm[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

const hhmm = (time: string | null | undefined) => String(time || "").slice(0, 5)

function minutesBetween(start: string, end: string | null): number | null {
  if (!end) return null
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  const minutes = eh * 60 + em - (sh * 60 + sm)
  return minutes >= 5 ? minutes : null
}

/** Which kind of assessment a period is for, judged by its name ("Zápočet (ZS)", "Zkoušky (LS)"). */
export function periodAssessment(name: string | null | undefined): "credit" | "exam" | null {
  const n = normalizeText(name)
  const credit = /zapoc/.test(n)
  const exam = /zkous/.test(n)
  if (credit === exam) return null
  return credit ? "credit" : "exam"
}

const isActivePeriod = (period: Doc, today: string) => !period.due_date || String(period.due_date) >= today

const isOnlineRoom = (room: string | null) => /\b(online|on-line|teams|zoom|distan)/i.test(room || "")

/** Parts of a split exam a term covers, from its form ("písemná"); [] = the whole exam. */
export function partIdsForForm(config: ExamPartsConfig | null | undefined, form: string | null): string[] {
  if (!config || !form) return []
  const f = normalizeText(form)
  const matched = config.parts.filter((p) => {
    const label = normalizeText(p.label)
    return label.length > 0 && (f.includes(label) || label.includes(f))
  })
  return matched.length > 0 && matched.length < config.parts.length ? matched.map((p) => p.id) : []
}

function pickSubject(code: string, subjects: Doc[], activePeriods: Doc[]): { subject?: Doc; reason?: SkipReason } {
  const matches = subjects.filter((s) => normalizeText(s.abbreviation) === normalizeText(code))
  if (matches.length === 0) return { reason: "unknown_subject" }
  if (matches.length === 1) return { subject: matches[0] }
  // A repeated subject has the same code in two semesters: take the one a current period lists.
  const listed = matches.filter((s) => activePeriods.some((p) => (p.subject_ids || []).includes(String(s._id))))
  const pool = listed.length > 0 ? listed : matches.filter((s) => !s.completed)
  return pool.length === 1 ? { subject: pool[0] } : { reason: "ambiguous_subject" }
}

/** The current period a new term belongs to; see docs/EXAM_IMPORT.md for the order of the rules. */
export function pickPeriod(term: ImportedTerm, subjectId: string, activePeriods: Doc[]): { period?: Doc; reason?: SkipReason } {
  let candidates = activePeriods.filter((p) => (p.subject_ids || []).includes(subjectId))
  if (term.assessment) {
    candidates = candidates.filter((p) => {
      const kind = periodAssessment(p.name)
      return kind === null || kind === term.assessment
    })
  }
  if (candidates.length === 0) return { reason: "no_period" }
  if (candidates.length === 1) return { period: candidates[0] }

  if (term.assessment) {
    const named = candidates.filter((p) => periodAssessment(p.name) === term.assessment)
    if (named.length === 1) return { period: named[0] }
    if (named.length > 1) candidates = named
  }
  const containing = candidates.filter((p) => p.start_date <= term.date && term.date <= p.due_date)
  if (containing.length === 1) return { period: containing[0] }
  if (containing.length === 0) {
    // A předtermín: the nearest period that starts after the term.
    const later = candidates.filter((p) => p.start_date > term.date).sort((a, b) => a.start_date.localeCompare(b.start_date))
    if (later.length === 1 || (later.length > 1 && later[0].start_date !== later[1].start_date)) return { period: later[0] }
  }
  return { reason: "ambiguous_period" }
}

function externalFor(term: ImportedTerm, previous: ExamTermExternal | null | undefined, now: string): ExamTermExternal {
  return {
    kind: term.kind,
    term_type: term.term_type,
    room: term.room,
    examiners: term.examiners,
    listed_by: term.listed_by,
    capacity: term.capacity,
    registered_count: term.registered_count,
    registration_from: term.registration_from,
    registration_to: term.registration_to,
    deregistration_to: term.deregistration_to,
    status: term.status,
    status_note: term.status_note,
    auto_locked: previous?.auto_locked ?? false,
    removed_at: null,
    synced_at: now,
  }
}

// Details that change on their own as other students sign up; refreshing only these is not
// worth an entry in the change log.
const VOLATILE_EXTERNAL_KEYS = new Set(["registered_count", "status_note", "synced_at"])

function changedFields(before: Doc, patch: Doc) {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const [key, to] of Object.entries(patch)) {
    if (key === "external") {
      const from = (before.external || {}) as Doc
      for (const [k, v] of Object.entries(to as Doc)) {
        if (k === "synced_at") continue
        if (JSON.stringify(from[k] ?? null) !== JSON.stringify(v ?? null)) changes[`external.${k}`] = { from: from[k] ?? null, to: v ?? null }
      }
      continue
    }
    const from = key === "start_time" ? hhmm(before[key]) : before[key]
    const next = key === "start_time" ? hhmm(to as string) : to
    if (JSON.stringify(from ?? null) !== JSON.stringify(next ?? null)) changes[key] = { from: from ?? null, to: next ?? null }
  }
  return changes
}

// ─── Planner ────────────────────────────────────────────────────────────────

export function planImport(input: PlanInput): ImportPlan {
  const { source, today, now } = input
  const plan: ImportPlan = { ops: [], events: [], skipped: [], warnings: [], unchanged: 0 }

  const periodsById = new Map(input.periods.map((p) => [String(p._id), p]))
  const activePeriods = input.periods.filter((p) => isActivePeriod(p, today))
  const subjectsById = new Map(input.subjects.map((s) => [String(s._id), s]))
  const synced = new Map(
    input.terms.filter((t) => t.source === source && t.external_id).map((t) => [String(t.external_id), t])
  )
  const adopted = new Set<string>()
  const seen = new Set<string>()

  const event = (type: ImportEventType, term: ImportedTerm, doc: Doc, extra: Partial<ImportEvent> = {}): ImportEvent => ({
    type,
    external_id: term.external_id,
    term_id: doc._id ? String(doc._id) : null,
    subject_id: String(doc.subject_id),
    subject_code: term.subject_code || subjectsById.get(String(doc.subject_id))?.abbreviation || "",
    subject_name: subjectsById.get(String(doc.subject_id))?.name ?? term.subject_name,
    period_name: periodsById.get(String(doc.period_id))?.name ?? null,
    date: term.date,
    start_time: term.start_time,
    room: term.room,
    status: term.status,
    registration_from: term.registration_from,
    ...extra,
  })

  /** Patch that brings an existing term (synced or adopted) in line with the source. */
  const syncPatch = (term: ImportedTerm, before: Doc, period: Doc | undefined, adopting: boolean) => {
    const external = externalFor(term, before.external, now)
    const patch: Doc = {
      date: term.date,
      start_time: term.start_time,
      is_tentative: false,
      is_pre_term: term.attempt === "pre_term" || (period ? term.date < period.start_date : !!before.is_pre_term),
      external,
    }
    if (adopting) {
      patch.source = source
      patch.external_id = term.external_id
    }
    const duration = minutesBetween(term.start_time, term.end_time)
    if (duration) patch.duration_minutes = duration
    const config: ExamPartsConfig | undefined = period?.exam_parts?.[before.subject_id]
    if (config && term.form) patch.part_ids = partIdsForForm(config, term.form)

    const wasRegistered = before.external?.status === EXTERNAL_TERM_STATUS.REGISTERED
    const isRegistered = term.status === EXTERNAL_TERM_STATUS.REGISTERED
    const types: ImportEventType[] = []
    if (isRegistered && !wasRegistered) {
      if (!before.locked) {
        patch.locked = true
        external.auto_locked = true
      }
      types.push("registered")
    } else if (!isRegistered && wasRegistered) {
      if (before.locked && before.external?.auto_locked) patch.locked = false
      external.auto_locked = false
      types.push("deregistered")
    }
    if (before.external?.removed_at) types.push("restored")
    return { patch, types }
  }

  for (const term of input.incoming) {
    seen.add(term.external_id)
    const existing = synced.get(term.external_id)

    if (existing) {
      const period = periodsById.get(String(existing.period_id))
      const { patch, types } = syncPatch(term, existing, period, false)
      const changes = changedFields(existing, patch)
      if (Object.keys(changes).length === 0) {
        plan.unchanged++
        continue
      }
      const meaningful = Object.keys(changes).some(
        (k) => !(k.startsWith("external.") && VOLATILE_EXTERNAL_KEYS.has(k.slice("external.".length)))
      )
      plan.ops.push({ op: "update", id: String(existing._id), before: existing, patch, audit: meaningful })
      if (changes.date || changes.start_time) {
        types.unshift("rescheduled")
      }
      for (const type of types) {
        plan.events.push(event(type, term, existing, type === "rescheduled" ? { changes: pick(changes, ["date", "start_time"]) } : {}))
      }
      continue
    }

    const skip = (reason: SkipReason) =>
      plan.skipped.push({ external_id: term.external_id, subject_code: term.subject_code, date: term.date, start_time: term.start_time, reason })

    if (input.dismissed?.has(term.external_id)) {
      skip("dismissed")
      continue
    }
    // Resit terms (opravné) are only open after a failed attempt; they are no plan option.
    if (term.attempt === "resit") {
      skip("resit")
      continue
    }
    const { subject, reason: subjectReason } = pickSubject(term.subject_code, input.subjects, activePeriods)
    if (!subject) {
      skip(subjectReason!)
      continue
    }
    const subjectId = String(subject._id)
    const { period, reason: periodReason } = pickPeriod(term, subjectId, activePeriods)
    if (!period) {
      skip(periodReason!)
      continue
    }
    const periodId = String(period._id)

    // A term entered by hand for the same subject and day becomes the synced one.
    const manual = input.terms
      .filter(
        (t) =>
          !t.external_id &&
          String(t.period_id) === periodId &&
          String(t.subject_id) === subjectId &&
          t.date === term.date &&
          !adopted.has(String(t._id))
      )
      .sort((a, b) => Number(hhmm(b.start_time) === term.start_time) - Number(hhmm(a.start_time) === term.start_time))[0]

    if (manual) {
      adopted.add(String(manual._id))
      const { patch, types } = syncPatch(term, manual, period, true)
      const changes = changedFields(manual, patch)
      plan.ops.push({ op: "update", id: String(manual._id), before: manual, patch, audit: true })
      plan.events.push(event("adopted", term, manual, { changes: pick(changes, ["date", "start_time", "is_tentative", "locked"]) }))
      for (const type of types) plan.events.push(event(type, term, manual))
      continue
    }

    const registered = term.status === EXTERNAL_TERM_STATUS.REGISTERED
    const external = externalFor(term, null, now)
    external.auto_locked = registered
    const doc: Doc = {
      period_id: periodId,
      study_id: period.study_id,
      subject_id: subjectId,
      date: term.date,
      start_time: term.start_time,
      duration_minutes: minutesBetween(term.start_time, term.end_time) ?? EXAM_SCHEDULER_DEFAULTS.DEFAULT_EXAM_DURATION_MINUTES,
      is_online: isOnlineRoom(term.room),
      note: null,
      locked: registered,
      part_ids: partIdsForForm(period.exam_parts?.[subjectId], term.form),
      is_pre_term: term.attempt === "pre_term" || term.date < period.start_date,
      is_tentative: false,
      source,
      external_id: term.external_id,
      external,
    }
    plan.ops.push({ op: "create", doc })
    plan.events.push(event("created", term, doc))
    if (registered) plan.events.push(event("registered", term, doc))
  }

  // Upcoming synced terms the source no longer lists were cancelled or moved out of reach.
  if (input.complete) {
    const missing = [...synced.values()].filter(
      (t) =>
        !seen.has(String(t.external_id)) &&
        String(t.date) >= today &&
        isActivePeriod(periodsById.get(String(t.period_id)) || {}, today)
    )
    if (missing.length > 0 && input.incoming.length === 0) {
      plan.warnings.push(
        `The snapshot is empty but ${missing.length} upcoming synced term(s) exist; nothing was removed. Check the importer.`
      )
    } else {
      for (const t of missing) {
        const asTerm = termFromDoc(t)
        if (t.locked) {
          if (t.external?.removed_at) continue
          plan.ops.push({ op: "update", id: String(t._id), before: t, patch: { external: { ...t.external, removed_at: now } }, audit: true })
          plan.events.push(event("removed_locked", asTerm, t))
        } else {
          plan.ops.push({ op: "delete", id: String(t._id), before: t })
          plan.events.push(event("removed", asTerm, t))
        }
      }
    }
  }

  return plan
}

function pick<T extends Record<string, unknown>>(obj: T, keys: string[]) {
  const out: Record<string, unknown> = {}
  for (const k of keys) if (k in obj) out[k] = obj[k]
  return out as T
}

/** An existing synced term as an ImportedTerm, for events about terms the source dropped. */
function termFromDoc(t: Doc): ImportedTerm {
  const x = (t.external || {}) as Partial<ExamTermExternal>
  return {
    external_id: String(t.external_id),
    subject_code: "",
    subject_name: null,
    date: t.date,
    start_time: hhmm(t.start_time),
    end_time: null,
    assessment: null,
    form: null,
    attempt: null,
    status: (x.status as ImportedTerm["status"]) ?? EXTERNAL_TERM_STATUS.AVAILABLE,
    status_note: x.status_note ?? null,
    kind: x.kind ?? null,
    term_type: x.term_type ?? null,
    room: x.room ?? null,
    examiners: x.examiners ?? null,
    listed_by: x.listed_by ?? null,
    capacity: x.capacity ?? null,
    registered_count: x.registered_count ?? null,
    registration_from: x.registration_from ?? null,
    registration_to: x.registration_to ?? null,
    deregistration_to: x.deregistration_to ?? null,
  }
}
