/**
 * Calendar view of a generated plan: trips (journeys to one study's city),
 * month grids, and the order in which unlocked planned terms should be locked.
 * Pure date-string helpers ("YYYY-MM-DD"), no time zones.
 */
import type { ScheduleItem } from "./types"
import { getTermPartIds, type ExamPartsConfig, type ExamTermExternal } from "@/lib/constants"

// ─── Dates ───────────────────────────────────────────────────────────────────

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUtc(d)
}

/** 0 = Monday … 6 = Sunday. */
export function mondayIndex(date: string): number {
  return (toUtc(date).getUTCDay() + 6) % 7
}

/** 0 = Sunday … 6 = Saturday, the convention of `working_days`. */
export function sundayIndex(date: string): number {
  return toUtc(date).getUTCDay()
}

export function monthKey(date: string): string {
  return date.slice(0, 7)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000)
}

/** Monday-first weeks covering the month, padded with days of the adjacent months. */
export function monthWeeks(month: string): string[][] {
  const first = `${month}-01`
  const start = addDays(first, -mondayIndex(first))
  const weeks: string[][] = []
  let day = start
  while (weeks.length === 0 || monthKey(day) === month) {
    const week: string[] = []
    for (let i = 0; i < 7; i++) {
      week.push(day)
      day = addDays(day, 1)
    }
    weeks.push(week)
  }
  return weeks
}

/**
 * Months worth showing: every month from `today`'s month on that contains one of
 * `dates` or overlaps one of `ranges`. Months with nothing in them are skipped.
 */
export function relevantMonths(dates: string[], ranges: { start: string; end: string }[], today: string): string[] {
  const from = monthKey(today)
  const months = new Set<string>()
  for (const d of dates) if (monthKey(d) >= from) months.add(monthKey(d))
  for (const r of ranges) {
    if (r.end < r.start) continue
    let m = monthKey(r.start)
    const last = monthKey(r.end)
    while (m <= last) {
      if (m >= from) months.add(m)
      m = nextMonth(m)
    }
  }
  return Array.from(months).sort()
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
}

// ─── Trips ───────────────────────────────────────────────────────────────────

/** One journey to a study's city: leave on `start`, come home on `end`. */
export interface PlanTrip {
  studyId: string
  start: string
  end: string
  nights: string[] // nights spent there, by the date of the evening
  departTime: string | null // leaving home
  returnTime: string | null // leaving for home
  cost: number
}

/** Groups a plan's travel and accommodation items into trips, per study. */
export function buildTrips(items: ScheduleItem[]): PlanTrip[] {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date))
  const open = new Map<string, PlanTrip>()
  const trips: PlanTrip[] = []

  for (const it of sorted) {
    const studyId = it.studyId ?? ""
    if (it.type === "travel_to") {
      const prev = open.get(studyId)
      if (prev) trips.push(prev)
      open.set(studyId, { studyId, start: it.date, end: it.date, nights: [], departTime: it.startTime ?? null, returnTime: null, cost: it.cost })
    } else if (it.type === "accommodation") {
      const trip = open.get(studyId)
      if (trip) {
        trip.nights.push(it.date)
        trip.cost += it.cost
        trip.end = it.date > trip.end ? it.date : trip.end
      }
    } else if (it.type === "travel_from") {
      const trip = open.get(studyId) ?? { studyId, start: it.date, end: it.date, nights: [], departTime: null, returnTime: null, cost: 0 }
      trip.end = it.date
      trip.returnTime = it.startTime ?? null
      trip.cost += it.cost
      trips.push(trip)
      open.delete(studyId)
    }
  }
  trips.push(...open.values())
  return trips.sort((a, b) => a.start.localeCompare(b.start) || a.studyId.localeCompare(b.studyId))
}

/** The part of a trip that falls into one week, as 0-based columns, with a lane per overlap. */
export interface TripSegment {
  trip: PlanTrip
  colStart: number
  colEnd: number // inclusive
  startsHere: boolean
  endsHere: boolean
  lane: number
}

export function weekTripSegments(week: string[], trips: PlanTrip[]): TripSegment[] {
  const first = week[0]
  const last = week[week.length - 1]
  const segments: TripSegment[] = []
  const laneEnds: number[] = []
  for (const trip of trips) {
    if (trip.end < first || trip.start > last) continue
    const colStart = trip.start < first ? 0 : week.indexOf(trip.start)
    const colEnd = trip.end > last ? week.length - 1 : week.indexOf(trip.end)
    let lane = laneEnds.findIndex((end) => end < colStart)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(colEnd)
    } else {
      laneEnds[lane] = colEnd
    }
    segments.push({ trip, colStart, colEnd, startsHere: trip.start >= first, endsHere: trip.end <= last, lane })
  }
  return segments
}

// ─── Locking ─────────────────────────────────────────────────────────────────

export interface LockableTerm {
  id: string
  locked: boolean
  part_ids?: string[]
}

/**
 * Locked terms to release when `termId` gets locked: only one term per subject
 * can be locked, or for a split exam one per part (same rule as the period editor).
 */
export function termsToUnlock(terms: LockableTerm[], termId: string, parts?: ExamPartsConfig | null): string[] {
  const target = terms.find((t) => t.id === termId)
  if (!target) return []
  const targetParts = new Set(getTermPartIds(target, parts))
  return terms
    .filter((t) => t.id !== termId && t.locked)
    .filter((t) => !parts || getTermPartIds(t, parts).some((id) => targetParts.has(id)))
    .map((t) => t.id)
}

/** Where sign-up for a synced term stands at `now` ("YYYY-MM-DDTHH:MM", Prague time). */
export type RegistrationState =
  | { kind: "registered" }
  | { kind: "open"; until: string | null }
  | { kind: "opens"; from: string }
  | { kind: "closed" }
  | { kind: "unknown" }

export function registrationState(external: ExamTermExternal | null | undefined, now: string): RegistrationState {
  if (!external) return { kind: "unknown" }
  if (external.status === "registered") return { kind: "registered" }
  const from = external.registration_from
  const to = external.registration_to
  if (to && to < now) return { kind: "closed" }
  if (from && from > now) return { kind: "opens", from }
  if (from || to || external.status === "available") return { kind: "open", until: to }
  return { kind: "unknown" }
}

/**
 * Lock order: open sign-ups first (closing soonest first), then sign-ups that
 * open soonest, then the rest by exam date.
 */
export function lockPriority(state: RegistrationState, date: string): [number, string] {
  switch (state.kind) {
    case "open":
      return [0, state.until ?? `${date}T00:00`]
    case "opens":
      return [1, state.from]
    case "registered":
      return [0, `${date}T00:00`]
    default:
      return [2, `${date}T00:00`]
  }
}
