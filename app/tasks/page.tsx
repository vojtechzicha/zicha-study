"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, ChevronDown, ListChecks, Plus, Loader2 } from "lucide-react"
import { fetchAllTasks, fetchTasksEnabledStudies } from "@/lib/actions/tasks"
import { GlobalTaskRow } from "@/components/global-task-row"
import { TaskStateChips } from "@/components/task-state-chips"
import { StudyLogo } from "@/components/study-logo"
import { TitlePageFooter } from "@/components/title-page-footer"
import {
  TASK_STATE,
  TASK_STATE_CONFIG,
  getTaskState,
  todayLocalIso,
  type Task,
  type TaskState,
} from "@/lib/constants"
import { useLogoTheme } from "@/hooks/use-logo-theme"
import { cn } from "@/lib/utils"

interface TaskWithStudy {
  task: Task
  study: { id: string; name: string; logo_url: string | null }
}

interface EnabledStudy {
  id: string
  name: string
  logo_url?: string | null
}

const GROUP_ORDER: TaskState[] = [
  TASK_STATE.OVERDUE,
  TASK_STATE.RUNNING,
  TASK_STATE.UPCOMING,
  TASK_STATE.COMPLETED,
]

export default function TasksPage() {
  const router = useRouter()
  const { status } = useSession()
  const [items, setItems] = useState<TaskWithStudy[]>([])
  const [studies, setStudies] = useState<EnabledStudy[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsedCompleted, setCollapsedCompleted] = useState(true)

  useLogoTheme(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksData, studiesData] = await Promise.all([
        fetchAllTasks(),
        fetchTasksEnabledStudies(),
      ])
      setItems(tasksData as TaskWithStudy[])
      setStudies(studiesData as EnabledStudy[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") load()
  }, [status, load])

  const today = todayLocalIso()

  const { counts, grouped, perStudyActive } = useMemo(() => {
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
    grouped.completed.sort((a, b) =>
      (b.task.completed_at || "").localeCompare(a.task.completed_at || ""),
    )

    const counts: Record<TaskState, number> = {
      overdue: grouped.overdue.length,
      running: grouped.running.length,
      upcoming: grouped.upcoming.length,
      completed: grouped.completed.length,
    }

    const perStudyActive = new Map<string, number>()
    for (const state of ["overdue", "running", "upcoming"] as const) {
      for (const it of grouped[state]) {
        perStudyActive.set(it.study.id, (perStudyActive.get(it.study.id) || 0) + 1)
      }
    }

    return { counts, grouped, perStudyActive }
  }, [items, today])

  const handleRowClick = (task: Task, studyId: string) => {
    router.push(`/studies/${studyId}?task=${task.id}`)
  }

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  const totalActive = counts.overdue + counts.running + counts.upcoming
  const noTasksAtAll = totalActive + counts.completed === 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center min-h-16 py-3 gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/")}
              className="text-gray-600 hover:text-gray-900 flex-shrink-0"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zpět
            </Button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <ListChecks className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">Úkoly</h1>
                <p className="text-sm text-gray-600">Souhrn napříč všemi studii</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {totalActive + counts.completed > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="py-4">
              <TaskStateChips counts={counts} />
            </CardContent>
          </Card>
        )}

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="py-6">
            {noTasksAtAll ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-6 py-12 text-center">
                <ListChecks className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                <p className="text-sm font-medium text-gray-900">Zatím žádné úkoly</p>
                <p className="mt-1 text-sm text-gray-500">
                  Otevřete některé studium níže a přidejte první úkol.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {GROUP_ORDER.map((state) => {
                  const list = grouped[state]
                  if (list.length === 0) return null
                  const config = TASK_STATE_CONFIG[state]
                  const isCompletedGroup = state === TASK_STATE.COMPLETED
                  const isCollapsed = isCompletedGroup && collapsedCompleted

                  return (
                    <section key={state}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", config.dotClass)} />
                          <h3
                            className={cn(
                              "text-sm font-semibold uppercase tracking-wide",
                              config.accentClass,
                            )}
                          >
                            {config.label}
                          </h3>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {list.length}
                          </span>
                        </div>
                        {isCompletedGroup && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setCollapsedCompleted(!collapsedCompleted)}
                            className="h-7 text-xs text-gray-600"
                          >
                            <ChevronDown
                              className={cn(
                                "mr-1 h-4 w-4 transition-transform",
                                !isCollapsed && "rotate-180",
                              )}
                            />
                            {isCollapsed ? "Zobrazit" : "Skrýt"}
                          </Button>
                        )}
                      </div>
                      {!isCollapsed && (
                        <div className="space-y-2">
                          {list.map(({ task, study }) => (
                            <GlobalTaskRow
                              key={task.id}
                              task={task}
                              study={study}
                              onClick={handleRowClick}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Studia s úkoly</h2>
            <span className="text-sm text-gray-500">
              {studies.length === 0 ? "žádné" : `${studies.length}`}
            </span>
          </div>

          {studies.length === 0 ? (
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="py-10 text-center">
                <p className="text-sm font-medium text-gray-900">
                  Žádné studium nemá zapnuté úkoly
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Zapněte úkoly v nastavení studia, abyste mohli evidovat deadliny.
                </p>
                <Button
                  onClick={() => router.push("/")}
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  Přejít na seznam studií
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {studies.map((study) => {
                const active = perStudyActive.get(study.id) || 0
                return (
                  <Card
                    key={study.id}
                    onClick={() => router.push(`/studies/${study.id}`)}
                    className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer group"
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <StudyLogo
                        logoUrl={study.logo_url}
                        studyName={study.name}
                        size="md"
                        className="flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                          {study.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {active === 0 ? "žádné aktivní úkoly" : `${active} aktivních`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/studies/${study.id}?addTask=1`)
                        }}
                        className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white flex-shrink-0"
                      >
                        <Plus className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Přidat</span>
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      </main>

      <TitlePageFooter />
    </div>
  )
}
