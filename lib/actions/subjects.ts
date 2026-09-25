"use server"

import * as db from "@/lib/mongodb/db"
import { getSessionUser, requireUser } from "@/lib/auth-guard"

export async function fetchSubjectsByStudyId(studyId: string) {
  await requireUser()
  const docs = await db.getSubjectsByStudyId(studyId)
  return db.normalizeIds(docs)
}

export async function fetchSubject(id: string) {
  await requireUser()
  const doc = await db.getSubjectById(id)
  return db.normalizeId(doc)
}

// Called by the public study page (note links), so it must work signed out.
// Anonymous callers only get subjects of published studies, which that page
// already shows in full.
export async function fetchSubjectsByIds(ids: string[]) {
  const docs = await db.getSubjectsByIds(ids)
  if (!(await getSessionUser())) {
    const publicStudyIds = await db.getPublicStudyIds(docs.map((d) => String(d.study_id)))
    return db.normalizeIds(docs.filter((d) => publicStudyIds.has(String(d.study_id))))
  }
  return db.normalizeIds(docs)
}

export async function fetchSubjectsForRepeatSelection(studyId: string, excludeId?: string) {
  await requireUser()
  const docs = await db.getSubjectsForRepeatSelection(studyId, excludeId)
  return db.normalizeIds(docs)
}

export async function fetchRepeatRootId(subjectId: string) {
  await requireUser()
  return db.getRepeatRootId(subjectId)
}

export async function createSubject(data: Record<string, any>) {
  try {
    await requireUser()
    const doc = await db.createSubject(data)
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    if (err?.code === 11000) {
      return { data: null, error: { code: "23505", message: "Záznam už existuje." } }
    }
    return { data: null, error: { code: "UNKNOWN", message: err?.message || "Neznámá chyba." } }
  }
}

export async function updateSubject(id: string, data: Record<string, any>) {
  try {
    await requireUser()
    await db.updateSubject(id, data)
    return { error: null }
  } catch (err: any) {
    if (err?.code === 11000) {
      return { error: { code: "23505", message: "Záznam už existuje." } }
    }
    return { error: { code: "UNKNOWN", message: err?.message || "Neznámá chyba." } }
  }
}

export async function deleteSubjectAction(id: string) {
  try {
    await requireUser()
    await db.deleteSubject(id)
    return { error: null }
  } catch (err: any) {
    return { error: { code: "UNKNOWN", message: err?.message || "Neznámá chyba." } }
  }
}

export async function fetchDepartments(studyId: string) {
  await requireUser()
  return db.getDepartmentsByStudyId(studyId)
}
