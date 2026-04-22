"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { CalendarClock, Clock } from "lucide-react"
import { toggleTaskCompleteAction } from "@/lib/actions/tasks"
import { TASK_STATE_CONFIG, getTaskState, todayLocalIso, type Task, type TaskState } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface TaskCardProps {
  task: Task
  onEdit: (_task: Task) => void
  onChange: () => void
}

function formatCzechDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })
}

function duePillText(task: Task, state: TaskState, today: string): string {
  if (state === "completed") {
    if (task.completed_at) {
      const completed = new Date(task.completed_at).toLocaleDateString("cs-CZ", {
        day: "numeric",
        month: "numeric",
      })
      return `Dokončeno ${completed}`
    }
    return "Dokončeno"
  }

  const deadlineDate = new Date(`${task.deadline}T00:00:00`)
  const todayDate = new Date(`${today}T00:00:00`)
  const diffMs = deadlineDate.getTime() - todayDate.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (state === "overdue") {
    const n = Math.abs(diffDays)
    return `${n} ${czDayWord(n)} po termínu`
  }

  if (diffDays === 0) return `dnes · ${formatCzechDate(task.deadline)}`
  if (diffDays === 1) return `zítra · ${formatCzechDate(task.deadline)}`
  return `za ${diffDays} ${czDayWord(diffDays)} · ${formatCzechDate(task.deadline)}`
}

function czDayWord(n: number): string {
  if (n === 1) return "den"
  if (n >= 2 && n <= 4) return "dny"
  return "dní"
}

export function TaskCard({ task, onEdit, onChange }: TaskCardProps) {
  const [optimisticCompleted, setOptimisticCompleted] = useState<boolean | null>(null)
  const today = todayLocalIso()

  const effectiveCompletedAt = optimisticCompleted === null
    ? task.completed_at
    : (optimisticCompleted ? new Date().toISOString() : null)

  const state = getTaskState({ ...task, completed_at: effectiveCompletedAt }, today)
  const config = TASK_STATE_CONFIG[state]
  const isCompleted = state === "completed"

  const handleToggle = async (checked: boolean | "indeterminate") => {
    const next = checked === true
    setOptimisticCompleted(next)
    const { error } = await toggleTaskCompleteAction(task.id, next)
    if (error) {
      setOptimisticCompleted(null)
      return
    }
    onChange()
    setOptimisticCompleted(null)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onEdit(task)
        }
      }}
      className={cn(
        "group relative flex gap-3 rounded-xl border p-4 shadow-sm transition-all",
        "hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
        config.cardClass,
        isCompleted && "opacity-80"
      )}
    >
      <div
        className="pt-1 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isCompleted}
          onCheckedChange={handleToggle}
          className={cn(
            "h-5 w-5 rounded-md border-2",
            state === "overdue" && "border-red-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500",
            state === "running" && "border-amber-400 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500",
            state === "upcoming" && "border-primary-300",
            state === "completed" && "border-green-400 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
          )}
          aria-label={isCompleted ? "Označit jako nesplněné" : "Označit jako splněné"}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <h3
            className={cn(
              "text-sm font-semibold leading-tight text-gray-900 sm:text-base",
              isCompleted && "line-through text-gray-500"
            )}
          >
            {task.title}
          </h3>

          <span
            className={cn(
              "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
              config.badgeClass
            )}
          >
            <Clock className="h-3 w-3" />
            {duePillText(task, state, today)}
          </span>
        </div>

        {task.description && (
          <p className={cn(
            "mt-1 text-sm text-gray-600 line-clamp-2",
            isCompleted && "text-gray-400"
          )}>
            {task.description}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={cn("h-5 gap-1 border px-2 py-0 text-xs font-medium", config.badgeClass)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
            {config.label}
          </Badge>
          {task.start_date && (
            <Badge variant="outline" className="h-5 gap-1 border-gray-200 bg-white px-2 py-0 text-xs font-normal text-gray-600">
              <CalendarClock className="h-3 w-3" />
              od {formatCzechDate(task.start_date)}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
