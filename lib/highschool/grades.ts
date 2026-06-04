/**
 * Czech high-school grading.
 *
 * High-school ("Střední škola") studies differ from university studies in two
 * essential ways that this module captures:
 *
 *  1. A subject spans the whole study and carries a grade per **pololetí**
 *     (half-year). Grades therefore live as an array on a single subject, not
 *     as one-subject-per-semester rows.
 *  2. The grading scale is 1–5 where **5 = nedostatečný (fail)** — unlike the
 *     university scale where 4 is the failing grade. The study average is a
 *     plain (unweighted) arithmetic mean, since high schools have no credits.
 *
 * University grading logic in `lib/grade-utils.ts` is intentionally left
 * untouched; the two scales never share code.
 */

export interface HighSchoolGrade {
  /** ročník, 1-based */
  year: number
  /** pololetí */
  half: 1 | 2
  /** "1".."5" */
  grade: string
}

export interface HighSchoolSubjectLike {
  id?: string
  name: string
  abbreviation?: string | null
  lecturer?: string | null
  grades?: HighSchoolGrade[] | null
}

export const HS_GRADE_VALUES = ['1', '2', '3', '4', '5'] as const
export type HighSchoolGradeValue = (typeof HS_GRADE_VALUES)[number]

export const HS_GRADE_LABELS: Record<HighSchoolGradeValue, string> = {
  '1': 'výborný',
  '2': 'chvalitebný',
  '3': 'dobrý',
  '4': 'dostatečný',
  '5': 'nedostatečný',
}

/** The failing grade on the Czech 1–5 scale. */
export const HS_FAIL_GRADE = 5

export function isHighSchoolGradeFailing(grade: string | null | undefined): boolean {
  return grade === String(HS_FAIL_GRADE)
}

export function hsGradeToNumber(grade: string | null | undefined): number | null {
  if (!grade) return null
  const n = Number.parseInt(grade, 10)
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null
}

export function hsGradeLabel(grade: string | null | undefined): string {
  if (grade && grade in HS_GRADE_LABELS) return HS_GRADE_LABELS[grade as HighSchoolGradeValue]
  return ''
}

/** Solid badge styling for a grade (deep green for 1 … red for the fail grade). */
export function highSchoolGradeStyle(
  grade: string | null | undefined,
): { color: string; backgroundColor: string; borderColor: string } | null {
  switch (grade) {
    case '1':
      return { color: 'white', backgroundColor: 'rgb(5, 150, 105)', borderColor: 'rgb(4, 120, 87)' }
    case '2':
      return { color: 'white', backgroundColor: 'rgb(101, 163, 13)', borderColor: 'rgb(77, 124, 15)' }
    case '3':
      return { color: 'white', backgroundColor: 'rgb(202, 138, 4)', borderColor: 'rgb(161, 98, 7)' }
    case '4':
      return { color: 'white', backgroundColor: 'rgb(234, 88, 12)', borderColor: 'rgb(194, 65, 12)' }
    case '5':
      return { color: 'white', backgroundColor: 'rgb(220, 38, 38)', borderColor: 'rgb(185, 28, 28)' }
    default:
      return null
  }
}

export interface HighSchoolPeriod {
  year: number
  half: 1 | 2
  /** `${year}-${half}` */
  key: string
  /** e.g. "1. ročník 1. pol." */
  label: string
  /** e.g. "1/1" */
  shortLabel: string
}

export function periodKey(year: number, half: 1 | 2): string {
  return `${year}-${half}`
}

/**
 * Derive the ordered list of pololetí columns from the study's year span.
 * A study running start_year→end_year covers (end_year - start_year) ročníky
 * (defaulting to 4 when the end year is unknown). The range grows to include
 * any pololetí that already has a recorded grade.
 */
export function derivePeriods(
  study: { start_year: number; end_year?: number | null },
  subjects: HighSchoolSubjectLike[] = [],
): HighSchoolPeriod[] {
  const spanYears =
    study.end_year && study.end_year > study.start_year ? study.end_year - study.start_year : 4

  const maxRecordedYear = subjects.reduce((max, s) => {
    for (const g of s.grades ?? []) if (g.year > max) max = g.year
    return max
  }, 0)

  const years = Math.max(spanYears, maxRecordedYear, 1)

  const periods: HighSchoolPeriod[] = []
  for (let year = 1; year <= years; year++) {
    for (const half of [1, 2] as const) {
      periods.push({
        year,
        half,
        key: periodKey(year, half),
        label: `${year}. ročník ${half}. pol.`,
        shortLabel: `${year}/${half}`,
      })
    }
  }
  return periods
}

export function getGrade(
  subject: HighSchoolSubjectLike,
  year: number,
  half: 1 | 2,
): string | null {
  return subject.grades?.find((g) => g.year === year && g.half === half)?.grade ?? null
}

/** Upsert a grade into a grades array; an empty string clears that cell. */
export function setGrade(
  grades: HighSchoolGrade[],
  year: number,
  half: 1 | 2,
  grade: string,
): HighSchoolGrade[] {
  const next = grades.filter((g) => !(g.year === year && g.half === half))
  if (grade) next.push({ year, half, grade })
  return next.sort((a, b) => a.year - b.year || a.half - b.half)
}

function meanOfGrades(grades: (string | null | undefined)[]): number | null {
  const nums = grades.map(hsGradeToNumber).filter((n): n is number => n !== null)
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** Unweighted mean of all of a subject's recorded grades. */
export function subjectAverage(subject: HighSchoolSubjectLike): number | null {
  return meanOfGrades((subject.grades ?? []).map((g) => g.grade))
}

/** Unweighted mean across subjects for one pololetí. */
export function periodAverage(
  subjects: HighSchoolSubjectLike[],
  year: number,
  half: 1 | 2,
): number | null {
  return meanOfGrades(subjects.map((s) => getGrade(s, year, half)))
}

/** Unweighted mean across every recorded grade in the study. */
export function overallAverage(subjects: HighSchoolSubjectLike[]): number | null {
  const all: (string | null)[] = []
  for (const s of subjects) for (const g of s.grades ?? []) all.push(g.grade)
  return meanOfGrades(all)
}

/** Count of subjects that have at least one recorded grade. */
export function gradedSubjectCount(subjects: HighSchoolSubjectLike[]): number {
  return subjects.filter((s) => (s.grades ?? []).length > 0).length
}
