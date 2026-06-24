"use server"

import * as db from "@/lib/mongodb/db"
import { EXAM_SCHEDULER_DEFAULTS, DEFAULT_WORKING_DAYS } from "@/lib/constants"

// ─── Studies management (enable + configure from the scheduler page) ─────────

// ALL studies with their scheduler config, so the planner page can enable and
// configure studies without visiting each study's settings.
export async function fetchSchedulerStudies() {
  const docs = await db.getStudies()
  const studies = db.normalizeIds(docs as any[])
  return studies.map((s: any) => ({
    id: s.id,
    name: s.name,
    logo_url: s.logo_url ?? null,
    status: s.status ?? null,
    // The scheduler only applies to active studies; treat anything else as
    // disabled regardless of the stored flag.
    exam_scheduler_enabled: !!s.exam_scheduler_enabled && s.status === "active",
    transit_duration_hours: s.transit_duration_hours ?? EXAM_SCHEDULER_DEFAULTS.TRANSIT_DURATION_HOURS,
    transit_cost_one_way: s.transit_cost_one_way ?? EXAM_SCHEDULER_DEFAULTS.TRANSIT_COST_ONE_WAY,
    accommodation_cost_per_night: s.accommodation_cost_per_night ?? EXAM_SCHEDULER_DEFAULTS.ACCOMMODATION_COST_PER_NIGHT,
    earliest_arrival_time: s.earliest_arrival_time ?? null,
    prefer_free_day_exams: s.prefer_free_day_exams ?? false,
    pto_day_cost: s.pto_day_cost ?? EXAM_SCHEDULER_DEFAULTS.PTO_DAY_COST,
    working_days: s.working_days && s.working_days.length > 0 ? s.working_days : DEFAULT_WORKING_DAYS,
  }))
}

export async function updateStudySchedulerSettingsAction(studyId: string, settings: Record<string, any>) {
  try {
    // The scheduler may only be enabled on active studies. Guard server-side so
    // a non-active study can never be opted in, even if the client tries.
    if (settings.exam_scheduler_enabled === true) {
      const study = await db.getStudyById(studyId)
      if (!study || (study as any).status !== "active") {
        return { error: { message: "Plánovač zkoušek lze zapnout pouze u aktivního studia." } }
      }
    }
    await db.updateStudy(studyId, settings)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

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
