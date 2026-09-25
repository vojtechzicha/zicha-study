"use server"

import * as db from "@/lib/mongodb/db"
import { getSessionUser, requireUser } from "@/lib/auth-guard"

// fetchFinalExams, fetchFinalExamsByIds and fetchFinalExamIdsWithNotes are
// called by the public study page, so they must work signed out. Anonymous
// callers only get final exams of published studies and only count public notes.
export async function fetchFinalExams(studyId: string) {
  if (!(await getSessionUser())) {
    const publicStudyIds = await db.getPublicStudyIds([studyId])
    if (!publicStudyIds.has(studyId)) return []
  }
  const docs = await db.getFinalExamsByStudyId(studyId)
  return db.normalizeIds(docs)
}

export async function fetchFinalExamsByIds(ids: string[]) {
  const docs = await db.getFinalExamsByIds(ids)
  if (!(await getSessionUser())) {
    const publicStudyIds = await db.getPublicStudyIds(docs.map((d) => String(d.study_id)))
    return db.normalizeIds(docs.filter((d) => publicStudyIds.has(String(d.study_id))))
  }
  return db.normalizeIds(docs)
}

export async function createFinalExam(data: Record<string, any>) {
  try {
    await requireUser()
    const doc = await db.createFinalExam(data)
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Unknown error" } }
  }
}

export async function updateFinalExamAction(id: string, data: Record<string, any>) {
  try {
    await requireUser()
    await db.updateFinalExam(id, data)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function deleteFinalExamAction(id: string) {
  try {
    await requireUser()
    await db.deleteFinalExam(id)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function fetchFinalExamIdsWithNotes(examIds: string[]) {
  const signedIn = !!(await getSessionUser())
  const result = await db.getFinalExamIdsWithNotes(examIds, !signedIn)
  return Array.from(result)
}
