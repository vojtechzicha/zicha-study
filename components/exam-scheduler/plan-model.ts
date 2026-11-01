import type { ExamTermExternal } from "@/lib/constants"

// What the scheduler page shows about one candidate term, in or out of the plan.
export interface PlanTerm {
  id: string
  requirementId: string // `${periodId}:${subjectId}`
  studyId: string
  periodId: string
  periodName: string
  subjectId: string
  shortcut: string
  subjectName: string
  date: string
  startTime: string
  endTime: string
  isOnline: boolean
  locked: boolean
  partLabel: string | null
  isPreTerm: boolean
  isTentative: boolean
  note: string | null
  source?: string | null
  external?: ExamTermExternal | null
  inPlan: boolean
  requiresPto: boolean
}

export interface PlanStudy {
  id: string
  name: string
  logo_url?: string | null
  tone: StudyTone
}

// A colour per study, so the calendar shows at a glance where each trip goes.
// Amber is kept for "needs locking" and is never a study colour.
export interface StudyTone {
  ribbon: string // trip bar
  solid: string // locked planned term
  dashed: string // planned term that is not locked yet
  ring: string // another possible term
  swatch: string
}

export const STUDY_TONES: StudyTone[] = [
  {
    ribbon: "bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200",
    solid: "bg-teal-600 text-white dark:bg-teal-500 dark:text-teal-950",
    dashed: "border-teal-500 text-teal-800 dark:border-teal-400 dark:text-teal-200",
    ring: "border-teal-500 dark:border-teal-400",
    swatch: "bg-teal-500",
  },
  {
    ribbon: "bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-200",
    solid: "bg-violet-600 text-white dark:bg-violet-500 dark:text-violet-950",
    dashed: "border-violet-500 text-violet-800 dark:border-violet-400 dark:text-violet-200",
    ring: "border-violet-500 dark:border-violet-400",
    swatch: "bg-violet-500",
  },
  {
    ribbon: "bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200",
    solid: "bg-sky-600 text-white dark:bg-sky-500 dark:text-sky-950",
    dashed: "border-sky-500 text-sky-800 dark:border-sky-400 dark:text-sky-200",
    ring: "border-sky-500 dark:border-sky-400",
    swatch: "bg-sky-500",
  },
  {
    ribbon: "bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200",
    solid: "bg-rose-600 text-white dark:bg-rose-500 dark:text-rose-950",
    dashed: "border-rose-500 text-rose-800 dark:border-rose-400 dark:text-rose-200",
    ring: "border-rose-500 dark:border-rose-400",
    swatch: "bg-rose-500",
  },
]

export function formatCzk(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** "čt 14. 1." */
export function formatDayShort(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  const wd = d.toLocaleDateString("cs-CZ", { weekday: "short" })
  return `${wd}\u00a0${d.getDate()}.\u00a0${d.getMonth() + 1}.`
}

/** "čtvrtek 14. ledna" */
export function formatDayLong(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })
}

/** "leden 2027" */
export function formatMonth(month: string): string {
  const s = new Date(`${month}-01T00:00:00`).toLocaleDateString("cs-CZ", { month: "long", year: "numeric" })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "led" */
export function formatMonthShort(month: string): string {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("cs-CZ", { month: "short" }).replace(".", "")
}

/** Current Prague wall-clock time as "YYYY-MM-DDTHH:MM" (sync data uses Prague time). */
export function pragueNow(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00"
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
}
