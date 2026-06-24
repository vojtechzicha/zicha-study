"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ListTodo, ChevronRight, ListChecks, CalendarDays, Lock, Clock, Monitor } from "lucide-react"
import { fetchAllTasks } from "@/lib/actions/tasks"
import { fetchUpcomingLockedExamTerms } from "@/lib/actions/exam-scheduler"
import { GlobalTaskRow } from "@/components/global-task-row"
import { TaskStateChips } from "@/components/task-state-chips"
import { StudyLogo } from "@/components/study-logo"
import type { UpcomingExamTerm } from "@/components/upcoming-exam-terms"
import { getTaskState, todayLocalIso, type Task, type TaskState } from "@/lib/constants"
import { cn } from "@/lib/utils"

const POPOVER_VISIBLE_NON_OVERDUE = 5
const POPOVER_VISIBLE_EXAMS = 4

// An exam term counts as "imminent" (drives the topbar badge) within this many days.
const IMMINENT_EXAM_DAYS = 7

function daysUntil(dateStr: string, today: string): number {
  const a = new Date(`${today}T00:00:00Z`).getTime()
  const b = new Date(`${dateStr}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86_400_000)
}

function formatExamDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

interface TaskWithStudy {
  task: Task
  study: { id: string; name: string; logo_url: string | null }
}

export function GlobalTasksButton() {
  const [items, setItems] = useState<TaskWithStudy[]>([])
  const [examTerms, setExamTerms] = useState<UpcomingExamTerm[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksData, examData] = await Promise.all([
        fetchAllTasks(),
        fetchUpcomingLockedExamTerms(todayLocalIso()),
      ])
      setItems(tasksData as TaskWithStudy[])
      setExamTerms(examData as UpcomingExamTerm[])
    } catch {
      setItems([])
      setExamTerms([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Refresh when popover opens, in case tasks changed elsewhere.
  useEffect(() => {
    if (open) load()
  }, [open, load])

  const today = todayLocalIso()

  const { counts, visible, hiddenCount } = useMemo(() => {
    const grouped: Record<TaskState, TaskWithStudy[]> = {
      overdue: [],
      running: [],
      upcoming: [],
      completed: [],
    }
    for (const it of items) {
      grouped[getTaskState(it.task, today)].push(it)
    }
    grouped.overdue.sort((a, b) => a.task.deadline.localeCompare(b.task.deadline))
    grouped.running.sort((a, b) => a.task.deadline.localeCompare(b.task.deadline))
    grouped.upcoming.sort((a, b) =>
      (a.task.start_date || a.task.deadline).localeCompare(b.task.start_date || b.task.deadline),
    )

    const counts: Record<TaskState, number> = {
      overdue: grouped.overdue.length,
      running: grouped.running.length,
      upcoming: grouped.upcoming.length,
      completed: grouped.completed.length,
    }

    const nonOverdue = [...grouped.running, ...grouped.upcoming]
    const visible = [...grouped.overdue, ...nonOverdue.slice(0, POPOVER_VISIBLE_NON_OVERDUE)]
    const hiddenCount = Math.max(0, nonOverdue.length - POPOVER_VISIBLE_NON_OVERDUE)

    return { counts, visible, hiddenCount }
  }, [items, today])

  const runningCount = counts.running
  const overdueCount = counts.overdue
  const activeCount = runningCount + overdueCount + counts.upcoming

  const { visibleExams, hiddenExamCount, imminentExamCount } = useMemo(() => {
    const sorted = [...examTerms].sort((a, b) =>
      `${a.term.date}${a.term.start_time}`.localeCompare(`${b.term.date}${b.term.start_time}`),
    )
    const visibleExams = sorted.slice(0, POPOVER_VISIBLE_EXAMS)
    const hiddenExamCount = Math.max(0, sorted.length - POPOVER_VISIBLE_EXAMS)
    const imminentExamCount = sorted.filter((e) => {
      const d = daysUntil(e.term.date, today)
      return d >= 0 && d <= IMMINENT_EXAM_DAYS
    }).length
    return { visibleExams, hiddenExamCount, imminentExamCount }
  }, [examTerms, today])

  const showBadge = runningCount > 0 || overdueCount > 0 || imminentExamCount > 0

  const handleRowClick = (task: Task, studyId: string) => {
    setOpen(false)
    router.push(`/studies/${studyId}?task=${task.id}`)
  }

  const handleShowAll = () => {
    setOpen(false)
    router.push("/tasks")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title="Úkoly napříč studii"
          aria-label="Otevřít přehled úkolů"
          className="relative"
        >
          <ListTodo className="h-4 w-4" />
          {showBadge && (
            <span className="pointer-events-none absolute -top-1 -right-1 flex items-center gap-0.5">
              {overdueCount > 0 && (
                <span
                  className={cn(
                    "inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow",
                    "animate-pulse",
                  )}
                >
                  {overdueCount}
                </span>
              )}
              {runningCount > 0 && (
                <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white shadow">
                  {runningCount}
                </span>
              )}
              {imminentExamCount > 0 && (
                <span
                  className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-purple-600 px-1 text-[10px] font-bold text-white shadow"
                  title="Nadcházející zkoušky"
                >
                  {imminentExamCount}
                </span>
              )}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[22rem] p-0 sm:w-96">
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary-600" />
            <h3 className="text-sm font-semibold text-gray-900">Úkoly</h3>
            {activeCount > 0 && (
              <span className="ml-auto text-xs text-gray-500">{activeCount} otevřených</span>
            )}
          </div>
          {activeCount + counts.completed > 0 && (
            <div className="mt-2">
              <TaskStateChips counts={counts} showCompleted={false} />
            </div>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-primary-100/50" />
              ))}
            </div>
          ) : visible.length === 0 && visibleExams.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <ListChecks className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-700">Žádné aktivní úkoly</p>
              <p className="mt-0.5 text-xs text-gray-500">Užijte si chvilku klidu.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.length > 0 && (
                <div className="space-y-1.5">
                  {visible.map(({ task, study }) => (
                    <GlobalTaskRow
                      key={task.id}
                      task={task}
                      study={study}
                      onClick={handleRowClick}
                      compact
                    />
                  ))}
                </div>
              )}

              {visibleExams.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 px-1 pt-1">
                    <CalendarDays className="h-3.5 w-3.5 text-purple-600" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                      Nadcházející zkoušky
                    </span>
                  </div>
                  {visibleExams.map(({ term, study, subject }) => (
                    <button
                      key={term.id}
                      type="button"
                      onClick={() => {
                        if (!study) return
                        setOpen(false)
                        router.push(`/studies/${study.id}`)
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg border border-purple-100 bg-purple-50/40 p-2 text-left transition-colors hover:bg-purple-50"
                    >
                      {study && (
                        <StudyLogo logoUrl={study.logo_url} studyName={study.name} size="sm" className="flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Lock className="h-3 w-3 flex-shrink-0 text-purple-500" />
                          <span className="truncate text-sm font-medium text-gray-900">
                            {subject ? (subject.abbreviation || subject.name) : "Zkouška"}
                          </span>
                          {term.is_online && <Monitor className="h-3 w-3 flex-shrink-0 text-green-600" />}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatExamDate(term.date)} · {(term.start_time || "").substring(0, 5)}
                          </span>
                          {study && <span className="truncate text-gray-400">• {study.name}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                  {hiddenExamCount > 0 && (
                    <p className="px-1 text-xs text-gray-400">+ {hiddenExamCount} dalších zkoušek</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
          <span className="text-xs text-gray-500">
            {hiddenCount > 0 ? `+ ${hiddenCount} dalších` : " "}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShowAll}
            className="text-primary-700 hover:bg-primary-50"
          >
            Zobrazit všechny
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
