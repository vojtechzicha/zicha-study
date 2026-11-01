import type { ExamTermExternal, ExamVenue } from "@/lib/constants"

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
  // A slot offered by a window term (lib/exam-scheduler/windows.ts): not a stored term yet.
  windowId?: string | null
  venue?: ExamVenue | null
  venueOccupancy?: number | null
}

export interface PlanStudy {
  id: string
  name: string
  logo_url?: string | null
  tone: StudyTone
}

// Default colours of studies without a usable logo colour (pickStudyTones), so the calendar shows
// at a glance where each trip goes. Amber is kept for "needs locking" and is never a study colour.
export interface StudyTone {
  ribbon: string // trip bar
  solid: string // locked planned term
  dashed: string // planned term that is not locked yet
  ring: string // another possible term
  swatch: string
}

// Filled in below from STUDY_TONE_FAMILIES (teal, violet, sky, rose), so the defaults have the same
// accessible shades as the logo colours.
export const STUDY_TONES: StudyTone[] = []

// Colour families a study can take from its logo (Tailwind hues of the 500 shade). Amber and
// yellow are left out: amber means "needs locking", yellow has too little contrast. Class strings
// are written out in full so Tailwind generates them. The solid chip (small text on the colour) uses
// the shades that reach WCAG AA 4.5:1 in both modes (checked in __tests__/plan-model.test.ts).
export const STUDY_TONE_FAMILIES: Record<string, { hue: number; tone: StudyTone }> = {
  red: {
    hue: 0,
    tone: {
      ribbon: "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200",
      solid: "bg-red-600 text-white dark:bg-red-400 dark:text-red-950",
      dashed: "border-red-500 text-red-800 dark:border-red-400 dark:text-red-200",
      ring: "border-red-500 dark:border-red-400",
      swatch: "bg-red-500",
    },
  },
  orange: {
    hue: 25,
    tone: {
      ribbon: "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200",
      solid: "bg-orange-700 text-white dark:bg-orange-500 dark:text-orange-950",
      dashed: "border-orange-500 text-orange-800 dark:border-orange-400 dark:text-orange-200",
      ring: "border-orange-500 dark:border-orange-400",
      swatch: "bg-orange-500",
    },
  },
  green: {
    hue: 142,
    tone: {
      ribbon: "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200",
      solid: "bg-green-700 text-white dark:bg-green-500 dark:text-green-950",
      dashed: "border-green-500 text-green-800 dark:border-green-400 dark:text-green-200",
      ring: "border-green-500 dark:border-green-400",
      swatch: "bg-green-500",
    },
  },
  emerald: {
    hue: 160,
    tone: {
      ribbon: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200",
      solid: "bg-emerald-700 text-white dark:bg-emerald-500 dark:text-emerald-950",
      dashed: "border-emerald-500 text-emerald-800 dark:border-emerald-400 dark:text-emerald-200",
      ring: "border-emerald-500 dark:border-emerald-400",
      swatch: "bg-emerald-500",
    },
  },
  teal: {
    hue: 173,
    tone: {
      ribbon: "bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200",
      solid: "bg-teal-700 text-white dark:bg-teal-500 dark:text-teal-950",
      dashed: "border-teal-500 text-teal-800 dark:border-teal-400 dark:text-teal-200",
      ring: "border-teal-500 dark:border-teal-400",
      swatch: "bg-teal-500",
    },
  },
  cyan: {
    hue: 189,
    tone: {
      ribbon: "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200",
      solid: "bg-cyan-700 text-white dark:bg-cyan-500 dark:text-cyan-950",
      dashed: "border-cyan-500 text-cyan-800 dark:border-cyan-400 dark:text-cyan-200",
      ring: "border-cyan-500 dark:border-cyan-400",
      swatch: "bg-cyan-500",
    },
  },
  sky: {
    hue: 199,
    tone: {
      ribbon: "bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200",
      solid: "bg-sky-700 text-white dark:bg-sky-500 dark:text-sky-950",
      dashed: "border-sky-500 text-sky-800 dark:border-sky-400 dark:text-sky-200",
      ring: "border-sky-500 dark:border-sky-400",
      swatch: "bg-sky-500",
    },
  },
  blue: {
    hue: 217,
    tone: {
      ribbon: "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200",
      solid: "bg-blue-600 text-white dark:bg-blue-400 dark:text-blue-950",
      dashed: "border-blue-500 text-blue-800 dark:border-blue-400 dark:text-blue-200",
      ring: "border-blue-500 dark:border-blue-400",
      swatch: "bg-blue-500",
    },
  },
  indigo: {
    hue: 239,
    tone: {
      ribbon: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200",
      solid: "bg-indigo-600 text-white dark:bg-indigo-400 dark:text-indigo-950",
      dashed: "border-indigo-500 text-indigo-800 dark:border-indigo-400 dark:text-indigo-200",
      ring: "border-indigo-500 dark:border-indigo-400",
      swatch: "bg-indigo-500",
    },
  },
  violet: {
    hue: 258,
    tone: {
      ribbon: "bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-200",
      solid: "bg-violet-600 text-white dark:bg-violet-400 dark:text-violet-950",
      dashed: "border-violet-500 text-violet-800 dark:border-violet-400 dark:text-violet-200",
      ring: "border-violet-500 dark:border-violet-400",
      swatch: "bg-violet-500",
    },
  },
  purple: {
    hue: 271,
    tone: {
      ribbon: "bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200",
      solid: "bg-purple-600 text-white dark:bg-purple-400 dark:text-purple-950",
      dashed: "border-purple-500 text-purple-800 dark:border-purple-400 dark:text-purple-200",
      ring: "border-purple-500 dark:border-purple-400",
      swatch: "bg-purple-500",
    },
  },
  fuchsia: {
    hue: 292,
    tone: {
      ribbon: "bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-800 dark:text-fuchsia-200",
      solid: "bg-fuchsia-600 text-white dark:bg-fuchsia-400 dark:text-fuchsia-950",
      dashed: "border-fuchsia-500 text-fuchsia-800 dark:border-fuchsia-400 dark:text-fuchsia-200",
      ring: "border-fuchsia-500 dark:border-fuchsia-400",
      swatch: "bg-fuchsia-500",
    },
  },
  pink: {
    hue: 330,
    tone: {
      ribbon: "bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-200",
      solid: "bg-pink-600 text-white dark:bg-pink-400 dark:text-pink-950",
      dashed: "border-pink-500 text-pink-800 dark:border-pink-400 dark:text-pink-200",
      ring: "border-pink-500 dark:border-pink-400",
      swatch: "bg-pink-500",
    },
  },
  rose: {
    hue: 350,
    tone: {
      ribbon: "bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200",
      solid: "bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950",
      dashed: "border-rose-500 text-rose-800 dark:border-rose-400 dark:text-rose-200",
      ring: "border-rose-500 dark:border-rose-400",
      swatch: "bg-rose-500",
    },
  },
}

