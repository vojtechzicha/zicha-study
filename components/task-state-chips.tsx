"use client"

import { TASK_STATE_CONFIG, type TaskState } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface TaskStateChipsProps {
  counts: Record<TaskState, number>
  className?: string
  showCompleted?: boolean
}

const ACTIVE_STATES: TaskState[] = ["overdue", "running", "upcoming"]

export function TaskStateChips({ counts, className, showCompleted = true }: TaskStateChipsProps) {
  const total = ACTIVE_STATES.reduce((sum, s) => sum + counts[s], 0) + counts.completed
  if (total === 0) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {ACTIVE_STATES.map((state) => {
        if (counts[state] === 0) return null
        const config = TASK_STATE_CONFIG[state]
        return (
          <span
            key={state}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              config.badgeClass
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
            {counts[state]} {config.label.toLowerCase()}
          </span>
        )
      })}
      {showCompleted && counts.completed > 0 && (
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          {counts.completed} dokončeno
        </span>
      )}
    </div>
  )
}
