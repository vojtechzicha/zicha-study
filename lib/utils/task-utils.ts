/**
 * Task Utility Functions
 *
 * Centralized logic for deciding which tasks the study detail shows inline
 * and which stay behind the "Zobrazit všechny" dialog.
 */

import { getTaskState, type Task, type TaskState } from '@/lib/constants'

/** How many non-overdue (running/upcoming) tasks are shown inline */
export const VISIBLE_NON_OVERDUE = 3

export interface TaskDisplayGroups {
  counts: Record<TaskState, number>
  /** Tasks rendered inline: all overdue plus the first few running/upcoming */
  visible: Task[]
  /** Number of tasks only reachable through the "show all" dialog */
  hiddenCount: number
  hiddenIds: Set<string>
}

/**
 * Group tasks for the study detail view. All overdue tasks are always
 * visible; running/upcoming tasks are capped at VISIBLE_NON_OVERDUE and
 * completed tasks are never shown inline.
 */
export function groupTasksForDisplay(tasks: Task[], today: string): TaskDisplayGroups {
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
}

/** Czech label for the number of completed tasks, e.g. "2 dokončené úkoly" */
export function getCompletedTasksLabel(count: number): string {
  if (count === 1) return '1 dokončený úkol'
  if (count >= 2 && count <= 4) return `${count} dokončené úkoly`
  return `${count} dokončených úkolů`
}
