"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Lock, ExternalLink, Loader2, AlertTriangle } from "lucide-react"
import { fetchStudyExamPeriods } from "@/lib/actions/exam-scheduler"

interface SummarySubject {
  id: string
  name: string
  abbreviation?: string | null
}

interface StudyExamPeriodsSummaryProps {
  studyId: string
  subjects: SummarySubject[]
  refreshTrigger?: number
}

interface PeriodRow {
  id: string
  name: string
  start_date: string
  due_date: string
  subject_ids?: string[]
}
interface TermRow {
  id: string
  period_id: string
  subject_id: string
  locked: boolean
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return ""
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" })
}

export function StudyExamPeriodsSummary({ studyId, subjects, refreshTrigger = 0 }: StudyExamPeriodsSummaryProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [terms, setTerms] = useState<TermRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchStudyExamPeriods(studyId)
      // Order by start date, never by creation order.
      setPeriods(
        (data.periods as PeriodRow[]).slice().sort(
          (a, b) => a.start_date.localeCompare(b.start_date) || a.name.localeCompare(b.name, "cs")
        )
      )
      setTerms(data.terms as TermRow[])
    } finally {
      setLoading(false)
    }
  }, [studyId])

  useEffect(() => {
    load()
  }, [load, refreshTrigger])

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
              <CalendarDays className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <CardTitle className="text-xl">Plánovač zkoušek</CardTitle>
              <CardDescription>Rozvrh se počítá společně pro všechna studia.</CardDescription>
            </div>
          </div>
          <Button
            onClick={() => router.push("/exam-scheduler")}
            variant="outline"
            className="border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/40"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Otevřít plánovač
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Načítání…
          </div>
        ) : periods.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Zatím žádná zkoušková období. Vytvoříte je v plánovači.
          </p>
        ) : (
          <div className="space-y-3">
            {periods.map((p) => {
              const subjectIds = Array.from(
                new Set([...(p.subject_ids || []), ...terms.filter((t) => t.period_id === p.id).map((t) => t.subject_id)])
              )
              return (
                <div key={p.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDateShort(p.start_date)} – {formatDateShort(p.due_date)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {subjectIds.length === 0 ? (
                      <span className="text-xs text-muted-foreground/70 italic">žádné předměty</span>
                    ) : (
                      subjectIds.map((sid) => {
                        const subj = subjectMap.get(sid)
                        const grpTerms = terms.filter((t) => t.period_id === p.id && t.subject_id === sid)
                        const hasLock = grpTerms.some((t) => t.locked)
                        if (grpTerms.length === 0) {
                          return (
                            <Badge
                              key={sid}
                              variant="secondary"
                              className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-normal"
                              title="Do rozvrhu se nezahrne, dokud nebude mít termíny"
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {subj?.abbreviation || subj?.name || "?"}
                              <span className="ml-1 text-amber-600 dark:text-amber-400">(bez termínů)</span>
                            </Badge>
                          )
                        }
                        return (
                          <Badge key={sid} variant="secondary" className="bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 font-normal">
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
          </div>
        )}
      </CardContent>
    </Card>
  )
}
