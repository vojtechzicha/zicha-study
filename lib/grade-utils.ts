import type { Subject } from './status-utils'
import {
  COMPLETION_TYPES,
  ECTS_GPA_POINTS,
  GPA_EXCLUDED_GRADES,
  GPA_GRADE_ALIASES,
  getCompletionTypeShortCode,
} from './constants'

export type GradeCalculationSubject = Pick<Subject, 'completion_type' | 'credits' | 'points' | 'grade'> & {
  id?: string
  is_repeat?: boolean
  repeats_subject_id?: string | null
}

// Maps a grade to the Czech 1–4 scale. Accepts numeric grades with an optional minus
// ('2-' = 2.5) and ECTS letters; F/FX and '0' count as nedostatečně (4).
export function gradeToNumber(grade: string): number | null {
  if (!grade || grade === '-') return null
  
  if (grade === '0' || grade.startsWith('F')) return 4.0
  
  const numericMatch = grade.match(/^(\d)(-)?$/)
  if (numericMatch) {
    const baseGrade = parseInt(numericMatch[1])
    const hasMinus = numericMatch[2] === '-'
    return baseGrade + (hasMinus ? 0.5 : 0)
  }
  
  const gradeMap: Record<string, number> = {
    'A': 1.0,   // výborně
    'B': 1.5,   // velmi dobře
    'C': 2.0,   // dobře
    'D': 2.5,   // uspokojivě
    'E': 3.0,   // dostatečně
  }
  
  return gradeMap[grade.toUpperCase()] || null
}

export function shouldIncludeInAverage(subject: GradeCalculationSubject): boolean {
  // Zápočet (Zp) is pass/fail credit only, never graded
  if (getCompletionTypeShortCode(subject.completion_type) === COMPLETION_TYPES.CREDIT) return false
  
  if (!subject.points && !subject.grade) return false
  
  return true
}

// ECTS grade → US GPA points. Czech numeric grades go through GPA_GRADE_ALIASES;
// pass/fail and withdrawn grades (GPA_EXCLUDED_GRADES) return null.
export function gradeToGpaPoints(grade: string): number | null {
  const normalizedGrade = grade.trim().toUpperCase()
  if (!normalizedGrade) return null

  if ((GPA_EXCLUDED_GRADES as readonly string[]).includes(normalizedGrade)) {
    return null
  }

  const alias = GPA_GRADE_ALIASES[normalizedGrade as keyof typeof GPA_GRADE_ALIASES]
  const gpaGrade = alias || (normalizedGrade.startsWith('F') ? 'F' : normalizedGrade)

  if (gpaGrade in ECTS_GPA_POINTS) {
    return ECTS_GPA_POINTS[gpaGrade as keyof typeof ECTS_GPA_POINTS]
  }

  return null
}

export function shouldIncludeInGpa(subject: GradeCalculationSubject): boolean {
  if (subject.credits <= 0) return false
  if (getCompletionTypeShortCode(subject.completion_type) === COMPLETION_TYPES.CREDIT) return false

  return gradeToGpaPoints(subject.grade || '') !== null
}

// Drops subjects superseded by a repeat (another subject's repeats_subject_id).
// Mirrors getCurrentSubjects in lib/utils/statistics-utils.ts; keep them consistent.
function getCurrentGradeSubjects(subjects: GradeCalculationSubject[]): GradeCalculationSubject[] {
  const supersededIds = new Set(
    subjects
      .map(s => s.repeats_subject_id)
      .filter((id): id is string => Boolean(id))
  )
  return subjects.filter(s => !s.id || !supersededIds.has(s.id))
}

export type AverageType = 'grade' | 'points' | 'both' | 'none'

export interface AverageResult {
  type: AverageType
  value: number | null
  label: string
  pointsValue?: number | null
  gradeValue?: number | null
}

export function getAverageType(subjects: GradeCalculationSubject[]): AverageType {
  const relevantSubjects = getCurrentGradeSubjects(subjects).filter(shouldIncludeInAverage)
  if (relevantSubjects.length === 0) return 'none'
  
  const hasPoints = relevantSubjects.some(s => s.points && s.points > 0)
  const hasGrades = relevantSubjects.some(s => s.grade && gradeToNumber(s.grade) !== null)
  
  // If both points and grades exist in the study, always show both averages
  if (hasPoints && hasGrades) {
    return 'both'
  }
  
  if (hasPoints) return 'points'
  if (hasGrades) return 'grade'
  
  return 'none'
}

