/**
 * Statistics Utility Functions
 *
 * Centralized utilities for calculating study statistics.
 */

import { calculateAverage, type AverageResult } from '@/lib/grade-utils'
import { isSubjectFailed } from '@/lib/status-utils'

// Subject interface for statistics calculation
export interface StatisticsSubject {
  id: string
  semester: string
  abbreviation: string
  completion_type: string
  credits: number
  hours?: number
  points?: number
  grade?: string
  completed: boolean
  exam_completed: boolean
  credit_completed: boolean
  planned?: boolean
  is_repeat?: boolean
}

// Comprehensive study statistics
export interface StudyStatistics {
  // Subject counts
  total: number
  completed: number
  creditsCompleted: number
  examsCompleted: number
  remainingCredits: number
  remainingExams: number

  // Credit/Hour totals
  totalCredits: number
  completedCredits: number
  totalHours: number
  completedHours: number

  // Rates
  completionRate: number
  creditCompletionRate: number
  examCompletionRate: number

  // Counts for rate calculation
  totalSubjectsWithCredits: number
  totalSubjectsWithExams: number

  // Average
  average: AverageResult
}

/**
 * Calculate comprehensive study statistics
 */
export function calculateStudyStatistics(subjects: StatisticsSubject[]): StudyStatistics {
  const total = subjects.length
  const completed = subjects.filter((s) => s.completed && !s.planned).length
  const creditsCompleted = subjects.filter((s) => s.credit_completed && !s.planned).length

  // Get unique exam subjects (by abbreviation) to avoid counting repeats
  const uniqueExamSubjects = subjects
    .filter((s) => s.completion_type.includes("Zk"))
    .reduce((acc, subject) => {
      if (!acc.some(s => s.abbreviation === subject.abbreviation)) {
        acc.push(subject)
      }
      return acc
    }, [] as StatisticsSubject[])

  // Count unique subjects that have been successfully completed
  const uniqueExamsCompleted = uniqueExamSubjects.filter(examSubject => {
    const allInstances = subjects.filter(
      s => s.abbreviation === examSubject.abbreviation && s.completion_type.includes("Zk")
    )
    return allInstances.some(s => s.exam_completed && !s.planned && s.grade !== 'FN')
  }).length

  const examsCompleted = uniqueExamsCompleted

  // Credit and hour calculations
  const totalCredits = subjects
    .filter(s => !s.is_repeat)
    .reduce((sum, s) => sum + s.credits, 0)

  const completedCredits = subjects
    .filter((s) => s.completed && !isSubjectFailed(s))
    .reduce((sum, s) => sum + s.credits, 0)

  const totalHours = subjects.reduce((sum, s) => sum + (s.hours || 0), 0)
  const completedHours = subjects
    .filter((s) => s.completed)
    .reduce((sum, s) => sum + (s.hours || 0), 0)

  // Calculate weighted average
  const completedSubjects = subjects.filter(s => s.completed && !isSubjectFailed(s))
  const average = calculateAverage(completedSubjects)

  // Count subjects with credits/exams
  const subjectsWithCredits = subjects.filter(
    (s) => s.completion_type.includes("Zp") || s.completion_type.includes("KZp")
  )
  const subjectsWithExams = uniqueExamSubjects

  // Remaining counts
  const remainingCredits = subjects.filter(
    (s) => (!s.credit_completed || s.planned) &&
           (s.completion_type.includes("Zp") || s.completion_type.includes("KZp"))
  ).length

  const remainingExams = subjects.filter(
    (s) => (!s.exam_completed || s.planned) && s.completion_type.includes("Zk")
  ).length

  return {
    total,
    completed,
    creditsCompleted,
    examsCompleted,
    remainingCredits,
    remainingExams,
    totalCredits,
    completedCredits,
    totalHours,
    completedHours,
    average,
    completionRate: total > 0 ? (completed / total) * 100 : 0,
    creditCompletionRate: subjectsWithCredits.length > 0
      ? (creditsCompleted / subjectsWithCredits.length) * 100
      : 0,
    examCompletionRate: subjectsWithExams.length > 0
      ? (examsCompleted / subjectsWithExams.length) * 100
      : 0,
    totalSubjectsWithCredits: subjectsWithCredits.length,
    totalSubjectsWithExams: subjectsWithExams.length,
  }
}

// Simple statistics for study detail view
export interface SimpleStudyStatistics {
  total: number
  completed: number
  totalCredits: number
  completedCredits: number
  average: AverageResult
}

/**
 * Calculate simple study statistics (for study detail view)
 */
export function calculateSimpleStatistics(subjects: StatisticsSubject[]): SimpleStudyStatistics {
  const completedSubjects = subjects.filter((s) => s.completed && !isSubjectFailed(s))
  const average = calculateAverage(completedSubjects)

  return {
    total: subjects.length,
    completed: subjects.filter((s) => s.completed).length,
    totalCredits: subjects
      .filter(s => !s.is_repeat)
      .reduce((sum, s) => sum + s.credits, 0),
    completedCredits: completedSubjects.reduce((sum, s) => sum + s.credits, 0),
    average
  }
}

// Semester statistics
export interface SemesterStatistics {
  total: number
  completed: number
  credits: number
  completedCredits: number
  completionRate: number
  average: AverageResult
}

/**
 * Calculate statistics for a specific semester
 */
export function calculateSemesterStatistics(subjects: StatisticsSubject[]): SemesterStatistics {
  const total = subjects.length
  const completed = subjects.filter((s) => s.completed).length
  const credits = subjects
    .filter(s => !s.is_repeat)
    .reduce((sum, s) => sum + s.credits, 0)
  const completedCredits = subjects
    .filter((s) => s.completed && !isSubjectFailed(s))
    .reduce((sum, s) => sum + s.credits, 0)

  const completedSemesterSubjects = subjects.filter(s => s.completed && !isSubjectFailed(s))
  const average = calculateAverage(completedSemesterSubjects)

  return {
    total,
    completed,
    credits,
    completedCredits,
    completionRate: total > 0 ? (completed / total) * 100 : 0,
    average,
  }
}

/**
 * Calculate statistics grouped by semester
 */
export function calculateStatisticsBySemester(
  subjects: StatisticsSubject[]
): Record<string, SemesterStatistics> {
  const grouped: Record<string, StatisticsSubject[]> = {}

  for (const subject of subjects) {
    if (!grouped[subject.semester]) {
      grouped[subject.semester] = []
    }
    grouped[subject.semester].push(subject)
  }

  const result: Record<string, SemesterStatistics> = {}
  for (const [semester, semesterSubjects] of Object.entries(grouped)) {
    result[semester] = calculateSemesterStatistics(semesterSubjects)
  }

  return result
}
