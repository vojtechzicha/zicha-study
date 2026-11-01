import type { GlobalRequirement, GlobalTerm } from "./global-scheduler"
import { DEFAULT_WORKING_DAYS, EXAM_VENUE_INFO, type ExamVenue, type VenueDay } from "@/lib/constants"
import { computeTimeThresholds, type SchedulerConfig } from "./types"
import { isWorkingDay, parseTimeToMinutes } from "./utils"

// Window terms: an exam that can be taken on any day of a date range, typically in a testing
// centre that opens its days in batches (Testovací centrum PEF at ČZU). The scheduler works with
// concrete slots, so a window is expanded into candidate slots, one or two per open day; the
// chosen one is booked by the student and recorded as an ordinary locked term (window_id).

export interface VenueCalendar {
  days: Map<string, VenueDay>
  // Last date the venue has published. Days up to it that aren't listed are closed; days after
  // it are not known yet and are assumed open with the venue's usual hours (tentative).
  publishedThrough: string | null
}

export interface WindowTermInput {
  termId: string
  date: string // first day of the window
  windowEnd: string // last day (inclusive)
  startTime: string // used for windows without a venue
  durationMinutes: number
  isOnline: boolean
  note: string | null
  partIds?: string[]
  venue?: ExamVenue | null
  isTentative?: boolean
}

export interface ExpandOptions {
  today: string // YYYY-MM-DD; no candidates in the past
  periodStart: string // candidates before it are předtermíny
  calendars: Partial<Record<ExamVenue, VenueCalendar>>
  // The study's travel settings: slots are also offered at the times that allow travelling there
  // and back the same day (no night in the city), and its free days are kept by the reduction.
  study?: SchedulerConfig
  // The minimum gap between two parts of a split exam (exam_part_gap_minutes): gap slots are also
  // offered this far from the study's other exams, besides right at their start and end.
  partGapMinutes?: number
  // How many other window terms the study has: in the full expansion (not onlyAnchorDays, i.e. the
  // fallback when something didn't fit) a day then also offers back-to-back starts from the opening
  // time and back from the last start, so several tests can share a short day.
  otherWindows?: number
  // The study's other candidate terms by day ([start, end] in minutes). Slots are then also
  // offered right before and right after them (the gaps between exams). With `onlyAnchorDays`,
  // only these days are offered, in the slots clear of them, plus the window's first and last open
  // day and its free days (no day off work needed, one same-day-travel slot each): a test on a day
  // with a trip anyway costs nothing extra, and offering every day of a five-week window makes the
  // exhaustive search far too slow.
  anchors?: Map<string, [number, number][]>
  onlyAnchorDays?: boolean
}

/**
 * Runs the scheduler on requirements whose windows are expanded only on trip days, and, when a
 * requirement with a window can't be placed that way, again with that requirement's windows
 * expanded to every open day. The reduced expansion keeps the search fast; the fallback keeps it
 * from missing a plan the full expansion would find (e.g. several windows on the same dates and
 * no other exams to anchor them).
 */
export function scheduleWithWindowFallback<T extends { forced: { unschedulable: { requirementId: string }[] } }>(
  build: (_fullWindows: Set<string>) => GlobalRequirement[],
  run: (_requirements: GlobalRequirement[]) => T,
  windowRequirementIds: Set<string>
): { requirements: GlobalRequirement[]; comparison: T } {
  const requirements = build(new Set())
  const comparison = run(requirements)
  // Whatever was left out (a window, or an ordinary exam a window pushed out, even of another
  // study), every window gets all its open days.
  if (comparison.forced.unschedulable.length === 0 || windowRequirementIds.size === 0) return { requirements, comparison }
  const full = build(windowRequirementIds)
  return { requirements: full, comparison: run(full) }
}

/** The study's other candidate terms by day, for ExpandOptions.anchors. */
export function anchorsOf(terms: { date: string; startTime: string; durationMinutes: number }[]): Map<string, [number, number][]> {
  const map = new Map<string, [number, number][]>()
  for (const t of terms) {
    const start = parseTimeToMinutes(t.startTime)
    const list = map.get(t.date) || []
    list.push([start, start + t.durationMinutes])
    map.set(t.date, list)
  }
  return map
}

const SEP = "@"
// A late slot is offered only when it is far enough from the early one to matter.
const MIN_SLOT_SPREAD_MINUTES = 120

export function windowCandidateId(windowId: string, date: string, startTime: string): string {
  return `${windowId}${SEP}${date}T${startTime}`
}

