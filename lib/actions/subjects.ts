"use server"

import * as db from "@/lib/mongodb/db"

export async function fetchSubjectsByStudyId(studyId: string) {
  const docs = await db.getSubjectsByStudyId(studyId)
  return db.normalizeIds(docs)
}

export async function fetchSubject(id: string) {
  const doc = await db.getSubjectById(id)
  return db.normalizeId(doc)
}

export async function fetchSubjectsByIds(ids: string[]) {
  const docs = await db.getSubjectsByIds(ids)
  return db.normalizeIds(docs)
}

export async function fetchSubjectsForRepeatSelection(studyId: string, excludeId?: string) {
  const docs = await db.getSubjectsForRepeatSelection(studyId, excludeId)
  return db.normalizeIds(docs)
}

export async function fetchRepeatRootId(subjectId: string) {
  return db.getRepeatRootId(subjectId)
}

export async function createSubject(data: Record<string, any>) {
  try {
    const doc = await db.createSubject(data)
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    if (err?.code === 11000) {
      return { data: null, error: { code: "23505", message: "Duplicate entry" } }
    }
    return { data: null, error: { code: "UNKNOWN", message: err?.message || "Unknown error" } }
  }
}

export async function updateSubject(id: string, data: Record<string, any>) {
  try {
    await db.updateSubject(id, data)
    return { error: null }
  } catch (err: any) {
    if (err?.code === 11000) {
      return { error: { code: "23505", message: "Duplicate entry" } }
    }
    return { error: { code: "UNKNOWN", message: err?.message || "Unknown error" } }
  }
}

export async function deleteSubjectAction(id: string) {
  try {
    await db.deleteSubject(id)
    return { error: null }
  } catch (err: any) {
    return { error: { code: "UNKNOWN", message: err?.message || "Unknown error" } }
  }
}

export async function fetchDepartments(studyId: string) {
  return db.getDepartmentsByStudyId(studyId)
}
