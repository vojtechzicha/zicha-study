"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, CalendarDays, Plus, Loader2, Pencil, Trash2, Lock, Settings2, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { StudyLogo } from "@/components/study-logo"
import { TitlePageFooter } from "@/components/title-page-footer"
import {
  ExamPeriodEditor,
  type EditorStudy,
  type EditorSubject,
  type EditorPeriod,
  type EditorTerm,
} from "@/components/exam-period-editor"
import {
  fetchGlobalExamSchedulingData,
  fetchInterStudyBreakMinutes,
  saveInterStudyBreakMinutesAction,
  fetchExamPartGapMinutes,
  saveExamPartGapMinutesAction,
  deleteExamPeriodAction,
  fetchSchedulerStudies,
  updateStudySchedulerSettingsAction,
  toggleExamTermLockAction,
  createExamTermAction,
} from "@/lib/actions/exam-scheduler"
import { SchedulerStudySettingsDialog, type SchedulerStudy } from "@/components/scheduler-study-settings-dialog"
import { generateGlobalSchedule, type GlobalRequirement, type GlobalStudyConfig, type GlobalScheduleComparison } from "@/lib/exam-scheduler"
import { addMinutesToTime, parseTimeToMinutes } from "@/lib/exam-scheduler/utils"
import {
  buildTrips,
  lockPriority,
  monthKey,
  registrationState,
  relevantMonths,
  termsToUnlock,
} from "@/lib/exam-scheduler/calendar"
import {
  DEFAULT_WORKING_DAYS,
  EXAM_SCHEDULER_DEFAULTS,
  EXAM_VENUE_INFO,
  getExamTermPartLabel,
  type ExamPartsConfig,
  type ExamTermExternal,
  type ExamVenue,
  type VenueDay,
} from "@/lib/constants"
import {
  anchorsOf,
  expandWindowTerm,
  parseWindowCandidateId,
  scheduleWithWindowFallback,
  venueHours,
  type VenueCalendar,
} from "@/lib/exam-scheduler/windows"
import { czPlural } from "@/lib/utils/task-format"
import { cn } from "@/lib/utils"
import { PlanCalendar, type PeriodWindow } from "@/components/exam-scheduler/plan-calendar"
import { LockQueue, type MissingTerms } from "@/components/exam-scheduler/lock-queue"
import { SchedulerSettingsSheet } from "@/components/exam-scheduler/scheduler-settings-sheet"
import { STUDY_TONES, formatCzk, pickStudyTones, pragueNow, type PlanStudy, type PlanTerm } from "@/components/exam-scheduler/plan-model"
import { extractDominantColor } from "@/lib/color-extraction"

interface StudyData {
  id: string
  name: string
  logo_url?: string | null
  transit_duration_hours?: number
  transit_cost_one_way?: number
  accommodation_cost_per_night?: number
  earliest_arrival_time?: string | null
  prefer_free_day_exams?: boolean
  pto_day_cost?: number
  working_days?: number[]
}
interface PeriodData {
  id: string
  study_id: string
  name: string
  start_date: string
  due_date: string
  subject_ids?: string[]
  exam_parts?: Record<string, ExamPartsConfig>
}
interface TermData {
  id: string
  period_id: string
  study_id: string
  subject_id: string
  date: string
  start_time: string
  duration_minutes: number
  is_online: boolean
  note: string | null
  locked: boolean
  part_ids?: string[]
  is_pre_term?: boolean
  is_tentative?: boolean
  source?: string | null
  external?: ExamTermExternal | null
  window_end?: string | null
  venue?: ExamVenue | null
  window_id?: string | null
}
interface SubjectData {
  id: string
  study_id: string
  name: string
  abbreviation: string | null
  semester?: string
  subject_type?: string
  completed?: boolean
  planned?: boolean
}

const CARD = "bg-card/80 backdrop-blur-sm border-0 shadow-lg rounded-xl"

function formatDateShort(dateStr: string): string {
  if (!dateStr) return ""
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" })
}

function subjectShortcut(subject?: SubjectData): string {
  return subject?.abbreviation || subject?.name?.substring(0, 5).toUpperCase() || "?"
}

function toVenueCalendars(
  data: Record<string, { days: VenueDay[]; published_through: string | null }> | undefined
): Partial<Record<ExamVenue, VenueCalendar>> {
  const out: Partial<Record<ExamVenue, VenueCalendar>> = {}
  for (const [venue, cal] of Object.entries(data || {})) {
    out[venue as ExamVenue] = { days: new Map(cal.days.map((d) => [d.date, d])), publishedThrough: cal.published_through }
  }
  return out
}

