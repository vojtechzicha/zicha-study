"use server"

import * as db from "@/lib/mongodb/db"
import { getSessionUser, requireUser } from "@/lib/auth-guard"
import { cleanupEmptyCacheDirectories, deleteCacheFile } from "@/lib/utils/onedrive-cache"

// Called by the public study page, so it must work signed out. Anonymous
// callers only get public notes of a published study, whatever they ask for.
export async function fetchStudyNotes(studyId: string, publicOnly = false) {
  if (!(await getSessionUser())) {
    const publicStudyIds = await db.getPublicStudyIds([studyId])
    if (!publicStudyIds.has(studyId)) return []
    publicOnly = true
  }
  const docs = await db.getStudyNotesByStudyId(studyId, publicOnly)
  return db.normalizeIds(docs)
}

export async function fetchStudyNotesBySubjectId(subjectId: string) {
  await requireUser()
  const docs = await db.getStudyNotesBySubjectId(subjectId)
  return db.normalizeIds(docs)
}

export async function fetchStudyNotesByFinalExamId(finalExamId: string) {
  await requireUser()
  const docs = await db.getStudyNotesByFinalExamId(finalExamId)
  return db.normalizeIds(docs)
}

export async function createStudyNote(data: Record<string, any>) {
  try {
    await requireUser()
    const doc = await db.createStudyNote(data)
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Neznámá chyba." } }
  }
}

export async function updateStudyNoteAction(id: string, data: Record<string, any>) {
  try {
    await requireUser()
    await db.updateStudyNote(id, data)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Neznámá chyba." } }
  }
}

export async function deleteStudyNoteAction(id: string) {
  try {
    await requireUser()
    const note = await db.getStudyNoteById(id)
    await deleteCacheFile(note?.cache_onedrive_id as string | null | undefined)
    if (note?.study_id) {
      await cleanupEmptyCacheDirectories(note.study_id as string)
    }

    await db.deleteStudyNote(id)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Neznámá chyba." } }
  }
}

export async function checkStudyNoteSlug(slug: string, studyId: string, excludeId?: string) {
  await requireUser()
  return db.checkStudyNoteSlugAvailability(slug, studyId, excludeId)
}

export async function checkNoteSlugGlobal(slug: string, excludeId?: string) {
  await requireUser()
  return db.checkNoteSlugGlobalAvailability(slug, excludeId)
}

export async function linkSubjectToNoteAction(noteId: string, subjectId: string, isPrimary = false) {
  await requireUser()
  await db.linkSubjectToNote(noteId, subjectId, isPrimary)
}

export async function unlinkSubjectFromNoteAction(noteId: string, subjectId: string) {
  await requireUser()
  await db.unlinkSubjectFromNote(noteId, subjectId)
}

export async function linkFinalExamToNoteAction(noteId: string, finalExamId: string, isPrimary = false) {
  await requireUser()
  await db.linkFinalExamToNote(noteId, finalExamId, isPrimary)
}

export async function unlinkFinalExamFromNoteAction(noteId: string, finalExamId: string) {
  await requireUser()
  await db.unlinkFinalExamFromNote(noteId, finalExamId)
}

export async function fetchLinkedSubjectIds(noteId: string) {
  await requireUser()
  return db.getLinkedSubjectIds(noteId)
}

export async function fetchLinkedFinalExamIds(noteId: string) {
  await requireUser()
  return db.getLinkedFinalExamIds(noteId)
}