export function parseWindowCandidateId(id: string): { windowId: string; date: string; startTime: string } | null {
  const m = id.match(/^(.+)@(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/)
  return m ? { windowId: m[1], date: m[2], startTime: m[3] } : null
}

const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The opening hours of `date` at a venue, or null when it is closed. */
export function venueHours(
  venue: ExamVenue,
  calendar: VenueCalendar | undefined,
  date: string
): { open: string; close: string; occupancy: number | null; known: boolean } | null {
  const day = calendar?.days.get(date)
  if (day) return { open: day.open_from, close: day.open_to, occupancy: day.occupancy, known: true }
  if (calendar?.publishedThrough && date <= calendar.publishedThrough) return null
  const info = EXAM_VENUE_INFO[venue]
  return { open: info.defaultOpen, close: info.defaultClose, occupancy: null, known: false }
}

/** Candidate slots of a window term, in date order. */
export function expandWindowTerm(term: WindowTermInput, opts: ExpandOptions): GlobalTerm[] {
  const all = expandAllDays(term, opts)
  const anchors = opts.anchors
  if (!anchors || !opts.onlyAnchorDays) return all
  const days = [...new Set(all.map((s) => s.date))]
  const out: GlobalTerm[] = []
  for (const date of days) {
    const slots = all.filter((s) => s.date === date)
    const busy = anchors.get(date)
    if (busy) {
      const clear = slots.filter((s) => {
        const start = parseTimeToMinutes(s.startTime)
        const end = start + s.durationMinutes
        // Like the solver: two exams of one study only must not overlap.
        return busy.every(([b0, b1]) => end <= b0 || b1 <= start)
      })
      // Every clear slot: a split exam's order may need the later one (written at 10:00, then the
      // TC part). If none is clear, both, and the solver sorts it out.
      out.push(...(clear.length > 0 ? clear : slots))
    } else if (date === days[0] || date === days[days.length - 1]) {
      out.push(...slots)
    } else if (!isWorkingDay(date, opts.study?.workingDays?.length ? opts.study.workingDays : DEFAULT_WORKING_DAYS)) {
      out.push(sameDaySlot(slots, opts.study) ?? slots[0])
    }
  }
  return out
}

/** The slot of a day that needs no night in the city, if any. */
function sameDaySlot(slots: GlobalTerm[], study: SchedulerConfig | undefined): GlobalTerm | null {
  if (!study) return null
  const { earliestSameDayArrival, latestSameDayDeparture } = computeTimeThresholds(study)
  const from = parseTimeToMinutes(earliestSameDayArrival)
  const to = parseTimeToMinutes(latestSameDayDeparture)
  return slots.find((s) => {
    const start = parseTimeToMinutes(s.startTime)
    return start >= from && start + s.durationMinutes <= to
  }) ?? null
}

/**
 * Every open day of the window: the earliest start, the latest one (when far enough apart) and
 * starts right before and after the study's other exams that day, so a test can go in a gap.
 */
function expandAllDays(term: WindowTermInput, opts: ExpandOptions): GlobalTerm[] {
  const out: GlobalTerm[] = []
  const first = term.date > opts.today ? term.date : opts.today
  for (let date = first, n = 0; date <= term.windowEnd && n < 400; date = addDays(date, 1), n++) {
    const base = {
      durationMinutes: term.durationMinutes,
      isOnline: term.isOnline,
      note: term.note,
      locked: false,
      partIds: term.partIds,
      isPreTerm: date < opts.periodStart,
    }
    if (!term.venue) {
      out.push({ ...base, termId: windowCandidateId(term.termId, date, term.startTime), date, startTime: term.startTime, isTentative: !!term.isTentative })
      continue
    }
    const hours = venueHours(term.venue, opts.calendars[term.venue], date)
    if (!hours) continue
    const early = parseTimeToMinutes(hours.open)
    const lastStart = parseTimeToMinutes(hours.close) - term.durationMinutes
    if (early > lastStart) continue
    const starts = new Set(lastStart - early >= MIN_SLOT_SPREAD_MINUTES ? [early, lastStart] : [early])
    if (opts.study) {
      // The first and last start that still allow travelling there and back the same day.
      const { earliestSameDayArrival, latestSameDayDeparture } = computeTimeThresholds(opts.study)
      for (const start of [
        parseTimeToMinutes(earliestSameDayArrival),
        parseTimeToMinutes(latestSameDayDeparture) - term.durationMinutes,
      ]) {
        if (start >= early && start <= lastStart) starts.add(start)
      }
    }
    // Back to back with the study's other windows, from either end of the day.
    const packing = opts.onlyAnchorDays ? 0 : Math.min(opts.otherWindows ?? 0, 10)
    for (let k = 1; k <= packing; k++) {
      for (const start of [early + k * term.durationMinutes, lastStart - k * term.durationMinutes]) {
        if (start >= early && start <= lastStart) starts.add(start)
      }
    }
    // Right before and after the study's other exams (the solver only forbids overlap), and the
    // part gap away from them (needed when they are the other part of the same exam).
    const pads = [0, ...(opts.partGapMinutes && opts.partGapMinutes > 0 ? [opts.partGapMinutes] : [])]
    for (const [b0, b1] of opts.anchors?.get(date) || []) {
      for (const pad of pads) {
        for (const start of [b0 - pad - term.durationMinutes, b1 + pad]) {
          if (start >= early && start <= lastStart) starts.add(start)
        }
      }
    }
    for (const start of [...starts].sort((a, b) => a - b)) {
      const startTime = toTime(start)
      out.push({
        ...base,
        termId: windowCandidateId(term.termId, date, startTime),
        date,
        startTime,
        isTentative: !hours.known || !!term.isTentative,
      })
    }
  }
  return out
}
