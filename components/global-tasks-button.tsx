"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ListTodo, ChevronRight, ListChecks } from "lucide-react"
import { fetchAllTasks } from "@/lib/actions/tasks"
import { GlobalTaskRow } from "@/components/global-task-row"
import { TaskStateChips } from "@/components/task-state-chips"
import { getTaskState, todayLocalIso, type Task, type TaskState } from "@/lib/constants"
import { cn } from "@/lib/utils"

const POPOVER_VISIBLE_NON_OVERDUE = 5

interface TaskWithStudy {
  task: Task
  study: { id: string; name: string; logo_url: string | null }
}

export function GlobalTasksButton() {
  const [items, setItems] = useState<TaskWithStudy[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAllTasks()
      setItems(data as TaskWithStudy[])
    } catch {
      setItems([])
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
  const showBadge = runningCount > 0 || overdueCount > 0

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
          ) : visible.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <ListChecks className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-700">Žádné aktivní úkoly</p>
              <p className="mt-0.5 text-xs text-gray-500">Užijte si chvilku klidu.</p>
            </div>
          ) : (
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
