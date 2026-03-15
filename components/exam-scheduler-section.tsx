"use client"

import React, { useState, useEffect, useCallback } from "react"
import { fetchExamOptionsBySubjectIds } from "@/lib/actions/exam-options"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CalendarDays, RefreshCw, AlertTriangle, Loader2 } from "lucide-react"
import { ExamScheduleView } from "@/components/exam-schedule-view"
import {
  generateSchedule,
  mapTrackerSubjectsToSchedulerSubjects,
  mapExamOptionsToSchedulerExams,
  type ScheduleResult,
  type TrackerSubject,
  type ExamOption,
} from "@/lib/exam-scheduler"

interface Study {
  id: string
  name: string
  exam_scheduler_enabled: boolean
  transit_duration_hours: number
  transit_cost_one_way: number
  accommodation_cost_per_night: number
  earliest_arrival_time?: string | null
}

interface ExamSchedulerSectionProps {
  study: Study
  subjects: TrackerSubject[]
  refreshTrigger?: number  // Increment to force reload of exam options
}

export function ExamSchedulerSection({ study, subjects, refreshTrigger = 0 }: ExamSchedulerSectionProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScheduleResult | null>(null)
  const [examOptions, setExamOptions] = useState<ExamOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)

  // Create a stable key from subject IDs for dependency tracking
  const subjectIdsKey = subjects.map(s => s.id).sort().join(',')

  // Load exam options on mount, when subjects change, or when refreshTrigger changes
  useEffect(() => {
    const loadExamOptions = async () => {
      setOptionsLoading(true)

      const subjectIds = subjects.map(s => s.id)
      if (subjectIds.length === 0) {
        setExamOptions([])
        setOptionsLoading(false)
        return
      }

      const data = await fetchExamOptionsBySubjectIds(subjectIds) as ExamOption[]
      if (data) {
        setExamOptions(data)
      }
      setOptionsLoading(false)
    }

    loadExamOptions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectIdsKey, refreshTrigger])

  // Count only "active" subjects with exams (not planned, not completed, requires exam) - these need scheduling
  const activeSubjectsWithExams = subjects.filter(s =>
    !s.completed && !s.planned && s.completion_type.includes("Zk")
  )
  const subjectsWithOptions = new Set(examOptions.map(e => e.subject_id))
  const subjectsWithoutOptions = activeSubjectsWithExams.filter(s => !subjectsWithOptions.has(s.id))

  // Subjects that have exam options defined - only these go to the scheduler
  const subjectsReadyForScheduling = activeSubjectsWithExams.filter(s => subjectsWithOptions.has(s.id))

  const handleGenerateSchedule = useCallback(() => {
    setLoading(true)

    // Only pass subjects that have exam options to the scheduler
    const subjectIdsWithOptions = new Set(examOptions.map(e => e.subject_id))
    const subjectsToSchedule = subjects.filter(s => subjectIdsWithOptions.has(s.id))

    // Convert to scheduler types
    const schedulerSubjects = mapTrackerSubjectsToSchedulerSubjects(subjectsToSchedule)
    const schedulerExams = mapExamOptionsToSchedulerExams(examOptions)

    // Generate schedule with study config
    const scheduleResult = generateSchedule(schedulerSubjects, schedulerExams, {
      travelCostOneWay: study.transit_cost_one_way,
      travelDurationHours: study.transit_duration_hours,
      accommodationCostPerNight: study.accommodation_cost_per_night,
      // Convert HH:MM:SS to HH:MM if provided
      earliestArrivalTime: study.earliest_arrival_time
        ? study.earliest_arrival_time.substring(0, 5)
        : undefined,
    })

    setResult(scheduleResult)
    setLoading(false)
  }, [subjects, examOptions, study])

  if (optionsLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600 mr-2" />
          <span>Načítání termínů zkoušek...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <CalendarDays className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Plánovač zkoušek</CardTitle>
                <CardDescription>
                  Najde optimální rozvrh zkoušek s nejnižšími náklady na dopravu a ubytování
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={handleGenerateSchedule}
              disabled={loading || subjectsReadyForScheduling.length === 0}
              className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generování...
                </>
              ) : result ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Přegenerovat
                </>
              ) : (
                <>
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Vygenerovat rozvrh
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Status info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-700">{activeSubjectsWithExams.length}</p>
              <p className="text-sm text-gray-600">předmětů se zkouškou</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-700">{examOptions.length}</p>
              <p className="text-sm text-gray-600">termínů zkoušek</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-700">{subjectsWithOptions.size}</p>
              <p className="text-sm text-gray-600">předmětů s termíny</p>
            </div>
          </div>

          {/* Warning for subjects without exam options */}
          {subjectsWithoutOptions.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Chybějící termíny</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Následující předměty nemají žádné termíny zkoušek:{" "}
                    {subjectsWithoutOptions.map(s => s.abbreviation || s.name).join(", ")}
                  </p>
                  <p className="text-sm text-yellow-600 mt-2">
                    Přidejte termíny v editaci předmětu.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Config summary */}
          <div className="p-3 bg-primary-50/50 rounded-lg text-sm text-gray-600">
            <p className="font-medium text-gray-700 mb-1">Nastavení plánovače:</p>
            <div className="flex flex-wrap gap-4">
              <span>Cesta: {study.transit_duration_hours}h, {study.transit_cost_one_way} Kč</span>
              <span>Ubytování: {study.accommodation_cost_per_night} Kč/noc</span>
              {study.earliest_arrival_time && (
                <span>Nejdřívější příjezd: {study.earliest_arrival_time.substring(0, 5)}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule result */}
      {result && <ExamScheduleView result={result} />}
    </div>
  )
}