function buildStudyConfig(s: StudyData): GlobalStudyConfig {
  return {
    studyId: s.id,
    studyName: s.name,
    travelCostOneWay: s.transit_cost_one_way ?? EXAM_SCHEDULER_DEFAULTS.TRANSIT_COST_ONE_WAY,
    travelDurationHours: s.transit_duration_hours ?? EXAM_SCHEDULER_DEFAULTS.TRANSIT_DURATION_HOURS,
    accommodationCostPerNight: s.accommodation_cost_per_night ?? EXAM_SCHEDULER_DEFAULTS.ACCOMMODATION_COST_PER_NIGHT,
    earliestArrivalTime: s.earliest_arrival_time ? s.earliest_arrival_time.substring(0, 5) : undefined,
    preferFreeDayExams: s.prefer_free_day_exams ?? false,
    ptoDayCost: s.pto_day_cost ?? EXAM_SCHEDULER_DEFAULTS.PTO_DAY_COST,
    workingDays: s.working_days && s.working_days.length > 0 ? s.working_days : DEFAULT_WORKING_DAYS,
  }
}

function tripsLabel(trips: number, nights: number): string {
  const parts = [`${trips} ${czPlural(trips, "cesta", "cesty", "cest")}`]
  if (nights > 0) parts.push(`${nights} ${czPlural(nights, "noc", "noci", "nocí")}`)
  return parts.join(", ")
}

