import type { GlobalTerm } from "./global-scheduler"
import { EXAM_VENUE_INFO, type ExamVenue, type VenueDay } from "@/lib/constants"
import { parseTimeToMinutes } from "./utils"

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
  earliestArrival?: string // HH:MM, the study's earliest arrival
  // The study's other candidate terms by day ([start, end] in minutes). When given, only these
  // days are offered, in the slot that doesn't collide with them (both slots if neither is clear),
  // plus the window's first and last open day: a test on a day with a trip anyway costs nothing
  // extra, and offering every day of a five-week window makes the exhaustive search far too slow.
  anchors?: Map<string, [number, number][]>
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

// A slot is clear of another exam when there is at least this much time between them.
const CLEAR_MINUTES = 30

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
  if (!anchors) return all
  const days = [...new Set(all.map((s) => s.date))]
  const out: GlobalTerm[] = []
  for (const date of days) {
    const slots = all.filter((s) => s.date === date)
    const busy = anchors.get(date)
    if (busy) {
      const clear = slots.filter((s) => {
        const start = parseTimeToMinutes(s.startTime)
        const end = start + s.durationMinutes
        return busy.every(([b0, b1]) => end + CLEAR_MINUTES <= b0 || b1 + CLEAR_MINUTES <= start)
      })
      out.push(...(clear.length > 0 ? clear.slice(0, 1) : slots))
    } else if (date === days[0] || date === days[days.length - 1]) {
      out.push(slots[0])
    }
  }
  return out
}

/** Every open day of the window, with an early and (when the day is long enough) a late slot. */
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
    const open = parseTimeToMinutes(hours.open)
    const lastStart = parseTimeToMinutes(hours.close) - term.durationMinutes
    const arrival = opts.earliestArrival ? parseTimeToMinutes(opts.earliestArrival) : open
    const early = Math.max(open, arrival)
    if (early > lastStart) continue
    const slots = lastStart - early >= MIN_SLOT_SPREAD_MINUTES ? [early, lastStart] : [early]
    for (const start of slots) {
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