// Credit-weighted grade average. Subjects scored in points are skipped unless
// includeSubjectsWithPoints is set.
export function calculateWeightedGradeAverage(subjects: GradeCalculationSubject[], includeSubjectsWithPoints: boolean = false): number | null {
  const relevantSubjects = getCurrentGradeSubjects(subjects).filter(shouldIncludeInAverage)
  if (relevantSubjects.length === 0) return null

  let totalWeightedGrade = 0
  let totalCredits = 0

  for (const subject of relevantSubjects) {
    if (!includeSubjectsWithPoints && subject.points && subject.points > 0) continue

    const numericGrade = gradeToNumber(subject.grade || '')
    if (numericGrade === null) continue

    totalWeightedGrade += numericGrade * subject.credits
    totalCredits += subject.credits
  }

  if (totalCredits === 0) return null
  return totalWeightedGrade / totalCredits
}

// Credit-weighted points average
export function calculateWeightedPointsAverage(subjects: GradeCalculationSubject[]): number | null {
  const relevantSubjects = getCurrentGradeSubjects(subjects).filter(shouldIncludeInAverage)
  if (relevantSubjects.length === 0) return null

  let totalWeightedPoints = 0
  let totalCredits = 0

  for (const subject of relevantSubjects) {
    if (!subject.points || subject.points === 0) continue

    totalWeightedPoints += subject.points * subject.credits
    totalCredits += subject.credits
  }

  if (totalCredits === 0) return null
  return totalWeightedPoints / totalCredits
}

// Calculate credit-weighted GPA from ECTS grades
export function calculateGpa(subjects: GradeCalculationSubject[]): number | null {
  const gpaSubjects = getCurrentGradeSubjects(subjects).filter(shouldIncludeInGpa)
  if (gpaSubjects.length === 0) return null

  let totalWeightedGpa = 0
  let totalCredits = 0

  for (const subject of gpaSubjects) {
    const gpaPoints = gradeToGpaPoints(subject.grade || '')
    if (gpaPoints === null) continue

    totalWeightedGpa += gpaPoints * subject.credits
    totalCredits += subject.credits
  }

  if (totalCredits === 0) return null
  return totalWeightedGpa / totalCredits
}

export function calculateAverage(subjects: GradeCalculationSubject[]): AverageResult {
  const avgType = getAverageType(subjects)
  
  switch (avgType) {
    case 'both':
      return {
        type: 'both',
        value: null, // unused for 'both'; see pointsValue / gradeValue
        label: 'Vážený průměr',
        pointsValue: calculateWeightedPointsAverage(subjects),
        gradeValue: calculateWeightedGradeAverage(subjects, true) // subjects with points still count if they also have a grade
      }
    case 'points':
      return {
        type: 'points',
        value: calculateWeightedPointsAverage(subjects),
        label: 'Vážený průměr bodů'
      }
    case 'grade':
      return {
        type: 'grade',
        value: calculateWeightedGradeAverage(subjects),
        label: 'Vážený průměr známek'
      }
    default:
      return {
        type: 'none',
        value: null,
        label: ''
      }
  }
}

export function filterSubjectsBySemester(subjects: Subject[], semester: string): Subject[] {
  if (!semester || semester === 'all') return subjects
  return subjects.filter(s => s.semester === semester)
}

// Sorted "N. ročník ZS/LS": by year, then ZS (winter) before LS (summer); others by Czech collation
export function getUniqueSemesters(subjects: Subject[]): string[] {
  const semesters = [...new Set(subjects.map(s => s.semester))]
  return semesters.sort((a, b) => {
    const aMatch = a.match(/(\d+)\.\s*ročník\s*(ZS|LS)/i)
    const bMatch = b.match(/(\d+)\.\s*ročník\s*(ZS|LS)/i)
    
    if (aMatch && bMatch) {
      const aYear = parseInt(aMatch[1])
      const bYear = parseInt(bMatch[1])
      
      if (aYear !== bYear) return aYear - bYear
      
      return aMatch[2] === 'ZS' ? -1 : 1
    }
    
    return a.localeCompare(b, 'cs')
  })
}
