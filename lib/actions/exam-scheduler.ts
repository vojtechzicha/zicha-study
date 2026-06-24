"use server"

import * as db from "@/lib/mongodb/db"
import { EXAM_SCHEDULER_DEFAULTS } from "@/lib/constants"

// ─── Global scheduling data ──────────────────────────────────────────────────

export async function fetchGlobalExamSchedulingData() {
  const { studies, periods, terms, subjects } = await db.getGlobalExamSchedulingData()
  return {
    studies: db.normalizeIds(studies as any[]),
    periods: db.normalizeIds(periods as any[]),
    terms: db.normalizeIds(terms as any[]),
    subjects: db.normalizeIds(subjects as any[]),
  }
}

// Periods + terms for a single study (read-only summary on the study detail).
export async function fetchStudyExamPeriods(studyId: string) {
  await db.migrateExamOptionsToPeriods()
  const periods = await db.getExamPeriodsByStudyId(studyId)
  const periodIds = periods.map((p: any) => String(p._id))
  const terms = await db.getExamTermsByPeriodIds(periodIds)
  return {
    periods: db.normalizeIds(periods as any[]),
    terms: db.normalizeIds(terms as any[]),
  }
}

// ─── Periods ─────────────────────────────────────────────────────────────────

export async function createExamPeriodAction(data: Record<string, any>) {
  try {
    const doc = await db.createExamPeriod(data)
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Unknown error" } }
  }
}

export async function updateExamPeriodAction(id: string, data: Record<string, any>) {
  try {
    await db.updateExamPeriod(id, data)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function deleteExamPeriodAction(id: string) {
  try {
    await db.deleteExamPeriod(id)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

// ─── Terms ─────────────────────────────────────────────────────────────────

export async function createExamTermAction(data: Record<string, any>) {
  try {
    const doc = await db.createExamTerm(data)
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Unknown error" } }
  }
}

export async function updateExamTermAction(id: string, data: Record<string, any>) {
  try {
    await db.updateExamTerm(id, data)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function deleteExamTermAction(id: string) {
  try {
    await db.deleteExamTerm(id)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function toggleExamTermLockAction(id: string, locked: boolean) {
  try {
    await db.setExamTermLocked(id, locked)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

// Remove a subject from a period entirely (drops all its candidate terms).
export async function removeSubjectFromPeriodAction(periodId: string, subjectId: string) {
  try {
    await db.deleteExamTermsByPeriodAndSubject(periodId, subjectId)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

// ─── Global break setting ────────────────────────────────────────────────────

export async function fetchInterStudyBreakMinutes() {
  const settings = await db.getAppSettings()
  const value = settings?.inter_study_break_minutes
  return typeof value === "number" ? value : EXAM_SCHEDULER_DEFAULTS.INTER_STUDY_BREAK_MINUTES
}

export async function saveInterStudyBreakMinutesAction(minutes: number) {
  try {
    await db.upsertAppSettings({ inter_study_break_minutes: Math.max(0, Math.round(minutes)) })
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

// ─── Upcoming locked terms (homepage / tasks) ────────────────────────────────

export async function fetchUpcomingLockedExamTerms(fromDate: string) {
  const rows = await db.getUpcomingLockedExamTerms(fromDate)
  return rows.map((r) => ({
    term: db.normalizeId(r.term) as any,
    study: r.study
      ? { id: String(r.study._id), name: r.study.name as string, logo_url: (r.study.logo_url as string | null) ?? null }
      : null,
    subject: r.subject
      ? { id: String(r.subject._id), name: r.subject.name as string, abbreviation: (r.subject.abbreviation as string | null) ?? null }
      : null,
    period: r.period ? { id: String(r.period._id), name: r.period.name as string } : null,
  }))
}
