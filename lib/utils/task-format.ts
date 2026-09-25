import type { Task, TaskState } from "@/lib/constants"

export function formatCzechDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })
}

/** Czech plural form: 1 → one, 2–4 → few, 0 and 5+ → many */
export function czPlural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one
  if (n >= 2 && n <= 4) return few
  return many
}

export function czDayWord(n: number): string {
  if (n === 1) return "den"
  if (n >= 2 && n <= 4) return "dny"
  return "dní"
}

export function duePillText(task: Task, state: TaskState, today: string): string {
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
