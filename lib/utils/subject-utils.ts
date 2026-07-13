/**
 * Subject Utility Functions
 *
 * Centralized utilities for subject sorting and processing.
 */

import { getSubjectTypeConfig } from '@/lib/constants'

// Base subject interface that both component interfaces extend
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
 * Get subject status priority for sorting
 * Active subjects come first, then completed, then planned
 */
export function getSubjectStatusPriority(subject: BaseSubject): number {
  if (subject.planned) return 3  // Planned
  if (subject.completed) return 2  // Completed
  return 1  // Active
}

/**
 * Get semester order for sorting
 * Parses semester strings like "1. ročník ZS" and returns a numeric order
 * ZS (winter semester) comes before LS (summer semester) in the same year
 */
export function getSemesterOrder(semester: string): number {
  const match = semester.match(/(\d+)\.\s*ročník\s*(ZS|LS)/i)
  if (match) {
    const year = Number.parseInt(match[1])
    const semesterType = match[2].toUpperCase()
    // ZS (winter) comes before LS (summer) in the same year
    return year * 10 + (semesterType === "ZS" ? 1 : 2)
  }
  // Fallback for non-standard semester names
  return 999
}

/**
 * Get short semester notation
 * Converts "1. ročník ZS" to "1/ZS", "2. ročník LS" to "2/LS", etc.
 */
export function getSemesterShort(semester: string): string {
  const match = semester.match(/(\d+)\.\s*ročník\s*(ZS|LS)/i)
  if (match) {
    return `${match[1]}/${match[2]}`
  }
  return semester
}

/**
 * Sort subjects by status, semester, type, and name
 *
 * Sort order:
 * 1. Status priority (Active > Completed > Planned)
 * 2. Semester (with proper ZS/LS ordering)
 * 3. Subject type (based on type config order)
 * 4. Alphabetically by name
 */
export function sortSubjects<T extends BaseSubject>(subjects: T[]): T[] {
  return [...subjects].sort((a, b) => {
    // First sort by status priority (Active > Completed > Planned)
    const aStatusPriority = getSubjectStatusPriority(a)
    const bStatusPriority = getSubjectStatusPriority(b)
    if (aStatusPriority !== bStatusPriority) {
      return aStatusPriority - bStatusPriority
    }

    // Then sort by semester with proper ZS/LS ordering
    const aSemesterOrder = getSemesterOrder(a.semester)
    const bSemesterOrder = getSemesterOrder(b.semester)
    if (aSemesterOrder !== bSemesterOrder) {
      return aSemesterOrder - bSemesterOrder
    }

    // Then sort by subject type
    const aTypeOrder = getSubjectTypeConfig(a.subject_type).order
    const bTypeOrder = getSubjectTypeConfig(b.subject_type).order
    if (aTypeOrder !== bTypeOrder) {
      return aTypeOrder - bTypeOrder
    }

    // Finally sort alphabetically by name
    return a.name.localeCompare(b.name, "cs")
  })
}

/**
 * Group subjects by semester
 */
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

/**
 * Get unique semesters from subjects, sorted in order
 */
export function getUniqueSemestersSorted(subjects: BaseSubject[]): string[] {
  const semesters = new Set(subjects.map(s => s.semester))
  return Array.from(semesters).sort((a, b) => getSemesterOrder(a) - getSemesterOrder(b))
}

export interface SemesterGroup<T extends BaseSubject> {
  semester: string
  subjects: T[]
}

/**
 * Get the status priority of a whole semester group:
 * the best (lowest) priority among its subjects, so a semester with
 * any active subject sorts as active, one with only completed subjects
 * as completed, and one with only planned subjects as planned.
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
 * Get the display label for a semester heading
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
