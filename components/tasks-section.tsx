"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, ListChecks, ChevronRight, AlertCircle } from "lucide-react"
import { TaskCard } from "@/components/task-card"
import { TaskDialog } from "@/components/task-dialog"
import { TasksAllDialog } from "@/components/tasks-all-dialog"
import { TaskStateChips } from "@/components/task-state-chips"
import { todayLocalIso, type Task } from "@/lib/constants"
import { groupTasksForDisplay, getCompletedTasksLabel } from "@/lib/utils/task-utils"

interface TasksSectionProps {
  studyId: string
  tasks: Task[]
  error: string | null
  onReload: () => void
  /** Render as a small stat-style card (used when no task is visible inline) */
  compact?: boolean
}

const HIGHLIGHT_DURATION_MS = 1800

export function TasksSection({ studyId, tasks, error, onReload, compact = false }: TasksSectionProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const today = todayLocalIso()

  const { counts, visible, hiddenCount, hiddenIds } = useMemo(
    () => groupTasksForDisplay(tasks, today),
    [tasks, today]
  )

  const [editingTask, setEditingTask] = useState<Task | null>(null)
  // Deep links (?addTask=1 and ?task=<id>) are resolved during the initial
  // render — the parent only mounts this section once tasks are loaded
  const [showAddDialog, setShowAddDialog] = useState(() => searchParams.get("addTask") === "1")
  const [highlightedId, setHighlightedId] = useState<string | null>(() => {
    const taskParam = searchParams.get("task")
    return taskParam && tasks.some((t) => t.id === taskParam) ? taskParam : null
  })
  const [showAllDialog, setShowAllDialog] = useState(
    () => highlightedId !== null && hiddenIds.has(highlightedId)
  )
  const handledParamsRef = useRef(false)
  const taskRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Deep-link follow-up: scroll to the highlighted task, fade the highlight,
  // and remove the handled params from the URL
  useEffect(() => {
    if (handledParamsRef.current) return
    if (!searchParams.get("addTask") && !searchParams.get("task")) return
    handledParamsRef.current = true

    if (highlightedId) {
      if (!hiddenIds.has(highlightedId)) {
        setTimeout(() => {
          const node = taskRefs.current.get(highlightedId)
          if (node) node.scrollIntoView({ block: "center", behavior: "smooth" })
        }, 80)
      }
      setTimeout(() => setHighlightedId(null), HIGHLIGHT_DURATION_MS)
    }

    const params = new URLSearchParams(searchParams.toString())
    params.delete("addTask")
    params.delete("task")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [searchParams, highlightedId, hiddenIds, pathname, router])

  const handleSave = () => {
    setEditingTask(null)
    setShowAddDialog(false)
    onReload()
  }

  const setTaskRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) taskRefs.current.set(id, el)
    else taskRefs.current.delete(id)
  }, [])

  const dialogs = (
    <>
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
          onChange={onReload}
        />
      )}
    </>
  )

  // Compact stat-style card shown in the statistics row when no task is
  // visible inline (nothing overdue, running, or upcoming)
  if (compact) {
    return (
      <>
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Úkoly</CardTitle>
            <ListChecks className="h-4 w-4 text-primary-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {counts.completed > 0 ? "Vše hotovo" : "Žádné úkoly"}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {counts.completed > 0
                ? getCompletedTasksLabel(counts.completed)
                : "Zatím žádné deadliny k vyřízení"}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="h-7 px-2 text-xs text-gray-700"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Přidat úkol
              </Button>
              {tasks.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllDialog(true)}
                  className="h-7 px-2 text-xs text-gray-600"
                >
                  Zobrazit vše ({tasks.length})
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {dialogs}
      </>
    )
  }

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

          {tasks.length === 0 ? (
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
                  onChange={onReload}
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

      {dialogs}
    </>
  )
}
