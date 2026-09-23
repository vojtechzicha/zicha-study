import { getSubjectTypeConfig } from '@/lib/constants'

// Minimal shape the helpers below need; component subject types extend it
export interface BaseSubject {
  id: string
  study_id: string
  semester: string
  name: string
  subject_type: string
  completed: boolean
  planned?: boolean
}

/**
 * Sort priority: active (1), completed (2), planned (3).
 */
export function getSubjectStatusPriority(subject: BaseSubject): number {
  if (subject.planned) return 3
  if (subject.completed) return 2
  return 1
}

/**
 * Numeric sort key for semester strings like "1. ročník ZS": ZS (winter)
 * comes before LS (summer) within a year; non-standard names sort last.
 */
export function getSemesterOrder(semester: string): number {
  const match = semester.match(/(\d+)\.\s*ročník\s*(ZS|LS)/i)
  if (match) {
    const year = Number.parseInt(match[1])
    const semesterType = match[2].toUpperCase()
    return year * 10 + (semesterType === "ZS" ? 1 : 2)
  }
  return 999
}

/**
 * Converts "1. ročník ZS" to "1/ZS"; non-standard names pass through.
 */
export function getSemesterShort(semester: string): string {
  const match = semester.match(/(\d+)\.\s*ročník\s*(ZS|LS)/i)
  if (match) {
    return `${match[1]}/${match[2]}`
  }
  return semester
}

/**
 * Sort order: status (active, completed, planned), semester (ZS before LS),
 * subject type (type config order), then name (Czech collation).
 */
export function sortSubjects<T extends BaseSubject>(subjects: T[]): T[] {
  return [...subjects].sort((a, b) => {
    const aStatusPriority = getSubjectStatusPriority(a)
    const bStatusPriority = getSubjectStatusPriority(b)
    if (aStatusPriority !== bStatusPriority) {
      return aStatusPriority - bStatusPriority
    }

    const aSemesterOrder = getSemesterOrder(a.semester)
    const bSemesterOrder = getSemesterOrder(b.semester)
    if (aSemesterOrder !== bSemesterOrder) {
      return aSemesterOrder - bSemesterOrder
    }

    const aTypeOrder = getSubjectTypeConfig(a.subject_type).order
    const bTypeOrder = getSubjectTypeConfig(b.subject_type).order
    if (aTypeOrder !== bTypeOrder) {
      return aTypeOrder - bTypeOrder
    }

    return a.name.localeCompare(b.name, "cs")
  })
}

export function groupSubjectsBySemester<T extends BaseSubject>(subjects: T[]): Record<string, T[]> {
  const grouped: Record<string, T[]> = {}

  for (const subject of subjects) {
    if (!grouped[subject.semester]) {
      grouped[subject.semester] = []
    }
    grouped[subject.semester].push(subject)
  }

  return grouped
}

export function getUniqueSemestersSorted(subjects: BaseSubject[]): string[] {
  const semesters = new Set(subjects.map(s => s.semester))
  return Array.from(semesters).sort((a, b) => getSemesterOrder(a) - getSemesterOrder(b))
}

export interface SemesterGroup<T extends BaseSubject> {
  semester: string
  subjects: T[]
}

/**
 * The best (lowest) priority among the group's subjects: a semester with any
 * active subject sorts as active, one with only planned subjects as planned.
 */
export function getSemesterGroupStatusPriority(subjects: BaseSubject[]): number {
  return Math.min(...subjects.map(getSubjectStatusPriority))
}

/**
 * Group subjects by semester for a single-list display with semester headings.
 *
 * Each semester appears exactly once. Groups are ordered by the group's
 * status priority (semesters with active subjects first, then completed,
 * then planned) and chronologically within the same priority. Subjects
 * inside a group follow the standard sort order.
 */
export function groupSubjectsForDisplay<T extends BaseSubject>(subjects: T[]): SemesterGroup<T>[] {
  const grouped = groupSubjectsBySemester(subjects)
  return Object.entries(grouped)
    .map(([semester, semesterSubjects]) => ({ semester, subjects: sortSubjects(semesterSubjects) }))
    .sort((a, b) => {
      const aPriority = getSemesterGroupStatusPriority(a.subjects)
      const bPriority = getSemesterGroupStatusPriority(b.subjects)
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      return getSemesterOrder(a.semester) - getSemesterOrder(b.semester)
    })
}

/**
 * Converts "1. ročník ZS" to "1. ročník · zimní semestr"; non-standard names pass through.
 */
export function getSemesterHeadingLabel(semester: string): string {
  const match = semester.match(/(\d+)\.\s*ročník\s*(ZS|LS)/i)
  if (match) {
    const semesterName = match[2].toUpperCase() === "ZS" ? "zimní semestr" : "letní semestr"
    return `${match[1]}. ročník · ${semesterName}`
  }
  return semester
}
