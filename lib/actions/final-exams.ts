"use server"

import * as db from "@/lib/mongodb/db"

export async function fetchFinalExams(studyId: string) {
  const docs = await db.getFinalExamsByStudyId(studyId)
  return db.normalizeIds(docs)
}

export async function fetchFinalExamsByIds(ids: string[]) {
  const docs = await db.getFinalExamsByIds(ids)
  return db.normalizeIds(docs)
}

export async function createFinalExam(data: Record<string, any>) {
  try {
    const doc = await db.createFinalExam(data)
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Unknown error" } }
  }
}

export async function updateFinalExamAction(id: string, data: Record<string, any>) {
  try {
    await db.updateFinalExam(id, data)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function deleteFinalExamAction(id: string) {
  try {
    await db.deleteFinalExam(id)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function fetchFinalExamIdsWithNotes(examIds: string[]) {
  const result = await db.getFinalExamIdsWithNotes(examIds)
  return Array.from(result)
}
