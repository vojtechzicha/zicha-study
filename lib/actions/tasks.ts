"use server"

import * as db from "@/lib/mongodb/db"
import { requireUser } from "@/lib/auth-guard"

export async function fetchTasks(studyId: string) {
  await requireUser()
  const docs = await db.getTasksByStudyId(studyId)
  return db.normalizeIds(docs)
}

export async function createTask(data: Record<string, any>) {
  try {
    await requireUser()
    const doc = await db.createTask(data)
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Nepodařilo se vytvořit úkol." } }
  }
}

export async function updateTaskAction(id: string, data: Record<string, any>) {
  try {
    await requireUser()
    await db.updateTask(id, data)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Nepodařilo se uložit úkol." } }
  }
}

export async function deleteTaskAction(id: string) {
  try {
    await requireUser()
    await db.deleteTask(id)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Nepodařilo se smazat úkol." } }
  }
}

export async function toggleTaskCompleteAction(id: string, completed: boolean) {
  try {
    await requireUser()
    await db.updateTask(id, { completed_at: completed ? new Date().toISOString() : null })
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Nepodařilo se uložit úkol." } }
  }
}

export async function fetchAllTasks() {
  await requireUser()
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
  await requireUser()
  const docs = await db.getTasksEnabledStudies()
  return db.normalizeIds(docs)
}
