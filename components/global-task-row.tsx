"use client"

import { Clock } from "lucide-react"
import { StudyLogo } from "@/components/study-logo"
import { TASK_STATE_CONFIG, getTaskState, todayLocalIso, type Task } from "@/lib/constants"
import { duePillText } from "@/lib/utils/task-format"
import { cn } from "@/lib/utils"

interface GlobalTaskRowProps {
  task: Task
  study: { id: string; name: string; logo_url: string | null }
  onClick: (_task: Task, _studyId: string) => void
  compact?: boolean
}

export function GlobalTaskRow({ task, study, onClick, compact = false }: GlobalTaskRowProps) {
  const today = todayLocalIso()
  const state = getTaskState(task, today)
  const config = TASK_STATE_CONFIG[state]
  const isCompleted = state === "completed"

  const fullPill = duePillText(task, state, today)
  // In compact mode (popover), drop the trailing "· DATE" portion to free up width for the title.
  const pillText = compact ? fullPill.split(" · ")[0] : fullPill

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(task, study.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick(task, study.id)
        }
      }}
      className={cn(
        "group flex items-start gap-2.5 rounded-lg border bg-white px-2.5 py-2 transition-all cursor-pointer",
        "hover:shadow-sm hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
        state === "overdue" && "border-red-200 bg-red-50/40",
        state === "running" && "border-amber-200",
        state === "upcoming" && "border-primary-200",
        state === "completed" && "border-green-200 bg-green-50/30 opacity-80",
      )}
    >
      <StudyLogo
        logoUrl={study.logo_url}
        studyName={study.name}
        size="sm"
        className="mt-0.5 flex-shrink-0"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={cn(
              "text-sm font-medium leading-snug text-gray-900 line-clamp-2",
              isCompleted && "line-through text-gray-500",
            )}
          >
            <span className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle", config.dotClass)} />
            {task.title}
          </h4>
          <span
            className={cn(
              "inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[11px] font-medium leading-none",
              config.badgeClass,
            )}
          >
            <Clock className="h-3 w-3" />
            {pillText}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-gray-500">{study.name}</p>
      </div>
    </div>
  )
}
