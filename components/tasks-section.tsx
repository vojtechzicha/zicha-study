"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, ListChecks, ChevronRight, AlertCircle } from "lucide-react"
import { fetchTasks } from "@/lib/actions/tasks"
import { TaskCard } from "@/components/task-card"
import { TaskDialog } from "@/components/task-dialog"
import { TasksAllDialog } from "@/components/tasks-all-dialog"
import { TaskStateChips } from "@/components/task-state-chips"
import {
  getTaskState,
  todayLocalIso,
  type Task,
  type TaskState,
} from "@/lib/constants"

interface TasksSectionProps {
  studyId: string
}

const VISIBLE_NON_OVERDUE = 3
const HIGHLIGHT_DURATION_MS = 1800

export function TasksSection({ studyId }: TasksSectionProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showAllDialog, setShowAllDialog] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const handledParamsRef = useRef(false)
  const taskRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = (await fetchTasks(studyId)) as Task[]
      setTasks(data || [])
    } catch {
      setError("Nepodařilo se načíst úkoly")
    } finally {
      setLoading(false)
    }
  }, [studyId])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const today = todayLocalIso()

  const { counts, visible, hiddenCount, hiddenIds } = useMemo(() => {
    const grouped: Record<TaskState, Task[]> = {
      overdue: [],
      running: [],
      upcoming: [],
      completed: [],
    }
    for (const t of tasks) {
      grouped[getTaskState(t, today)].push(t)
    }
    grouped.overdue.sort((a, b) => a.deadline.localeCompare(b.deadline))
    grouped.running.sort((a, b) => a.deadline.localeCompare(b.deadline))
    grouped.upcoming.sort((a, b) =>
      (a.start_date || a.deadline).localeCompare(b.start_date || b.deadline)
    )

    const counts: Record<TaskState, number> = {
      overdue: grouped.overdue.length,
      running: grouped.running.length,
      upcoming: grouped.upcoming.length,
      completed: grouped.completed.length,
    }

    const nonOverdue = [...grouped.running, ...grouped.upcoming]
    const visible: Task[] = [
      ...grouped.overdue,
      ...nonOverdue.slice(0, VISIBLE_NON_OVERDUE),
    ]
    const hiddenCount =
      Math.max(0, nonOverdue.length - VISIBLE_NON_OVERDUE) + grouped.completed.length

    const visibleIds = new Set(visible.map((t) => t.id))
    const hiddenIds = new Set(tasks.filter((t) => !visibleIds.has(t.id)).map((t) => t.id))

    return { counts, visible, hiddenCount, hiddenIds }
  }, [tasks, today])

  // Deep-link handling: ?addTask=1 and ?task=<id>
  useEffect(() => {
    if (loading || handledParamsRef.current) return

    const addTaskParam = searchParams.get("addTask")
    const taskParam = searchParams.get("task")
    let handled = false

    if (addTaskParam === "1") {
      setShowAddDialog(true)
      handled = true
    }

    if (taskParam) {
      const target = tasks.find((t) => t.id === taskParam)
      if (target) {
        if (hiddenIds.has(taskParam)) {
          setShowAllDialog(true)
        } else {
          setTimeout(() => {
            const node = taskRefs.current.get(taskParam)
            if (node) node.scrollIntoView({ block: "center", behavior: "smooth" })
          }, 80)
        }
        setHighlightedId(taskParam)
        setTimeout(() => setHighlightedId(null), HIGHLIGHT_DURATION_MS)
        handled = true
      }
    }

    if (handled) {
      handledParamsRef.current = true
      const params = new URLSearchParams(searchParams.toString())
      params.delete("addTask")
      params.delete("task")
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }
  }, [loading, tasks, searchParams, hiddenIds, pathname, router])

  const handleSave = () => {
    setEditingTask(null)
    setShowAddDialog(false)
    loadTasks()
  }

  const setTaskRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) taskRefs.current.set(id, el)
    else taskRefs.current.delete(id)
  }, [])

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary-600" />
                <CardTitle className="text-xl font-bold text-gray-900">Úkoly</CardTitle>
              </div>
              <p className="ml-7 mt-1 text-sm text-gray-600">
                Deadliny, termíny a věci k vyřízení
              </p>
            </div>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
              size="sm"
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Přidat úkol</span>
            </Button>
          </div>

          {tasks.length > 0 && <TaskStateChips counts={counts} className="mt-4" />}
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-primary-100/60" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-6 py-10 text-center">
              <ListChecks className="mx-auto mb-3 h-10 w-10 text-gray-400" />
              <p className="text-sm font-medium text-gray-900">Zatím žádné úkoly</p>
              <p className="mt-1 text-sm text-gray-500">
                Klikněte na „Přidat úkol“ a začněte si evidovat deadliny.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((task) => (
                <TaskCard
                  key={task.id}
                  ref={setTaskRef(task.id)}
                  task={task}
                  onEdit={setEditingTask}
                  onChange={loadTasks}
                  highlighted={highlightedId === task.id}
                />
              ))}
              {hiddenCount > 0 && (
                <div className="pt-2 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllDialog(true)}
                    className="text-gray-700"
                  >
                    Zobrazit všechny ({tasks.length})
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {(showAddDialog || editingTask) && (
        <TaskDialog
          studyId={studyId}
          task={editingTask}
          onClose={() => {
            setShowAddDialog(false)
            setEditingTask(null)
          }}
          onSave={handleSave}
        />
      )}

      {showAllDialog && (
        <TasksAllDialog
          tasks={tasks}
          highlightedId={highlightedId}
          onClose={() => setShowAllDialog(false)}
          onEdit={(task) => {
            setShowAllDialog(false)
            setEditingTask(task)
          }}
          onChange={loadTasks}
        />
      )}
    </>
  )
}
