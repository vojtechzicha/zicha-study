"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import {
  ArrowLeft,
  CalendarDays,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Lock,
  RefreshCw,
  Clock3,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { StudyLogo } from "@/components/study-logo"
import { TitlePageFooter } from "@/components/title-page-footer"
import { GlobalExamScheduleView } from "@/components/global-exam-schedule-view"
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
  deleteExamPeriodAction,
} from "@/lib/actions/exam-scheduler"
import {
  generateGlobalSchedule,
  type GlobalRequirement,
  type GlobalStudyConfig,
  type GlobalScheduleComparison,
} from "@/lib/exam-scheduler"
import { DEFAULT_WORKING_DAYS, EXAM_SCHEDULER_DEFAULTS } from "@/lib/constants"

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
}
interface SubjectData {
  id: string
  study_id: string
  name: string
  abbreviation: string | null
  semester?: string
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return ""
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" })
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

export function GlobalExamScheduler() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [studies, setStudies] = useState<StudyData[]>([])
  const [periods, setPeriods] = useState<PeriodData[]>([])
  const [terms, setTerms] = useState<TermData[]>([])
  const [subjects, setSubjects] = useState<SubjectData[]>([])
  const [breakMinutes, setBreakMinutes] = useState<number>(EXAM_SCHEDULER_DEFAULTS.INTER_STUDY_BREAK_MINUTES)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<EditorPeriod | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PeriodData | null>(null)

  const [comparison, setComparison] = useState<GlobalScheduleComparison | null>(null)
  const [computing, setComputing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, brk] = await Promise.all([fetchGlobalExamSchedulingData(), fetchInterStudyBreakMinutes()])
      setStudies(data.studies as StudyData[])
      setPeriods(data.periods as PeriodData[])
      setTerms(data.terms as TermData[])
      setSubjects(data.subjects as SubjectData[])
      setBreakMinutes(brk)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  // Build requirements: one per (period, subject) with >=1 term.
  const requirements: GlobalRequirement[] = useMemo(() => {
    const periodMap = new Map(periods.map((p) => [p.id, p]))
    const grouped = new Map<string, TermData[]>()
    for (const t of terms) {
      const key = `${t.period_id}:${t.subject_id}`
      const list = grouped.get(key) || []
      list.push(t)
      grouped.set(key, list)
    }
    const reqs: GlobalRequirement[] = []
    for (const [key, ts] of grouped) {
      const [periodId, subjectId] = key.split(":")
      const period = periodMap.get(periodId)
      const subject = subjectMap.get(subjectId)
      if (!period) continue
      reqs.push({
        requirementId: key,
        periodId,
        periodName: period.name,
        studyId: period.study_id,
        subjectId,
        subjectShortcut: subject?.abbreviation || subject?.name?.substring(0, 5).toUpperCase() || "?",
        subjectName: subject?.name || "Neznámý předmět",
        windowStart: period.start_date,
        windowEnd: period.due_date,
        terms: ts.map((t) => ({
          termId: t.id,
          date: t.date,
          startTime: (t.start_time || "09:00").substring(0, 5),
          durationMinutes: t.duration_minutes,
          isOnline: !!t.is_online,
          note: t.note,
          locked: !!t.locked,
        })),
      })
    }
    return reqs
  }, [periods, terms, subjectMap])

  const studyConfigs: GlobalStudyConfig[] = useMemo(() => studies.map(buildStudyConfig), [studies])

  const runScheduler = useCallback(() => {
    setComputing(true)
    try {
      const result = generateGlobalSchedule(requirements, studyConfigs, breakMinutes)
      setComparison(result)
    } catch (err: any) {
      toast({ title: "Chyba při výpočtu rozvrhu", description: err?.message, variant: "destructive" })
    } finally {
      setComputing(false)
    }
  }, [requirements, studyConfigs, breakMinutes, toast])

  const handleBreakChange = async (value: number) => {
    setBreakMinutes(value)
    await saveInterStudyBreakMinutesAction(value)
  }

  const openNewPeriod = () => {
    setEditingPeriod(null)
    setEditorOpen(true)
  }
  const openEditPeriod = (p: PeriodData) => {
    setEditingPeriod(p)
    setEditorOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const res = await deleteExamPeriodAction(deleteTarget.id)
    if (res.error) {
      toast({ title: "Nepodařilo se smazat období", description: res.error.message, variant: "destructive" })
    } else {
      toast({ title: "Období smazáno" })
      setComparison(null)
      await load()
    }
    setDeleteTarget(null)
  }

  const editorTerms: EditorTerm[] = useMemo(
    () => (editingPeriod ? terms.filter((t) => t.period_id === editingPeriod.id) : []),
    [editingPeriod, terms]
  )

