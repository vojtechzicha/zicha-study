import type { Subject } from './status-utils'
import {
  COMPLETION_TYPES,
  ECTS_GPA_POINTS,
  GPA_EXCLUDED_GRADES,
  GPA_GRADE_ALIASES,
  getCompletionTypeShortCode,
} from './constants'

// Minimum subject fields needed for grade calculation
export type GradeCalculationSubject = Pick<Subject, 'completion_type' | 'credits' | 'points' | 'grade'> & {
  id?: string
  is_repeat?: boolean
  repeats_subject_id?: string | null
}

// Convert letter grade to numeric value
export function gradeToNumber(grade: string): number | null {
  if (!grade || grade === '-') return null
  
  // Handle F grades (Czech ECTS: nedostatečně = 4)
  if (grade === '0' || grade.startsWith('F')) return 4.0
  
  // Handle numeric grades with optional minus
  const numericMatch = grade.match(/^(\d)(-)?$/)
  if (numericMatch) {
    const baseGrade = parseInt(numericMatch[1])
    const hasMinus = numericMatch[2] === '-'
    return baseGrade + (hasMinus ? 0.5 : 0)
  }
  
  // Handle letter grades (Czech ECTS scale)
  const gradeMap: Record<string, number> = {
    'A': 1.0,   // výborně
    'B': 1.5,   // velmi dobře
    'C': 2.0,   // dobře
    'D': 2.5,   // uspokojivě
    'E': 3.0,   // dostatečně
  }
  
  return gradeMap[grade.toUpperCase()] || null
}

// Check if subject should be included in average calculation
export function shouldIncludeInAverage(subject: GradeCalculationSubject): boolean {
  // Skip subjects with "Zápočet" type (credit only)
  if (getCompletionTypeShortCode(subject.completion_type) === COMPLETION_TYPES.CREDIT) return false
  
  // Skip if no valuation (no points and no grade)
  if (!subject.points && !subject.grade) return false
  
  // Include if has points or valid grade
  return true
}

// Convert ECTS grade to US GPA points
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

function getGpaSubjectKey(subject: GradeCalculationSubject, index: number): string {
  if (subject.is_repeat && subject.repeats_subject_id) {
    return subject.repeats_subject_id
  }

  return subject.id || `subject-${index}`
}

function selectGpaAttempt(
  current: GradeCalculationSubject | undefined,
  next: GradeCalculationSubject
): GradeCalculationSubject {
  if (!current) return next

  if (next.is_repeat && next.repeats_subject_id) {
    return next
  }

  if (current.is_repeat && current.repeats_subject_id) {
    return current
  }

  return current
}

export type AverageType = 'grade' | 'points' | 'both' | 'none'

export interface AverageResult {
  type: AverageType
  value: number | null
  label: string
  pointsValue?: number | null
  gradeValue?: number | null
}

// Determine which type of average to calculate
export function getAverageType(subjects: GradeCalculationSubject[]): AverageType {
  const relevantSubjects = subjects.filter(shouldIncludeInAverage)
  if (relevantSubjects.length === 0) return 'none'
  
  // Check if any subject has points
  const hasPoints = relevantSubjects.some(s => s.points && s.points > 0)
  // Check if any subject has grades
  const hasGrades = relevantSubjects.some(s => s.grade && gradeToNumber(s.grade) !== null)
  
  // If both points and grades exist in the study, always show both averages
  if (hasPoints && hasGrades) {
    return 'both'
  }
  
  if (hasPoints) return 'points'
  if (hasGrades) return 'grade'
  
  return 'none'
}

// Calculate weighted average for grades
export function calculateWeightedGradeAverage(subjects: GradeCalculationSubject[], includeSubjectsWithPoints: boolean = false): number | null {
  const relevantSubjects = subjects.filter(shouldIncludeInAverage)
  if (relevantSubjects.length === 0) return null
  
  let totalWeightedGrade = 0
  let totalCredits = 0
  
  for (const subject of relevantSubjects) {
    // Skip subjects with points unless we're explicitly including them
    if (!includeSubjectsWithPoints && subject.points && subject.points > 0) continue
    
    const numericGrade = gradeToNumber(subject.grade || '')
    if (numericGrade === null) continue
    
    totalWeightedGrade += numericGrade * subject.credits
    totalCredits += subject.credits
  }
  
  if (totalCredits === 0) return null
  return totalWeightedGrade / totalCredits
}

// Calculate weighted average for points
export function calculateWeightedPointsAverage(subjects: GradeCalculationSubject[]): number | null {
  const relevantSubjects = subjects.filter(shouldIncludeInAverage)
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
  const gpaSubjects = new Map<string, GradeCalculationSubject>()

  subjects.forEach((subject, index) => {
    if (!shouldIncludeInGpa(subject)) return

    const key = getGpaSubjectKey(subject, index)
    gpaSubjects.set(key, selectGpaAttempt(gpaSubjects.get(key), subject))
  })

  if (gpaSubjects.size === 0) return null

  let totalWeightedGpa = 0
  let totalCredits = 0

  for (const subject of gpaSubjects.values()) {
    const gpaPoints = gradeToGpaPoints(subject.grade || '')
    if (gpaPoints === null) continue

    totalWeightedGpa += gpaPoints * subject.credits
    totalCredits += subject.credits
  }

  if (totalCredits === 0) return null
  return totalWeightedGpa / totalCredits
}

// Main function to calculate average with type detection
export function calculateAverage(subjects: GradeCalculationSubject[]): AverageResult {
  const avgType = getAverageType(subjects)
  
  switch (avgType) {
    case 'both':
      return {
        type: 'both',
        value: null, // Not used when both are present
        label: 'Vážené průměry',
        pointsValue: calculateWeightedPointsAverage(subjects),
        gradeValue: calculateWeightedGradeAverage(subjects, true) // Include subjects with points when calculating grades for 'both' mode
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
        label: 'Vážené hodnocení'
      }
    default:
      return {
        type: 'none',
        value: null,
        label: ''
      }
  }
}

// Filter subjects by semester
export function filterSubjectsBySemester(subjects: Subject[], semester: string): Subject[] {
  if (!semester || semester === 'all') return subjects
  return subjects.filter(s => s.semester === semester)
}

// Get unique semesters from subjects
export function getUniqueSemesters(subjects: Subject[]): string[] {
  const semesters = [...new Set(subjects.map(s => s.semester))]
  return semesters.sort((a, b) => {
    // Extract year and semester type for proper sorting
    const aMatch = a.match(/(\d+)\.\s*ročník\s*(ZS|LS)/i)
    const bMatch = b.match(/(\d+)\.\s*ročník\s*(ZS|LS)/i)
    
    if (aMatch && bMatch) {
      const aYear = parseInt(aMatch[1])
      const bYear = parseInt(bMatch[1])
      
      if (aYear !== bYear) return aYear - bYear
      
      // ZS comes before LS
      return aMatch[2] === 'ZS' ? -1 : 1
    }
    
    return a.localeCompare(b, 'cs')
  })
}