STUDY_TONES.push(...(["teal", "violet", "sky", "rose"] as const).map((f) => STUDY_TONE_FAMILIES[f].tone))

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * A colour per study, as close to its logo as possible: the family nearest to the logo's dominant
 * hue that no other study took (studies with more saturated logos choose first). Studies without a
 * usable logo colour (none, grey) get the default tones in order.
 */
export function pickStudyTones(studies: { id: string; hsl?: [number, number, number] | null }[]): Map<string, StudyTone> {
  const out = new Map<string, StudyTone>()
  const taken = new Set<string>()
  const colourful = studies
    .filter((s) => s.hsl && s.hsl[1] >= 20 && s.hsl[2] >= 10 && s.hsl[2] <= 90)
    .sort((a, b) => b.hsl![1] - a.hsl![1])
  for (const s of colourful) {
    const [name] = Object.entries(STUDY_TONE_FAMILIES)
      .filter(([family]) => !taken.has(family))
      .sort(([, a], [, b]) => hueDistance(a.hue, s.hsl![0]) - hueDistance(b.hue, s.hsl![0]))[0] ?? []
    if (!name) continue
    taken.add(name)
    out.set(s.id, STUDY_TONE_FAMILIES[name].tone)
  }
  const defaults = STUDY_TONES.filter((tone) => !Object.entries(STUDY_TONE_FAMILIES).some(([f, v]) => taken.has(f) && v.tone.swatch === tone.swatch))
  let i = 0
  for (const s of studies) {
    if (out.has(s.id)) continue
    out.set(s.id, defaults[i % Math.max(1, defaults.length)] ?? STUDY_TONES[0])
    i++
  }
  return out
}

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
