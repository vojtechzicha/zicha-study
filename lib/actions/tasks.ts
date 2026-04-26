"use server"

import * as db from "@/lib/mongodb/db"

export async function fetchTasks(studyId: string) {
  const docs = await db.getTasksByStudyId(studyId)
  return db.normalizeIds(docs)
}

export async function createTask(data: Record<string, any>) {
  try {
    const doc = await db.createTask(data)
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Unknown error" } }
  }
}

export async function updateTaskAction(id: string, data: Record<string, any>) {
  try {
    await db.updateTask(id, data)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function deleteTaskAction(id: string) {
  try {
    await db.deleteTask(id)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function toggleTaskCompleteAction(id: string, completed: boolean) {
  try {
    await db.updateTask(id, { completed_at: completed ? new Date().toISOString() : null })
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function fetchAllTasks() {
  const rows = await db.getAllTasksWithStudyMeta()
  return rows.map((r) => ({
    task: db.normalizeId(r.task) as any,
    study: {
      id: String(r.study._id),
      name: r.study.name as string,
      logo_url: (r.study.logo_url as string | null) ?? null,
    },
  }))
}

export async function fetchTasksEnabledStudies() {
  const docs = await db.getTasksEnabledStudies()
  return db.normalizeIds(docs)
}
