/**
 * Statistics Utility Functions
 *
 * Centralized utilities for calculating study statistics.
 */

import { calculateAverage, calculateGpa, type AverageResult } from '@/lib/grade-utils'
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
  repeats_subject_id?: string | null
}

// A subject is "current" iff no other subject points at it via repeats_subject_id.
// Superseded subjects (originals that have been repeated) are excluded from statistics.
export function getCurrentSubjects<T extends { id: string; repeats_subject_id?: string | null }>(subjects: T[]): T[] {
  const supersededIds = new Set(
    subjects
      .map(s => s.repeats_subject_id)
      .filter((id): id is string => Boolean(id))
  )
  return subjects.filter(s => !supersededIds.has(s.id))
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
  gpa: number | null
}

/**
 * Calculate comprehensive study statistics
 */
export function calculateStudyStatistics(subjects: StatisticsSubject[]): StudyStatistics {
  const current = getCurrentSubjects(subjects)

  const total = current.length
  const completed = current.filter((s) => s.completed && !s.planned && !isSubjectFailed(s)).length

  const examSubjects = current.filter((s) => s.completion_type.includes("Zk"))
  const examsCompleted = examSubjects.filter(
    (s) => s.exam_completed && !s.planned && !isSubjectFailed(s)
  ).length
  const remainingExams = examSubjects.length - examsCompleted

  const creditSubjects = current.filter(
    (s) => s.completion_type.includes("Zp") || s.completion_type.includes("KZp")
  )
  const creditsCompleted = creditSubjects.filter(
    (s) => s.credit_completed && !s.planned && !isSubjectFailed(s)
  ).length
  const remainingCredits = creditSubjects.length - creditsCompleted

  const totalCredits = current.reduce((sum, s) => sum + s.credits, 0)
  const completedCredits = current
    .filter((s) => s.completed && !isSubjectFailed(s))
    .reduce((sum, s) => sum + s.credits, 0)

  const totalHours = current.reduce((sum, s) => sum + (s.hours || 0), 0)
  const completedHours = current
    .filter((s) => s.completed && !isSubjectFailed(s))
    .reduce((sum, s) => sum + (s.hours || 0), 0)

  const passingSubjects = current.filter((s) => s.completed && !isSubjectFailed(s))
  const average = calculateAverage(passingSubjects)
  const gpa = calculateGpa(current.filter((s) => s.completed && !s.planned))

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
    gpa,
    completionRate: total > 0 ? (completed / total) * 100 : 0,
    creditCompletionRate: creditSubjects.length > 0
      ? (creditsCompleted / creditSubjects.length) * 100
      : 0,
    examCompletionRate: examSubjects.length > 0
      ? (examsCompleted / examSubjects.length) * 100
      : 0,
    totalSubjectsWithCredits: creditSubjects.length,
    totalSubjectsWithExams: examSubjects.length,
  }
}

// Simple statistics for study detail view
export interface SimpleStudyStatistics {
  total: number
  completed: number
  totalCredits: number
  completedCredits: number
  average: AverageResult
  gpa: number | null
}

/**
 * Calculate simple study statistics (for study detail view)
 */
export function calculateSimpleStatistics(subjects: StatisticsSubject[]): SimpleStudyStatistics {
  const current = getCurrentSubjects(subjects)
  const passingSubjects = current.filter((s) => s.completed && !isSubjectFailed(s))
  const average = calculateAverage(passingSubjects)
  const gpa = calculateGpa(current.filter(s => s.completed && !s.planned))

  return {
    total: current.length,
    completed: passingSubjects.length,
    totalCredits: current.reduce((sum, s) => sum + s.credits, 0),
    completedCredits: passingSubjects.reduce((sum, s) => sum + s.credits, 0),
    average,
    gpa
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
  gpa: number | null
}

/**
 * Calculate statistics for a specific semester.
 * Pass the FULL subject list so the current-set filter sees the cross-semester chains;
 * the per-semester filter happens after that.
 */
export function calculateSemesterStatistics(
  subjects: StatisticsSubject[],
  semester?: string,
): SemesterStatistics {
  const currentAll = getCurrentSubjects(subjects)
  const current = semester ? currentAll.filter(s => s.semester === semester) : currentAll

  const total = current.length
  const passing = current.filter((s) => s.completed && !isSubjectFailed(s))
  const completed = passing.length
  const credits = current.reduce((sum, s) => sum + s.credits, 0)
  const completedCredits = passing.reduce((sum, s) => sum + s.credits, 0)

  const average = calculateAverage(passing)
  const gpa = calculateGpa(current.filter(s => s.completed && !s.planned))

  return {
    total,
    completed,
    credits,
    completedCredits,
    completionRate: total > 0 ? (completed / total) * 100 : 0,
    average,
    gpa,
  }
}

/**
 * Calculate statistics grouped by semester
 */
export function calculateStatisticsBySemester(
  subjects: StatisticsSubject[]
): Record<string, SemesterStatistics> {
  const current = getCurrentSubjects(subjects)
  const semesters = [...new Set(current.map(s => s.semester))]

  const result: Record<string, SemesterStatistics> = {}
  for (const semester of semesters) {
    result[semester] = calculateSemesterStatistics(subjects, semester)
  }

  return result
}
