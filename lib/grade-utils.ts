import type { Subject } from './status-utils'

// Convert letter grade to numeric value
export function gradeToNumber(grade: string): number | null {
  if (!grade || grade === '-') return null
  
  // Handle F grades
  if (grade === '0' || grade.startsWith('F')) return 5.0
  
  // Handle numeric grades with optional minus
  const numericMatch = grade.match(/^(\d)(-)?$/)
  if (numericMatch) {
    const baseGrade = parseInt(numericMatch[1])
    const hasMinus = numericMatch[2] === '-'
    return baseGrade + (hasMinus ? 0.5 : 0)
  }
  
  // Handle letter grades
  const gradeMap: Record<string, number> = {
    'A': 1.0,
    'A-': 1.5,
    'B': 2.0,
    'B-': 2.5,
    'C': 3.0,
    'C-': 3.5,
    'D': 4.0,
    'D-': 4.5,
    'E': 5.0,
    'E-': 5.0,
  }
  
  return gradeMap[grade.toUpperCase()] || null
}

// Check if subject should be included in average calculation
export function shouldIncludeInAverage(subject: Subject): boolean {
  // Skip subjects with "Zápočet" type (credit only)
  if (subject.completion_type === 'Zápočet (Zp)') return false
  
  // Skip if no valuation (no points and no grade)
  if (!subject.points && !subject.grade) return false
  
  // Include if has points or valid grade
  return true
}

export type AverageType = 'grade' | 'points' | 'both' | 'none'

// Determine which type of average to calculate
export function getAverageType(subjects: Subject[]): AverageType {
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
export function calculateWeightedGradeAverage(subjects: Subject[], includeSubjectsWithPoints: boolean = false): number | null {
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
export function calculateWeightedPointsAverage(subjects: Subject[]): number | null {
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

// Main function to calculate average with type detection
export function calculateAverage(subjects: Subject[]): { 
  type: 'grade' | 'points' | 'both' | 'none'
  value: number | null
  label: string
  pointsValue?: number | null
  gradeValue?: number | null
} {
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