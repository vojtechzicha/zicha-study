"use server"

import * as db from "@/lib/mongodb/db"
import { cleanupEmptyCacheDirectories, deleteCacheFile } from "@/lib/utils/onedrive-cache"

export async function fetchStudyNotes(studyId: string, publicOnly = false) {
  const docs = await db.getStudyNotesByStudyId(studyId, publicOnly)
  return db.normalizeIds(docs)
}

export async function fetchStudyNotesBySubjectId(subjectId: string) {
  const docs = await db.getStudyNotesBySubjectId(subjectId)
  return db.normalizeIds(docs)
}

export async function fetchStudyNotesByFinalExamId(finalExamId: string) {
  const docs = await db.getStudyNotesByFinalExamId(finalExamId)
  return db.normalizeIds(docs)
}

export async function createStudyNote(data: Record<string, any>) {
  try {
    const doc = await db.createStudyNote(data)
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Unknown error" } }
  }
}

export async function updateStudyNoteAction(id: string, data: Record<string, any>) {
  try {
    await db.updateStudyNote(id, data)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function deleteStudyNoteAction(id: string) {
  try {
    const note = await db.getStudyNoteById(id)
    await deleteCacheFile(note?.cache_onedrive_id as string | null | undefined)
    if (note?.study_id) {
      await cleanupEmptyCacheDirectories(note.study_id as string)
    }

    await db.deleteStudyNote(id)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function checkStudyNoteSlug(slug: string, studyId: string, excludeId?: string) {
  return db.checkStudyNoteSlugAvailability(slug, studyId, excludeId)
}

export async function checkNoteSlugGlobal(slug: string, excludeId?: string) {
  return db.checkNoteSlugGlobalAvailability(slug, excludeId)
}

export async function linkSubjectToNoteAction(noteId: string, subjectId: string, isPrimary = false) {
  await db.linkSubjectToNote(noteId, subjectId, isPrimary)
}

export async function unlinkSubjectFromNoteAction(noteId: string, subjectId: string) {
  await db.unlinkSubjectFromNote(noteId, subjectId)
}

export async function linkFinalExamToNoteAction(noteId: string, finalExamId: string, isPrimary = false) {
  await db.linkFinalExamToNote(noteId, finalExamId, isPrimary)
}

export async function unlinkFinalExamFromNoteAction(noteId: string, finalExamId: string) {
  await db.unlinkFinalExamFromNote(noteId, finalExamId)
}

export async function fetchLinkedSubjectIds(noteId: string) {
  return db.getLinkedSubjectIds(noteId)
}

export async function fetchLinkedFinalExamIds(noteId: string) {
  return db.getLinkedFinalExamIds(noteId)
}