export function GlobalExamScheduler() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [studies, setStudies] = useState<StudyData[]>([])
  const [allStudies, setAllStudies] = useState<SchedulerStudy[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsStudy, setSettingsStudy] = useState<SchedulerStudy | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [periods, setPeriods] = useState<PeriodData[]>([])
  const [terms, setTerms] = useState<TermData[]>([])
  const [subjects, setSubjects] = useState<SubjectData[]>([])
  const [breakMinutes, setBreakMinutes] = useState<number>(EXAM_SCHEDULER_DEFAULTS.INTER_STUDY_BREAK_MINUTES)
  const [partGapMinutes, setPartGapMinutes] = useState<number>(EXAM_SCHEDULER_DEFAULTS.EXAM_PART_GAP_MINUTES)
  const [venueCalendars, setVenueCalendars] = useState<Partial<Record<ExamVenue, VenueCalendar>>>({})

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<EditorPeriod | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PeriodData | null>(null)

  const [preview, setPreview] = useState(false) // show the plan that ignores locks
  const [month, setMonth] = useState<string | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [now, setNow] = useState(() => pragueNow())
  const today = now.slice(0, 10)

  useEffect(() => {
    const id = window.setInterval(() => setNow(pragueNow()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, brk, gap, all] = await Promise.all([
        fetchGlobalExamSchedulingData(),
        fetchInterStudyBreakMinutes(),
        fetchExamPartGapMinutes(),
        fetchSchedulerStudies(),
      ])
      setStudies(data.studies as StudyData[])
      setPeriods(data.periods as PeriodData[])
      setTerms(data.terms as TermData[])
      setSubjects(data.subjects as SubjectData[])
      setVenueCalendars(toVenueCalendars(data.venueCalendars))
      setBreakMinutes(brk)
      setPartGapMinutes(gap)
      setAllStudies(all as SchedulerStudy[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])
  const periodMap = useMemo(() => new Map(periods.map((p) => [p.id, p])), [periods])

  // Each study's colour comes from its logo (ČZU red, UHK blue): the dominant colour, extracted in
  // the browser like on the study pages; the default tones are used until then or without a logo.
  const [logoColors, setLogoColors] = useState<Map<string, [number, number, number]>>(new Map())
  const requestedLogos = useRef(new Set<string>())
  useEffect(() => {
    for (const s of studies) {
      const key = `${s.id}:${s.logo_url}`
      if (!s.logo_url || requestedLogos.current.has(key)) continue
      requestedLogos.current.add(key)
      extractDominantColor(s.logo_url)
        .then((c) => setLogoColors((m) => new Map(m).set(s.id, c.hsl)))
        .catch(() => {})
    }
  }, [studies])

  const planStudies = useMemo(() => {
    const sorted = [...studies].sort((a, b) => a.name.localeCompare(b.name, "cs"))
    const tones = pickStudyTones(sorted.map((s) => ({ id: s.id, hsl: logoColors.get(s.id) })))
    return new Map<string, PlanStudy>(
      sorted.map((s) => [s.id, { id: s.id, name: s.name, logo_url: s.logo_url, tone: tones.get(s.id) ?? STUDY_TONES[0] }])
    )
  }, [studies, logoColors])

  // One requirement per (period, subject) with at least one term. Completed
  // subjects no longer need a term, so they are left out of the plan.
  // `fullWindows`: requirement ids whose windows are expanded to every open day (the fallback of
  // scheduleWithWindowFallback); other windows are offered only on the study's trip days.
  const buildRequirements = useCallback((fullWindows: Set<string>): GlobalRequirement[] => {
    const grouped = new Map<string, TermData[]>()
    for (const t of terms) {
      const key = `${t.period_id}:${t.subject_id}`
      const list = grouped.get(key) || []
      list.push(t)
      grouped.set(key, list)
    }
    // Window terms are offered as slots on the days the study has other exams (plus the window's
    // first and last open day); a window that already has a booked term is left out.
    const booked = new Set(terms.map((t) => t.window_id).filter(Boolean))
    const studyOf = (t: TermData) => periodMap.get(t.period_id)?.study_id
    const anchorsByStudy = new Map<string, ReturnType<typeof anchorsOf>>()
    for (const study of new Set(terms.map(studyOf))) {
      if (!study) continue
      anchorsByStudy.set(
        study,
        anchorsOf(
          terms
            .filter((t) => studyOf(t) === study && !t.window_end)
            .map((t) => ({ date: t.date, startTime: (t.start_time || "09:00").substring(0, 5), durationMinutes: t.duration_minutes }))
        )
      )
    }
    const studyById = new Map(studies.map((s) => [s.id, s]))
    // Other studies' exams, with the transfer gap the solver requires between studies.
    const transit = (studyId: string) => Math.round((studyById.get(studyId)?.transit_duration_hours ?? EXAM_SCHEDULER_DEFAULTS.TRANSIT_DURATION_HOURS) * 60)
    const crossByStudy = new Map<string, Map<string, [number, number, number][]>>()
    for (const study of studyById.keys()) {
      const map = new Map<string, [number, number, number][]>()
      for (const t of terms) {
        const other = studyOf(t)
        if (!other || other === study || t.window_end) continue
        const start = parseTimeToMinutes((t.start_time || "09:00").substring(0, 5))
        const gap = t.is_online ? 0 : transit(study) + transit(other) + Math.max(0, breakMinutes)
        map.set(t.date, [...(map.get(t.date) || []), [start, start + t.duration_minutes, gap]])
      }
      crossByStudy.set(study, map)
    }
    const windowsByStudy = new Map<string, number>()
    for (const t of terms) {
      const study = studyOf(t)
      if (t.window_end && study && !booked.has(t.id)) windowsByStudy.set(study, (windowsByStudy.get(study) || 0) + 1)
    }
    const toGlobal = (t: TermData) => ({
      termId: t.id,
      date: t.date,
      startTime: (t.start_time || "09:00").substring(0, 5),
      durationMinutes: t.duration_minutes,
      isOnline: !!t.is_online,
      note: t.note,
      locked: !!t.locked,
      partIds: t.part_ids,
      isPreTerm: !!t.is_pre_term,
      isTentative: !!t.is_tentative,
    })

    const reqs: GlobalRequirement[] = []
    for (const [key, ts] of grouped) {
      const [periodId, subjectId] = key.split(":")
      const period = periodMap.get(periodId)
      const subject = subjectMap.get(subjectId)
      if (!period || subject?.completed) continue
      reqs.push({
        requirementId: key,
        periodId,
        periodName: period.name,
        studyId: period.study_id,
        subjectId,
        subjectShortcut: subjectShortcut(subject),
        subjectName: subject?.name || "Neznámý předmět",
        windowStart: period.start_date,
        windowEnd: period.due_date,
        terms: ts.flatMap((t) => {
          if (!t.window_end) return [toGlobal(t)]
          if (booked.has(t.id)) return []
          const study = studyById.get(period.study_id)
          return expandWindowTerm(
            { ...toGlobal(t), windowEnd: t.window_end, venue: t.venue ?? null },
            {
              today,
              periodStart: period.start_date,
              calendars: venueCalendars,
              study: study ? buildStudyConfig(study) : undefined,
              partGapMinutes,
              otherWindows: Math.max(0, (windowsByStudy.get(period.study_id) || 0) - 1),
              crossStudyAnchors: crossByStudy.get(period.study_id),
              anchors: anchorsByStudy.get(period.study_id),
              onlyAnchorDays: !fullWindows.has(key),
            }
          )
        }),
        parts: period.exam_parts?.[subjectId],
      })
    }
    return reqs
  }, [terms, periodMap, subjectMap, studies, venueCalendars, today, partGapMinutes, breakMinutes])

  const studyConfigs: GlobalStudyConfig[] = useMemo(() => studies.map(buildStudyConfig), [studies])
  const windowRequirementIds = useMemo(
    () => new Set(terms.filter((t) => t.window_end).map((t) => `${t.period_id}:${t.subject_id}`)),
    [terms]
  )

  // The plan is recomputed whenever the data changes; there is no "generate" step.
  const { requirements, comparison, planError } = useMemo((): {
    requirements: GlobalRequirement[]
    comparison: GlobalScheduleComparison | null
    planError: string | null
  } => {
    const reduced = buildRequirements(new Set())
    if (reduced.length === 0) return { requirements: reduced, comparison: null, planError: null }
    try {
      const run = (reqs: GlobalRequirement[]) => generateGlobalSchedule(reqs, studyConfigs, breakMinutes, partGapMinutes)
      const planned = scheduleWithWindowFallback(buildRequirements, run, windowRequirementIds)
      return { requirements: planned.requirements, comparison: planned.comparison, planError: null }
    } catch (err: any) {
      return { requirements: reduced, comparison: null, planError: err?.message || "Plán se nepodařilo vypočítat." }
    }
  }, [buildRequirements, studyConfigs, breakMinutes, partGapMinutes, windowRequirementIds])

  const showComparison =
    !!comparison &&
    comparison.hasLocks &&
    (comparison.droppedByLocks > 0 || comparison.savingsCost > 0 || comparison.optimal.score < comparison.forced.score)
  const isPreview = preview && showComparison
  const result = comparison ? (isPreview ? comparison.optimal : comparison.forced) : null

  const planTerms: PlanTerm[] = useMemo(() => {
    const selected = new Set(result?.selectedTermIds || [])
    const pto = new Set(
      (result?.items || []).filter((it) => it.type === "exam" && it.requiresPto && it.exam).map((it) => it.exam!.id)
    )
    const out: PlanTerm[] = []
    for (const req of requirements) {
      for (const t of req.terms) {
        // A window's slots that the plan didn't pick are not shown (the window is one row in the editor).
        const slot = parseWindowCandidateId(t.termId)
        if (slot && !selected.has(t.termId)) continue
        const raw = terms.find((x) => x.id === (slot ? slot.windowId : t.termId))
        const venue = slot ? raw?.venue ?? null : null
        out.push({
          id: t.termId,
          requirementId: req.requirementId,
          studyId: req.studyId,
          periodId: req.periodId,
          periodName: req.periodName,
          subjectId: req.subjectId,
          shortcut: req.subjectShortcut,
          subjectName: req.subjectName,
          date: t.date,
          startTime: t.startTime,
          endTime: addMinutesToTime(t.startTime, t.durationMinutes),
          isOnline: t.isOnline,
          locked: t.locked,
          partLabel: getExamTermPartLabel({ part_ids: t.partIds }, req.parts),
          isPreTerm: !!t.isPreTerm,
          isTentative: !!t.isTentative,
          note: t.note,
          source: raw?.source,
          external: raw?.external,
          inPlan: selected.has(t.termId),
          requiresPto: pto.has(t.termId),
          windowId: slot?.windowId ?? null,
          venue,
          venueOccupancy: venue ? venueHours(venue, venueCalendars[venue], t.date)?.occupancy ?? null : null,
        })
      }
    }
    return out
  }, [requirements, terms, result, venueCalendars])

  const trips = useMemo(() => buildTrips(result?.items || []), [result])

  const windows: PeriodWindow[] = useMemo(
    () =>
      periods
        .filter((p) => p.start_date && p.due_date)
        .map((p) => ({ studyId: p.study_id, name: p.name, start: p.start_date, end: p.due_date })),
    [periods]
  )

  const months = useMemo(() => {
    const dates = [...planTerms.map((t) => t.date), ...(result?.items || []).map((it) => it.date)]
    const list = relevantMonths(dates, windows, today)
    return list.length > 0 ? list : [monthKey(today)]
  }, [planTerms, result, windows, today])

  // Open on the month of the next planned exam that still needs a lock, else the next planned exam.
  useEffect(() => {
    if (loading || month) return
    const upcoming = planTerms.filter((t) => t.inPlan && t.date >= today).sort((a, b) => a.date.localeCompare(b.date))
    const target = upcoming.find((t) => !t.locked) || upcoming[0]
    setMonth(target ? monthKey(target.date) : months[0])
  }, [loading, month, planTerms, months, today])

  const activeMonth = month && months.includes(month) ? month : months[0]

  const lockQueue = useMemo(() => {
    return planTerms
      .filter((t) => t.inPlan && !t.locked && t.date >= today)
      .map((t) => ({ t, key: lockPriority(registrationState(t.external, now), t.date) }))
      .sort((a, b) => a.key[0] - b.key[0] || a.key[1].localeCompare(b.key[1]) || a.t.date.localeCompare(b.t.date))
      .map((x) => x.t)
  }, [planTerms, now, today])

  const alternatives = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of planTerms) if (!t.inPlan) map.set(t.requirementId, (map.get(t.requirementId) || 0) + 1)
    return map
  }, [planTerms])

  const termsByPeriodSubject = useMemo(() => {
    const map = new Map<string, TermData[]>()
    for (const t of terms) {
      const key = `${t.period_id}:${t.subject_id}`
      const list = map.get(key) || []
      list.push(t)
      map.set(key, list)
    }
    return map
  }, [terms])

  // Subjects of current periods without any candidate term: the plan can't include them yet.
  const missing: MissingTerms[] = useMemo(() => {
    const out: MissingTerms[] = []
    const sorted = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date))
    for (const p of sorted) {
      if (p.due_date < today) continue
      const subjectsWithout = (p.subject_ids || [])
        .filter((sid) => !subjectMap.get(sid)?.completed && !termsByPeriodSubject.has(`${p.id}:${sid}`))
        .map((sid) => subjectShortcut(subjectMap.get(sid)))
      if (subjectsWithout.length > 0) out.push({ periodId: p.id, periodName: p.name, studyId: p.study_id, subjects: subjectsWithout })
    }
    return out
  }, [periods, subjectMap, termsByPeriodSubject, today])

  const plannedCount = planTerms.filter((t) => t.inPlan).length

  // Locking a window slot records the booking: a real locked term on that slot, linked to the
  // window (window_id), after which the window is no longer expanded. Other locks of the same
  // parts are released like for any lock.
  const bookWindowSlot = useCallback(
    async (term: PlanTerm) => {
      const window = terms.find((t) => t.id === term.windowId)
      if (!window) return
      setBusyIds((s) => new Set(s).add(term.id))
      try {
        const venue = window.venue ? EXAM_VENUE_INFO[window.venue] : null
        const res = await createExamTermAction({
          period_id: window.period_id,
          study_id: window.study_id,
          subject_id: window.subject_id,
          date: term.date,
          start_time: term.startTime,
          duration_minutes: window.duration_minutes,
          is_online: !!window.is_online,
          note: venue ? `Rezervace – ${venue.label}` : window.note,
          locked: true,
          part_ids: window.part_ids || [],
          is_pre_term: term.isPreTerm,
          is_tentative: false,
          window_id: window.id,
        })
        if (res.error || !res.data) throw new Error(res.error?.message || "Termín se nepodařilo uložit.")
        const newId = res.data.id
        const parts = periodMap.get(window.period_id)?.exam_parts?.[window.subject_id]
        const siblings = [
          ...terms
            .filter((t) => t.period_id === window.period_id && t.subject_id === window.subject_id && !t.window_end)
            .map((t) => ({ id: t.id, locked: !!t.locked, part_ids: t.part_ids })),
          { id: newId, locked: true, part_ids: window.part_ids },
        ]
        for (const id of termsToUnlock(siblings, newId, parts)) {
          const r = await toggleExamTermLockAction(id, false)
          if (r.error) throw new Error(r.error.message)
        }
      } catch (err: any) {
        toast({ title: "Nepodařilo se uložit rezervaci.", description: err?.message, variant: "destructive" })
      } finally {
        setBusyIds((s) => {
          const next = new Set(s)
          next.delete(term.id)
          return next
        })
        await load()
      }
    },
    [terms, periodMap, toast, load]
  )

  const setLock = useCallback(
    async (term: PlanTerm, locked: boolean) => {
      if (term.windowId) {
        if (locked) await bookWindowSlot(term)
        return
      }
      const siblings = terms.filter((t) => t.period_id === term.periodId && t.subject_id === term.subjectId)
      const parts = periodMap.get(term.periodId)?.exam_parts?.[term.subjectId]
      const unlock = locked ? termsToUnlock(siblings.map((t) => ({ id: t.id, locked: !!t.locked, part_ids: t.part_ids })), term.id, parts) : []
      const changes = new Map<string, boolean>([[term.id, locked], ...unlock.map((id) => [id, false] as [string, boolean])])

      setBusyIds((s) => new Set(s).add(term.id))
      setTerms((ts) => ts.map((t) => (changes.has(t.id) ? { ...t, locked: changes.get(t.id)! } : t)))
      // Each change is saved on its own: release the old locks first, then set the new one. If a
      // save fails, the earlier ones are already stored, so the terms are reloaded from the
      // database instead of restoring the previous page state.
      const order: [string, boolean][] = [...unlock.map((id) => [id, false] as [string, boolean]), [term.id, locked]]
      try {
        let error: string | null = null
        try {
          for (const [id, value] of order) {
            const res = await toggleExamTermLockAction(id, value)
            if (res.error) {
              error = res.error.message
              break
            }
          }
        } catch (err: any) {
          error = err?.message || "Spojení se nezdařilo."
        }
        if (error !== null) {
          toast({
            title: locked ? "Nepodařilo se zamknout termín." : "Nepodařilo se odemknout termín.",
            description: error,
            variant: "destructive",
          })
          try {
            const data = await fetchGlobalExamSchedulingData()
            setTerms(data.terms as TermData[])
          } catch {
            await load()
          }
        }
      } finally {
        setBusyIds((s) => {
          const next = new Set(s)
          next.delete(term.id)
          return next
        })
      }
    },
    [terms, periodMap, toast, load, bookWindowSlot]
  )

  const showTerm = (term: PlanTerm) => {
    setMonth(monthKey(term.date))
    setOpenDay(term.date)
  }

  const handleBreakChange = async (value: number) => {
    setBreakMinutes(value)
    await saveInterStudyBreakMinutesAction(value)
  }

  const handlePartGapChange = async (value: number) => {
    setPartGapMinutes(value)
    await saveExamPartGapMinutesAction(value)
  }

  const openNewPeriod = () => {
    setEditingPeriod(null)
    setEditorOpen(true)
  }
  const openEditPeriod = (p: PeriodData) => {
    setEditingPeriod(p)
    setEditorOpen(true)
  }

  const toggleStudyEnabled = async (study: SchedulerStudy, enabled: boolean) => {
    setTogglingId(study.id)
    try {
      const res = await updateStudySchedulerSettingsAction(study.id, { exam_scheduler_enabled: enabled })
      if (res.error) {
        toast({ title: "Nepodařilo se uložit", description: res.error.message, variant: "destructive" })
        return
      }
      await load()
    } finally {
      setTogglingId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const res = await deleteExamPeriodAction(deleteTarget.id)
    if (res.error) {
      toast({ title: "Nepodařilo se smazat období", description: res.error.message, variant: "destructive" })
    } else {
      toast({ title: "Období smazáno" })
      await load()
    }
    setDeleteTarget(null)
  }

  const editorTerms: EditorTerm[] = useMemo(
    () => (editingPeriod ? terms.filter((t) => t.period_id === editingPeriod.id) : []),
    [editingPeriod, terms]
  )

  // Periods by study, ordered by start date (never by creation order).
  const periodsByStudy = useMemo(() => {
    const map = new Map<string, PeriodData[]>()
    for (const p of periods) {
      const list = map.get(p.study_id) || []
      list.push(p)
      map.set(p.study_id, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.name.localeCompare(b.name, "cs"))
    }
    return map
  }, [periods])

  const hasSplitSubjects = useMemo(() => periods.some((p) => Object.keys(p.exam_parts || {}).length > 0), [periods])

  if (loading && studies.length === 0 && allStudies.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 dark:from-primary-950 to-primary-100 dark:to-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
      </div>
    )
  }

  // The planner only applies to active studies; non-active studies are hidden entirely.
  const activeStudies = allStudies.filter((s) => s.status === "active")
  const hasEnabled = studies.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 dark:from-primary-950 to-primary-100 dark:to-background">
      <header className="bg-card/80 backdrop-blur-sm border-b border-border/40 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center min-h-16 py-3 gap-4">
            <Button variant="ghost" onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground flex-shrink-0">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zpět
            </Button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <CalendarDays className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-foreground leading-tight truncate">Plánovač zkoušek</h1>
            </div>
            {activeStudies.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => setSettingsOpen(true)}
                aria-label="Nastavení"
                className="flex-shrink-0 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/40"
              >
                <Settings2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nastavení</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-10">
        {activeStudies.length === 0 ? (
          <EmptyState title="Žádná aktivní studia" text="Plánovač zkoušek funguje jen pro aktivní studia." />
        ) : !hasEnabled ? (
          <EmptyState title="Žádné studium není v plánovači" text="Zapněte studium v nastavení a vyplňte dopravu a ubytování.">
            <Button onClick={() => setSettingsOpen(true)} className="mt-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800">
              <Settings2 className="h-4 w-4 mr-2" />
              Otevřít nastavení
            </Button>
          </EmptyState>
        ) : periods.length === 0 ? (
          <EmptyState title="Zatím žádná zkoušková období" text="Vytvořte období, přidejte předměty a jejich možné termíny.">
            <Button onClick={openNewPeriod} className="mt-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800">
              <Plus className="h-4 w-4 mr-2" />
              Nové období
            </Button>
          </EmptyState>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
              <section aria-label="Kalendář plánu" className={cn(CARD, "overflow-hidden")}>
                {showComparison && comparison && (
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-5 py-2.5 text-sm border-b",
                      isPreview
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200"
                        : "bg-muted/50 border-border text-foreground/80"
                    )}
                  >
                    <Sparkles className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span className="flex-1 min-w-[12rem]">
                      {isPreview
                        ? "Náhled plánu bez zámků. Zamknutím termínu ho převezmete."
                        : comparison.droppedByLocks > 0
                          ? `Zámky vyřazují z plánu ${comparison.droppedByLocks} ${czPlural(comparison.droppedByLocks, "zkoušku", "zkoušky", "zkoušek")}.`
                          : `Bez zámků by plán vyšel o ${formatCzk(comparison.savingsCost)} levněji.`}
                    </span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPreview(!isPreview)}>
                      {isPreview ? (
                        <>
                          <Lock className="h-3 w-3 mr-1.5" />
                          Zpět na plán se zámky
                        </>
                      ) : (
                        "Ukázat plán bez zámků"
                      )}
                    </Button>
                  </div>
                )}

                <PlanCalendar
                  months={months}
                  month={activeMonth}
                  onMonthChange={(m) => {
                    setMonth(m)
                    setOpenDay(null)
                  }}
                  terms={planTerms}
                  items={result?.items || []}
                  trips={trips}
                  studies={planStudies}
                  windows={windows}
                  today={today}
                  openDay={openDay}
                  onOpenDayChange={setOpenDay}
                  onLock={(t) => setLock(t, true)}
                  onUnlock={(t) => setLock(t, false)}
                  busyIds={busyIds}
                />

                <PlanFooter result={result} studies={planStudies} planError={planError} />
              </section>

              <aside className={cn(CARD, "p-4 sm:p-5 lg:sticky lg:top-24")}>
                <LockQueue
                  queue={lockQueue}
                  alternatives={alternatives}
                  studies={planStudies}
                  now={now}
                  busyIds={busyIds}
                  onLock={(t) => setLock(t, true)}
                  onShow={showTerm}
                  unschedulable={result?.unschedulable || []}
                  missing={missing}
                  onEditPeriod={(id) => {
                    const p = periodMap.get(id)
                    if (p) openEditPeriod(p)
                  }}
                  plannedCount={plannedCount}
                />
              </aside>
            </div>

            <section aria-labelledby="periods-title" className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 id="periods-title" className="text-lg font-semibold text-foreground">
                  Období a termíny
                </h2>
                <Button onClick={openNewPeriod} variant="outline" size="sm" className="border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300">
                  <Plus className="h-4 w-4 mr-1" />
                  Nové období
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {studies.map((study) => {
                  const studyPeriods = periodsByStudy.get(study.id) || []
                  if (studyPeriods.length === 0) return null
                  const tone = planStudies.get(study.id)?.tone
                  return (
                    <div key={study.id} className={cn(CARD, "p-4")}>
                      <div className="flex items-center gap-2 mb-3">
                        <StudyLogo logoUrl={study.logo_url} studyName={study.name} size="sm" />
                        <h3 className="text-sm font-semibold text-foreground min-w-0 flex-1">{study.name}</h3>
                        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", tone?.swatch)} aria-hidden="true" />
                      </div>
                      <ul className="divide-y divide-border">
                        {studyPeriods.map((p) => (
                          <PeriodRow
                            key={p.id}
                            period={p}
                            terms={terms}
                            subjectMap={subjectMap}
                            termsByPeriodSubject={termsByPeriodSubject}
                            onEdit={() => openEditPeriod(p)}
                            onDelete={() => setDeleteTarget(p)}
                          />
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </main>

      <TitlePageFooter />

      <SchedulerSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        studies={activeStudies}
        togglingId={togglingId}
        onToggle={toggleStudyEnabled}
        onEditStudy={setSettingsStudy}
        breakMinutes={breakMinutes}
        onBreakChange={handleBreakChange}
        partGapMinutes={partGapMinutes}
        onPartGapChange={handlePartGapChange}
        showPartGap={hasSplitSubjects}
      />

      {settingsStudy && (
        <SchedulerStudySettingsDialog
          open={!!settingsStudy}
          onOpenChange={(o) => !o && setSettingsStudy(null)}
          study={settingsStudy}
          onSaved={load}
        />
      )}

      {editorOpen && (
        <ExamPeriodEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          studies={studies as EditorStudy[]}
          subjects={subjects as EditorSubject[]}
          period={editingPeriod}
          terms={editorTerms}
          onSaved={load}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat období?</AlertDialogTitle>
            <AlertDialogDescription>Období „{deleteTarget?.name}“ se trvale smaže i se všemi termíny.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EmptyState({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className={cn(CARD, "py-12 px-4 text-center")}>
      <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground/70" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  )
}

function PlanFooter({
  result,
  studies,
  planError,
}: {
  result: GlobalScheduleComparison["forced"] | null
  studies: Map<string, PlanStudy>
  planError: string | null
}) {
  const error = planError || result?.error
  return (
    <div className="border-t border-border px-4 sm:px-5 py-3 space-y-2">
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {result && !result.error && result.perStudy.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5 text-sm">
          {result.perStudy.map((s) => {
            const study = studies.get(s.studyId)
            return (
              <span key={s.studyId} className="flex items-center gap-2 min-w-0">
                <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", study?.tone.swatch)} aria-hidden="true" />
                <StudyLogo logoUrl={study?.logo_url} studyName={s.studyName} size="sm" className="h-5 w-5 p-0.5 text-[8px] shrink-0" />
                <span className="text-foreground/80">
                  {tripsLabel(s.travelTrips / 2, s.accommodationNights)} – {formatCzk(s.totalCost)}
                </span>
              </span>
            )
          })}
          <span className="sm:ml-auto font-medium text-foreground tabular-nums">
            Celkem {formatCzk(result.totalCost)}
            {result.breakdown.ptoDays > 0 && (
              <span className="font-normal text-muted-foreground">
                , {result.breakdown.ptoDays} {czPlural(result.breakdown.ptoDays, "den", "dny", "dní")} dovolené
              </span>
            )}
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-3.5 w-6 items-center justify-center rounded bg-foreground/70">
            <Lock className="h-2 w-2 text-background" />
          </span>
          Zamčeno
        </span>
        <span className="flex items-center gap-1.5">
          <span className="relative h-3.5 w-6 rounded border border-dashed border-foreground/50">
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-card" />
          </span>
          V plánu, nezamčeno
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border-[1.5px] border-foreground/50" />
          Jiný termín
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-6 rounded bg-primary-50 dark:bg-primary-950 ring-1 ring-inset ring-border" />
          Zkouškové období
        </span>
        {result?.truncated && <span className="text-amber-700 dark:text-amber-300">Plán nemusí být nejlevnější možný.</span>}
      </div>
    </div>
  )
}

function PeriodRow({
  period: p,
  terms,
  subjectMap,
  termsByPeriodSubject,
  onEdit,
  onDelete,
}: {
  period: PeriodData
  terms: TermData[]
  subjectMap: Map<string, SubjectData>
  termsByPeriodSubject: Map<string, TermData[]>
  onEdit: () => void
  onDelete: () => void
}) {
  const subjectIds = Array.from(new Set([...(p.subject_ids || []), ...terms.filter((t) => t.period_id === p.id).map((t) => t.subject_id)]))
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground">{p.name}</span>
          <span className="ml-2 text-xs text-muted-foreground tabular-nums">
            {formatDateShort(p.start_date)} – {formatDateShort(p.due_date)}
          </span>
        </div>
        <div className="flex items-center shrink-0">
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-8">
            <Pencil className="h-4 w-4 mr-1" />
            Upravit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            aria-label="Smazat období"
            className="h-8 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {subjectIds.length === 0 ? (
          <span className="text-xs text-muted-foreground/70 italic">žádné předměty</span>
        ) : (
          subjectIds.map((sid) => {
            const subj = subjectMap.get(sid)
            const grpTerms = termsByPeriodSubject.get(`${p.id}:${sid}`) || []
            const hasLock = grpTerms.some((t) => t.locked)
            if (subj?.completed) {
              return (
                <Badge key={sid} variant="secondary" className="bg-muted text-muted-foreground font-normal" title="Dokončený předmět, do plánu se nezahrne">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {subj.abbreviation || subj.name}
                </Badge>
              )
            }
            if (grpTerms.length === 0) {
              return (
                <Badge
                  key={sid}
                  variant="secondary"
                  className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-normal"
                  title="Do plánu se nezahrne, dokud nebude mít termíny"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {subj?.abbreviation || subj?.name || "?"}
                </Badge>
              )
            }
            return (
              <Badge key={sid} variant="secondary" className="bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 font-normal">
                {hasLock && <Lock className="h-3 w-3 mr-1" />}
                {subj?.abbreviation || subj?.name || "?"}
                <span className="ml-1 text-primary-500 dark:text-primary-400">({grpTerms.length})</span>
              </Badge>
            )
          })
        )}
      </div>
    </li>
  )
}
