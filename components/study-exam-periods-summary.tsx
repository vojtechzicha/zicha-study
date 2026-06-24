"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Lock, ExternalLink, Loader2 } from "lucide-react"
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
      setPeriods(data.periods as PeriodRow[])
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
            <div className="p-2 bg-primary-100 rounded-lg">
              <CalendarDays className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <CardTitle className="text-xl">Plánovač zkoušek</CardTitle>
              <CardDescription>Zkoušková období a termíny – rozvrh se počítá společně napříč studii</CardDescription>
            </div>
          </div>
          <Button
            onClick={() => router.push("/exam-scheduler")}
            variant="outline"
            className="border-primary-200 text-primary-700 hover:bg-primary-50"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Otevřít plánovač
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 flex items-center justify-center text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Načítání…
          </div>
        ) : periods.length === 0 ? (
          <p className="text-sm text-gray-500">
            Zatím nejsou nastavena žádná zkoušková období. Vytvořte je v plánovači zkoušek.
          </p>
        ) : (
          <div className="space-y-3">
            {periods.map((p) => {
              const subjectIds = Array.from(new Set(terms.filter((t) => t.period_id === p.id).map((t) => t.subject_id)))
              return (
                <div key={p.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{p.name}</span>
                    <span className="text-sm text-gray-500">
                      {formatDateShort(p.start_date)} – {formatDateShort(p.due_date)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {subjectIds.length === 0 ? (
                      <span className="text-xs text-gray-400 italic">žádné předměty</span>
                    ) : (
                      subjectIds.map((sid) => {
                        const subj = subjectMap.get(sid)
                        const grpTerms = terms.filter((t) => t.period_id === p.id && t.subject_id === sid)
                        const hasLock = grpTerms.some((t) => t.locked)
                        return (
                          <Badge key={sid} variant="secondary" className="bg-primary-100 text-primary-700 font-normal">
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