  // Group periods by study for display.
  const periodsByStudy = useMemo(() => {
    const map = new Map<string, PeriodData[]>()
    for (const p of periods) {
      const list = map.get(p.study_id) || []
      list.push(p)
      map.set(p.study_id, list)
    }
    return map
  }, [periods])

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  const noStudies = studies.length === 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center min-h-16 py-3 gap-4">
            <Button variant="ghost" onClick={() => router.push("/")} className="text-gray-600 hover:text-gray-900 flex-shrink-0">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zpět
            </Button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <CalendarDays className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">Plánovač zkoušek</h1>
                <p className="text-sm text-gray-600">Optimální rozvrh napříč všemi studii</p>
              </div>
            </div>
            {!noStudies && (
              <Button onClick={openNewPeriod} className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 flex-shrink-0">
                <Plus className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Nové období</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {noStudies ? (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="py-12 text-center">
              <CalendarDays className="mx-auto mb-3 h-10 w-10 text-gray-400" />
              <p className="text-sm font-medium text-gray-900">Žádné studium nemá zapnutý plánovač zkoušek</p>
              <p className="mt-1 text-sm text-gray-500">Zapněte plánovač v nastavení studia.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Settings + run */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="py-4 flex flex-wrap items-center gap-4 justify-between">
                <div className="flex items-center gap-3">
                  <Clock3 className="h-5 w-5 text-primary-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Pauza mezi studii</p>
                    <p className="text-xs text-gray-500">Přidá se k době přesunu při dvou prezenčních zkouškách v jeden den</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={15}
                      value={breakMinutes}
                      onChange={(e) => handleBreakChange(Math.max(0, parseInt(e.target.value) || 0))}
                      className="h-9 w-24"
                    />
                    <span className="text-sm text-gray-600">min</span>
                  </div>
                </div>
                <Button
                  onClick={runScheduler}
                  disabled={computing || requirements.length === 0}
                  className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
                >
                  {computing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  {comparison ? "Přegenerovat rozvrh" : "Vygenerovat rozvrh"}
                </Button>
              </CardContent>
            </Card>

            {/* Periods list */}
            <section className="space-y-4">
              {studies.map((study) => {
                const studyPeriods = periodsByStudy.get(study.id) || []
                if (studyPeriods.length === 0) return null
                return (
                  <Card key={study.id} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <StudyLogo logoUrl={study.logo_url} studyName={study.name} size="sm" />
                        {study.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {studyPeriods.map((p) => {
                        const periodSubjectIds = Array.from(
                          new Set(terms.filter((t) => t.period_id === p.id).map((t) => t.subject_id))
                        )
                        return (
                          <div key={p.id} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div>
                                <span className="font-medium text-gray-900">{p.name}</span>
                                <span className="text-sm text-gray-500 ml-2">
                                  {formatDateShort(p.start_date)} – {formatDateShort(p.due_date)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditPeriod(p)} className="h-8">
                                  <Pencil className="h-4 w-4 mr-1" />
                                  Upravit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteTarget(p)}
                                  className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {periodSubjectIds.length === 0 ? (
                                <span className="text-xs text-gray-400 italic">žádné předměty</span>
                              ) : (
                                periodSubjectIds.map((sid) => {
                                  const subj = subjectMap.get(sid)
                                  const grpTerms = termsByPeriodSubject.get(`${p.id}:${sid}`) || []
                                  const hasLock = grpTerms.some((t) => t.locked)
                                  return (
                                    <Badge
                                      key={sid}
                                      variant="secondary"
                                      className="bg-primary-100 text-primary-700 font-normal"
                                    >
                                      {hasLock && <Lock className="h-3 w-3 mr-1" />}
                                      {subj?.abbreviation || subj?.name || "?"}
                                      <span className="ml-1 text-primary-400">({grpTerms.length})</span>
                                    </Badge>
                                  )
                                })
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                )
              })}

              {periods.length === 0 && (
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardContent className="py-12 text-center">
                    <CalendarDays className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                    <p className="text-sm font-medium text-gray-900">Zatím žádná zkoušková období</p>
                    <p className="mt-1 text-sm text-gray-500 mb-4">
                      Vytvořte období, přidejte předměty a jejich možné termíny.
                    </p>
                    <Button onClick={openNewPeriod} className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800">
                      <Plus className="h-4 w-4 mr-2" />
                      Nové období
                    </Button>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Schedule result */}
            {comparison && <GlobalExamScheduleView comparison={comparison} />}
          </>
        )}
      </main>

      <TitlePageFooter />

      {editorOpen && (
        <ExamPeriodEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          studies={studies as EditorStudy[]}
          subjects={subjects as EditorSubject[]}
          period={editingPeriod}
          terms={editorTerms}
          onSaved={() => {
            setComparison(null)
            load()
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat období?</AlertDialogTitle>
            <AlertDialogDescription>
              Opravdu chcete smazat období „{deleteTarget?.name}“ včetně všech jeho termínů? Tuto akci nelze vrátit.
            </AlertDialogDescription>
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
