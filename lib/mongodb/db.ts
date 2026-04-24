import { getDb } from "./connection"
import { type Filter, Binary } from "mongodb"
import crypto from "crypto"

// ─── Helpers ────────────────────────────────────────────────────────────────

function newId(): string {
  return crypto.randomUUID()
}

function col(name: string) {
  return getDb().then((db) => db.collection(name))
}

// ─── Studies ────────────────────────────────────────────────────────────────

export async function getStudies() {
  const c = await col("studies")
  return c.find().toArray()
}

export async function getStudyById(id: string) {
  const c = await col("studies")
  return c.findOne({ _id: id as any })
}

export async function getStudyBySlug(slug: string) {
  const c = await col("studies")
  return c.findOne({ public_slug: slug, is_public: true })
}

export async function getStudyBySlugMetadata(slug: string, fields: Record<string, 1>) {
  const c = await col("studies")
  return c.findOne({ public_slug: slug, is_public: true }, { projection: fields })
}

export async function createStudy(data: Record<string, any>) {
  const c = await col("studies")
  const doc = { _id: newId() as any, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  await c.insertOne(doc)
  return doc
}

export async function updateStudy(id: string, data: Record<string, any>) {
  const c = await col("studies")
  await c.updateOne({ _id: id as any }, { $set: { ...data, updated_at: new Date().toISOString() } })
}

export async function deleteStudy(id: string) {
  // Cascade: delete all related data
  const db = await getDb()

  // Get study notes for this study to cascade media/cache
  const studyNotes = await db.collection("study_notes").find({ study_id: id }).toArray()
  const noteIds = studyNotes.map((n) => n._id)
  const subjects = await db.collection("subjects").find({ study_id: id }).toArray()
  const subjectIds = subjects.map((s) => s._id)

  if (noteIds.length > 0) {
    // Delete study notes cache and media
    const caches = await db.collection("study_notes_cache").find({ study_note_id: { $in: noteIds } }).toArray()
    const cacheIds = caches.map((c) => c._id)
    if (cacheIds.length > 0) {
      await db.collection("study_notes_media").deleteMany({ cache_id: { $in: cacheIds } })
    }
    await db.collection("study_notes_cache").deleteMany({ study_note_id: { $in: noteIds } })
  }

  await db.collection("study_notes").deleteMany({ study_id: id })
  await db.collection("subjects").deleteMany({ study_id: id })
  await db.collection("final_exams").deleteMany({ study_id: id })
  await db.collection("materials").deleteMany({ study_id: id })
  await db.collection("subject_materials").deleteMany({ study_id: id })
  await db.collection("tasks").deleteMany({ study_id: id })

  // Delete exam options for subjects in this study
  if (subjectIds.length > 0) {
    await db.collection("exam_options").deleteMany({ subject_id: { $in: subjectIds } })
  }

  await db.collection("studies").deleteOne({ _id: id as any })
}

export async function checkStudySlugAvailability(slug: string, excludeId?: string) {
  const c = await col("studies")
  const filter: Filter<any> = { public_slug: slug }
  if (excludeId) {
    filter._id = { $ne: excludeId }
  }
  const existing = await c.findOne(filter)
  return !existing
}

export async function getStudiesWithPublicSlug() {
  const c = await col("studies")
  return c.find({ public_slug: { $ne: null } }).sort({ created_at: -1 }).toArray()
}

// ─── Subjects ───────────────────────────────────────────────────────────────

export async function getSubjectsByStudyId(studyId: string, sort?: Record<string, 1 | -1>) {
  const c = await col("subjects")
  return c.find({ study_id: studyId }).sort(sort || { semester: 1 }).toArray()
}

export async function getSubjectById(id: string) {
  const c = await col("subjects")
  return c.findOne({ _id: id as any })
}

export async function getSubjectsByIds(ids: string[]) {
  const c = await col("subjects")
  return c.find({ _id: { $in: ids as any[] } }).toArray()
}

export async function getSubjectsForRepeatSelection(studyId: string, excludeId?: string) {
  const c = await col("subjects")
  const filter: Filter<any> = { study_id: studyId, is_repeat: false }
  if (excludeId) {
    filter._id = { $ne: excludeId }
  }
  return c.find(filter, {
    projection: { _id: 1, name: 1, abbreviation: 1, semester: 1, subject_type: 1, completed: 1, planned: 1 }
  }).toArray()
}

export async function createSubject(data: Record<string, any>) {
  const c = await col("subjects")
  const doc = { _id: newId() as any, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  await c.insertOne(doc)
  return doc
}

export async function updateSubject(id: string, data: Record<string, any>) {
  const c = await col("subjects")
  await c.updateOne({ _id: id as any }, { $set: { ...data, updated_at: new Date().toISOString() } })
}

export async function deleteSubject(id: string) {
  const db = await getDb()
  // Delete exam options for this subject
  await db.collection("exam_options").deleteMany({ subject_id: id })
  await db.collection("subjects").deleteOne({ _id: id as any })
}

export async function deleteSubjectsByStudyId(studyId: string) {
  const c = await col("subjects")
  await c.deleteMany({ study_id: studyId })
}

export async function getDepartmentsByStudyId(studyId: string) {
  const c = await col("subjects")
  const results = await c.distinct("department", {
    study_id: studyId,
    department: { $nin: [null, ""] } as any
  })
  return results.filter((d: any) => d && d !== "").sort((a: string, b: string) => a.localeCompare(b, "cs"))
}

// ─── Final Exams ────────────────────────────────────────────────────────────

export async function getFinalExamsByStudyId(studyId: string) {
  const c = await col("final_exams")
  return c.find({ study_id: studyId }).sort({ created_at: 1 }).toArray()
}

export async function getFinalExamById(id: string) {
  const c = await col("final_exams")
  return c.findOne({ _id: id as any })
}

export async function getFinalExamsByIds(ids: string[]) {
  const c = await col("final_exams")
  return c.find({ _id: { $in: ids as any[] } }).toArray()
}

export async function createFinalExam(data: Record<string, any>) {
  const c = await col("final_exams")
  const doc = { _id: newId() as any, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  await c.insertOne(doc)
  return doc
}

export async function updateFinalExam(id: string, data: Record<string, any>) {
  const c = await col("final_exams")
  await c.updateOne({ _id: id as any }, { $set: { ...data, updated_at: new Date().toISOString() } })
}

export async function deleteFinalExam(id: string) {
  const c = await col("final_exams")
  await c.deleteOne({ _id: id as any })
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export async function getTasksByStudyId(studyId: string) {
  const c = await col("tasks")
  return c.find({ study_id: studyId }).sort({ deadline: 1, created_at: 1 }).toArray()
}

export async function getTaskById(id: string) {
  const c = await col("tasks")
  return c.findOne({ _id: id as any })
}

export async function createTask(data: Record<string, any>) {
  const c = await col("tasks")
  const doc = { _id: newId() as any, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  await c.insertOne(doc)
  return doc
}

export async function updateTask(id: string, data: Record<string, any>) {
  const c = await col("tasks")
  await c.updateOne({ _id: id as any }, { $set: { ...data, updated_at: new Date().toISOString() } })
}

export async function deleteTask(id: string) {
  const c = await col("tasks")
  await c.deleteOne({ _id: id as any })
}

// ─── Materials ──────────────────────────────────────────────────────────────

export async function getMaterialsByStudyId(studyId: string) {
  const c = await col("materials")
  return c.find({ study_id: studyId }).sort({ created_at: -1 }).toArray()
}

export async function getPublicMaterialsByStudyId(studyId: string) {
  const c = await col("materials")
  return c.find({ study_id: studyId, is_public: true }).sort({ created_at: -1 }).toArray()
}

export async function getMaterialBySlug(studyId: string, slug: string) {
  const c = await col("materials")
  return c.findOne({ study_id: studyId, public_slug: slug, is_public: true })
}

export async function getMaterialById(id: string) {
  const c = await col("materials")
  return c.findOne({ _id: id as any })
}

export async function createMaterial(data: Record<string, any>) {
  const c = await col("materials")
  const doc = { _id: newId() as any, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  await c.insertOne(doc)
  return doc
}

export async function updateMaterial(id: string, data: Record<string, any>) {
  const c = await col("materials")
  await c.updateOne({ _id: id as any }, { $set: { ...data, updated_at: new Date().toISOString() } })
}

export async function deleteMaterial(id: string) {
  const c = await col("materials")
  await c.deleteOne({ _id: id as any })
}

export async function checkMaterialSlugAvailability(studyId: string, slug: string, excludeId?: string) {
  const db = await getDb()
  const filter: Filter<any> = { study_id: studyId, public_slug: slug }
  if (excludeId) filter._id = { $ne: excludeId }

  const [mat, subMat] = await Promise.all([
    db.collection("materials").findOne(filter),
    db.collection("subject_materials").findOne({ study_id: studyId, public_slug: slug })
  ])
  return !mat && !subMat
}

// ─── Subject Materials ──────────────────────────────────────────────────────

export async function getSubjectMaterialBySlug(studyId: string, slug: string) {
  const c = await col("subject_materials")
  return c.findOne({ study_id: studyId, public_slug: slug, is_public: true })
}

export async function getSubjectMaterialById(id: string) {
  const c = await col("subject_materials")
  return c.findOne({ _id: id as any })
}

export async function createSubjectMaterial(data: Record<string, any>) {
  const c = await col("subject_materials")
  const doc = { _id: newId() as any, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  await c.insertOne(doc)
  return doc
}

export async function getSubjectMaterialsBySubjectId(subjectId: string) {
  const c = await col("subject_materials")
  return c.find({ subject_id: subjectId }).sort({ created_at: -1 }).toArray()
}

export async function deleteSubjectMaterial(id: string) {
  const c = await col("subject_materials")
  await c.deleteOne({ _id: id as any })
}

export async function updateSubjectMaterial(id: string, data: Record<string, any>) {
  const c = await col("subject_materials")
  await c.updateOne({ _id: id as any }, { $set: { ...data, updated_at: new Date().toISOString() } })
}

export async function checkSubjectMaterialSlugAvailability(studyId: string, slug: string, excludeId?: string) {
  const db = await getDb()
  const smFilter: Filter<any> = { study_id: studyId, public_slug: slug }
  if (excludeId) smFilter._id = { $ne: excludeId }

  const [subMat, mat, note] = await Promise.all([
    db.collection("subject_materials").findOne(smFilter),
    db.collection("materials").findOne({ study_id: studyId, public_slug: slug }),
    db.collection("study_notes").findOne({ study_id: studyId, public_slug: slug })
  ])
  return !subMat && !mat && !note
}

// ─── Study Notes ────────────────────────────────────────────────────────────

export async function getStudyNotesByStudyId(studyId: string, publicOnly = false) {
  const c = await col("study_notes")
  const filter: Filter<any> = { study_id: studyId }
  if (publicOnly) filter.is_public = true
  return c.find(filter).sort({ last_modified_onedrive: -1 }).toArray()
}

export async function getStudyNoteById(id: string) {
  const c = await col("study_notes")
  return c.findOne({ _id: id as any })
}

export async function getStudyNoteBySlug(slug: string, studyId?: string) {
  const c = await col("study_notes")
  const filter: Filter<any> = { public_slug: slug }
  if (studyId) filter.study_id = studyId
  return c.findOne(filter)
}

export async function getPublicStudyNoteBySlug(slug: string, studyId?: string) {
  const c = await col("study_notes")
  const filter: Filter<any> = { public_slug: slug, is_public: true }
  if (studyId) filter.study_id = studyId
  return c.findOne(filter)
}

export async function createStudyNote(data: Record<string, any>) {
  const c = await col("study_notes")
  const doc = {
    _id: newId() as any,
    ...data,
    linked_subjects: data.linked_subjects || [],
    linked_final_exams: data.linked_final_exams || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  await c.insertOne(doc)
  return doc
}

export async function updateStudyNote(id: string, data: Record<string, any>) {
  const c = await col("study_notes")
  await c.updateOne({ _id: id as any }, { $set: { ...data, updated_at: new Date().toISOString() } })
}

export async function deleteStudyNote(id: string) {
  const db = await getDb()
  // Cascade: delete cache and media
  const cache = await db.collection("study_notes_cache").findOne({ study_note_id: id })
  if (cache) {
    await db.collection("study_notes_media").deleteMany({ cache_id: cache._id })
    await db.collection("study_notes_cache").deleteOne({ _id: cache._id })
  }
  await db.collection("study_notes").deleteOne({ _id: id as any })
}

export async function checkStudyNoteSlugAvailability(slug: string, studyId: string, excludeId?: string) {
  const db = await getDb()
  const noteFilter: Filter<any> = { study_id: studyId, public_slug: slug }
  if (excludeId) noteFilter._id = { $ne: excludeId }

  const [note, mat, subMat] = await Promise.all([
    db.collection("study_notes").findOne(noteFilter),
    db.collection("materials").findOne({ study_id: studyId, public_slug: slug }),
    db.collection("subject_materials").findOne({ study_id: studyId, public_slug: slug })
  ])
  return !note && !mat && !subMat
}

// Slug availability check across all note tables (global)
export async function checkNoteSlugGlobalAvailability(slug: string, excludeId?: string) {
  const c = await col("study_notes")
  const filter: Filter<any> = { public_slug: slug }
  if (excludeId) filter._id = { $ne: excludeId }
  const existing = await c.findOne(filter)
  return !existing
}

// ─── Study Notes: Linked Subjects (denormalized) ───────────────────────────

export async function linkSubjectToNote(noteId: string, subjectId: string, isPrimary = false) {
  const c = await col("study_notes")
  await c.updateOne(
    { _id: noteId as any },
    {
      $push: {
        linked_subjects: {
          subject_id: subjectId,
          is_primary: isPrimary,
          linked_at: new Date().toISOString(),
          linked_by: null
        }
      } as any
    }
  )
}

export async function unlinkSubjectFromNote(noteId: string, subjectId: string) {
  const c = await col("study_notes")
  await c.updateOne(
    { _id: noteId as any },
    { $pull: { linked_subjects: { subject_id: subjectId } } as any }
  )
}

export async function linkFinalExamToNote(noteId: string, finalExamId: string, isPrimary = false) {
  const c = await col("study_notes")
  await c.updateOne(
    { _id: noteId as any },
    {
      $push: {
        linked_final_exams: {
          final_exam_id: finalExamId,
          is_primary: isPrimary,
          linked_at: new Date().toISOString(),
          linked_by: null
        }
      } as any
    }
  )
}

export async function unlinkFinalExamFromNote(noteId: string, finalExamId: string) {
  const c = await col("study_notes")
  await c.updateOne(
    { _id: noteId as any },
    { $pull: { linked_final_exams: { final_exam_id: finalExamId } } as any }
  )
}

// Replaces RPC: get_subject_study_notes_with_details
export async function getStudyNotesBySubjectId(subjectId: string) {
  const c = await col("study_notes")
  return c.find({ "linked_subjects.subject_id": subjectId }).sort({ created_at: -1 }).toArray()
}

// Replaces RPC: get_final_exam_study_notes
export async function getStudyNotesByFinalExamId(finalExamId: string) {
  const c = await col("study_notes")
  return c.find({ "linked_final_exams.final_exam_id": finalExamId }).sort({ created_at: -1 }).toArray()
}

// Get linked subject IDs for a note
export async function getLinkedSubjectIds(noteId: string) {
  const c = await col("study_notes")
  const note = await c.findOne({ _id: noteId as any }, { projection: { linked_subjects: 1 } })
  return (note?.linked_subjects || []).map((l: any) => l.subject_id)
}

// Get linked final exam IDs for a note
export async function getLinkedFinalExamIds(noteId: string) {
  const c = await col("study_notes")
  const note = await c.findOne({ _id: noteId as any }, { projection: { linked_final_exams: 1 } })
  return (note?.linked_final_exams || []).map((l: any) => l.final_exam_id)
}

// Check which final exams have study notes linked
export async function getFinalExamIdsWithNotes(examIds: string[]) {
  const c = await col("study_notes")
  const results = await c.distinct("linked_final_exams.final_exam_id", {
    "linked_final_exams.final_exam_id": { $in: examIds }
  })
  return new Set(results as string[])
}

// ─── Study Notes Cache ──────────────────────────────────────────────────────

export async function getStudyNotesCache(noteId: string) {
  const c = await col("study_notes_cache")
  return c.findOne({ study_note_id: noteId })
}

export async function upsertStudyNotesCache(noteId: string, data: Record<string, any>) {
  const c = await col("study_notes_cache")
  const existing = await c.findOne({ study_note_id: noteId })
  if (existing) {
    await c.updateOne(
      { study_note_id: noteId },
      { $set: { ...data, updated_at: new Date().toISOString() } }
    )
    return existing
  } else {
    const doc = { _id: newId() as any, study_note_id: noteId, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    await c.insertOne(doc)
    return doc
  }
}

// ─── Study Notes Media ──────────────────────────────────────────────────────

export async function deleteMediaByCacheId(cacheId: string) {
  const c = await col("study_notes_media")
  await c.deleteMany({ cache_id: cacheId })
}

export async function insertMedia(cacheId: string, filePath: string, fileData: Buffer, mimeType: string) {
  const c = await col("study_notes_media")
  await c.insertOne({
    _id: newId() as any,
    cache_id: cacheId,
    file_path: filePath,
    file_data: new Binary(fileData),
    mime_type: mimeType,
    created_at: new Date().toISOString()
  })
}

export async function getMediaFile(cacheId: string, filePath: string) {
  const c = await col("study_notes_media")
  return c.findOne({ cache_id: cacheId, file_path: filePath })
}

// ─── Exam Options ───────────────────────────────────────────────────────────

export async function getExamOptionsBySubjectId(subjectId: string) {
  const c = await col("exam_options")
  return c.find({ subject_id: subjectId }).sort({ date: 1 }).toArray()
}

export async function getExamOptionsBySubjectIds(subjectIds: string[]) {
  const c = await col("exam_options")
  return c.find({ subject_id: { $in: subjectIds } }).toArray()
}

export async function deleteExamOptionsBySubjectId(subjectId: string) {
  const c = await col("exam_options")
  await c.deleteMany({ subject_id: subjectId })
}

export async function insertExamOptions(options: Record<string, any>[]) {
  if (options.length === 0) return
  const c = await col("exam_options")
  const docs = options.map((opt) => ({ _id: newId() as any, ...opt, created_at: new Date().toISOString() }))
  await c.insertMany(docs)
}

// ─── Logos (stored as Binary in studies collection) ─────────────────────────

export async function storeLogo(studyId: string, fileBuffer: Buffer, mimeType: string) {
  const c = await col("studies")
  await c.updateOne(
    { _id: studyId as any },
    {
      $set: {
        logo_data: new Binary(fileBuffer),
        logo_mime_type: mimeType,
        logo_url: `/api/logos/${studyId}`,
        updated_at: new Date().toISOString()
      }
    }
  )
  return `/api/logos/${studyId}`
}

export async function deleteLogo(studyId: string) {
  const c = await col("studies")
  await c.updateOne(
    { _id: studyId as any },
    {
      $unset: { logo_data: "", logo_mime_type: "" },
      $set: { logo_url: null, updated_at: new Date().toISOString() }
    }
  )
}

export async function getLogoData(studyId: string) {
  const c = await col("studies")
  return c.findOne({ _id: studyId as any }, { projection: { logo_data: 1, logo_mime_type: 1 } })
}

// ─── Diplomas (stored as Binary in studies collection) ──────────────────────

export async function storeDiploma(studyId: string, fileBuffer: Buffer, mimeType: string) {
  const c = await col("studies")
  await c.updateOne(
    { _id: studyId as any },
    {
      $set: {
        diploma_data: new Binary(fileBuffer),
        diploma_mime_type: mimeType,
        diploma_url: `/api/diplomas/${studyId}`,
        diploma_uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
  )
  return `/api/diplomas/${studyId}`
}

export async function deleteDiploma(studyId: string) {
  const c = await col("studies")
  await c.updateOne(
    { _id: studyId as any },
    {
      $unset: { diploma_data: "", diploma_mime_type: "", diploma_uploaded_at: "" },
      $set: { diploma_url: null, updated_at: new Date().toISOString() }
    }
  )
}

export async function getDiplomaData(studyId: string) {
  const c = await col("studies")
  return c.findOne({ _id: studyId as any }, { projection: { diploma_data: 1, diploma_mime_type: 1 } })
}

// ─── App Settings ──────────────────────────────────────────────────────────

export async function getAppSettings() {
  const c = await col("app_settings")
  return c.findOne({ _id: "app_settings" as any })
}

export async function upsertAppSettings(data: Record<string, any>) {
  const c = await col("app_settings")
  await c.updateOne(
    { _id: "app_settings" as any },
    { $set: { ...data, updated_at: new Date().toISOString() } },
    { upsert: true }
  )
}

/**
 * Get documents from a collection that have onedrive_id but no cache_onedrive_id.
 * Used for bulk migration/sync to cache.
 */
export async function getDocumentsNeedingCache(
  collectionName: "materials" | "subject_materials" | "study_notes"
) {
  const c = await col(collectionName)
  return c
    .find({
      onedrive_id: { $exists: true, $ne: null },
      $or: [
        { cache_onedrive_id: { $exists: false } },
        { cache_onedrive_id: null },
      ],
    })
    .toArray()
}

export async function getCacheOneDriveIdsByStudyId(studyId: string) {
  const db = await getDb()
  const collections = ["materials", "subject_materials", "study_notes"] as const
  const docsByCollection = await Promise.all(
    collections.map((collectionName) =>
      db.collection(collectionName)
        .find(
          { study_id: studyId },
          { projection: { cache_onedrive_id: 1 } }
        )
        .toArray()
    )
  )

  return docsByCollection
    .flat()
    .map((doc) => doc.cache_onedrive_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
}

// ─── ID normalization helper ────────────────────────────────────────────────
// MongoDB documents use _id, but the app expects id.
// This helper converts _id to id for all documents returned from queries.
// It also strips Binary fields (logo_data, diploma_data, file_data) that can't be serialized
// when passed from Server Components to Client Components.

export function normalizeId<T extends Record<string, any>>(doc: T | null): (Omit<T, '_id'> & { id: string }) | null {
  if (!doc) return null
  const { _id, logo_data: _logoData, diploma_data: _diplomaData, ...rest } = doc
  return { id: _id as string, ...rest } as any
}

export function normalizeIds<T extends Record<string, any>>(docs: T[]): (Omit<T, '_id'> & { id: string })[] {
  return docs.map((doc) => normalizeId(doc)!)
}
