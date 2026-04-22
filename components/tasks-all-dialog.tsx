"use client"

import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { TaskCard } from "@/components/task-card"
import {
  TASK_STATE,
  TASK_STATE_CONFIG,
  getTaskState,
  todayLocalIso,
  type Task,
  type TaskState,
} from "@/lib/constants"
import { cn } from "@/lib/utils"

interface TasksAllDialogProps {
  tasks: Task[]
  onClose: () => void
  onEdit: (_task: Task) => void
  onChange: () => void
}

const GROUP_ORDER: TaskState[] = [
  TASK_STATE.OVERDUE,
  TASK_STATE.RUNNING,
  TASK_STATE.UPCOMING,
  TASK_STATE.COMPLETED,
]

export function TasksAllDialog({ tasks, onClose, onEdit, onChange }: TasksAllDialogProps) {
  const [collapsedCompleted, setCollapsedCompleted] = useState(true)

  const today = todayLocalIso()

  const grouped = useMemo(() => {
    const map: Record<TaskState, Task[]> = {
      overdue: [],
      running: [],
      upcoming: [],
      completed: [],
    }
    for (const t of tasks) {
      map[getTaskState(t, today)].push(t)
    }
    map.overdue.sort((a, b) => a.deadline.localeCompare(b.deadline))
    map.running.sort((a, b) => a.deadline.localeCompare(b.deadline))
    map.upcoming.sort((a, b) => (a.start_date || a.deadline).localeCompare(b.start_date || b.deadline))
    map.completed.sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""))
    return map
  }, [tasks, today])

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-lg font-bold text-gray-900">
            Všechny úkoly
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(85vh-4rem)] overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {GROUP_ORDER.map((state) => {
              const items = grouped[state]
              if (items.length === 0) return null
              const config = TASK_STATE_CONFIG[state]
              const isCompletedGroup = state === TASK_STATE.COMPLETED
              const isCollapsed = isCompletedGroup && collapsedCompleted

              return (
                <section key={state}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", config.dotClass)} />
                      <h3 className={cn("text-sm font-semibold uppercase tracking-wide", config.accentClass)}>
                        {config.label}
                      </h3>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {items.length}
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
                            !isCollapsed && "rotate-180"
                          )}
                        />
                        {isCollapsed ? "Zobrazit" : "Skrýt"}
                      </Button>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className="space-y-2">
                      {items.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onEdit={onEdit}
                          onChange={onChange}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
