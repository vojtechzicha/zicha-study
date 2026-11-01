import { getDb } from "./connection"
import { type Filter, Binary } from "mongodb"
import crypto from "crypto"
import { PRACTICE_PAGE_MAX_VERSIONS, RESERVED_STUDY_CHILD_SLUGS } from "@/lib/constants"
import type { Sanitized, SanitizedModuleContent } from "@/lib/practice/content"
import type { PracticePageContent } from "@/lib/practice/schema"
import { userLockOwnershipPatch } from "@/lib/exam-import/lock"

// ─── Helpers ────────────────────────────────────────────────────────────────

function newId(): string {
  return crypto.randomUUID()
}

function col(name: string) {
  return getDb().then((db) => db.collection(name))
}

// Material and note addresses that a static route under /<study>/ would shadow.
function isReservedStudyChildSlug(slug: string) {
  return RESERVED_STUDY_CHILD_SLUGS.includes(slug.toLowerCase())
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
  // MongoDB has no cascading deletes, so every dependent collection is cleared here
  const db = await getDb()

  const studyNotes = await db.collection("study_notes").find({ study_id: id }).toArray()
  const noteIds = studyNotes.map((n) => n._id)
  const subjects = await db.collection("subjects").find({ study_id: id }).toArray()
  const subjectIds = subjects.map((s) => s._id)

  if (noteIds.length > 0) {
    const caches = await db.collection("study_notes_cache").find({ study_note_id: { $in: noteIds } }).toArray()
    const cacheIds = caches.map((c) => c._id)
    if (cacheIds.length > 0) {
      await db.collection("study_notes_media").deleteMany({ cache_id: { $in: cacheIds } })
    }
    await db.collection("study_notes_cache").deleteMany({ study_note_id: { $in: noteIds } })
    await db.collection("study_note_versions").deleteMany({ note_id: { $in: noteIds } })
    await db.collection("markdown_note_media").deleteMany({ note_id: { $in: noteIds } })
  }

  await db.collection("study_notes").deleteMany({ study_id: id })
  await db.collection("subjects").deleteMany({ study_id: id })
  await db.collection("final_exams").deleteMany({ study_id: id })
  await db.collection("materials").deleteMany({ study_id: id })
  await db.collection("subject_materials").deleteMany({ study_id: id })
  await db.collection("tasks").deleteMany({ study_id: id })

  if (subjectIds.length > 0) {
    await db.collection("exam_options").deleteMany({ subject_id: { $in: subjectIds } })
  }

  await db.collection("exam_terms").deleteMany({ study_id: id })
  await db.collection("exam_periods").deleteMany({ study_id: id })
  await deletePracticeData(db, { study_id: id })

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

// Subset of the given study ids whose study is published (is_public).
export async function getPublicStudyIds(studyIds: string[]): Promise<Set<string>> {
  if (studyIds.length === 0) return new Set()
  const c = await col("studies")
  const docs = await c.find(
    { _id: { $in: studyIds as any[] }, is_public: true },
    { projection: { _id: 1 } }
  ).toArray()
  return new Set(docs.map((d) => String(d._id)))
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
  const filter: Filter<any> = { study_id: studyId }
  if (excludeId) {
    filter._id = { $ne: excludeId }
  }
  return c.find(filter, {
    projection: { _id: 1, name: 1, abbreviation: 1, semester: 1, subject_type: 1, completed: 1, planned: 1, is_repeat: 1, repeats_subject_id: 1 }
  }).toArray()
}

// Walk the repeats_subject_id chain to the original (root) subject and return its id.
// Stops at the first subject with no repeats_subject_id, or breaks safely on a cycle / missing row.
export async function getRepeatRootId(subjectId: string): Promise<string> {
  const c = await col("subjects")
  const visited = new Set<string>()
  let cursor: string = subjectId
  while (true) {
    if (visited.has(cursor)) return cursor
    visited.add(cursor)
    const row = await c.findOne(
      { _id: cursor as any },
      { projection: { repeats_subject_id: 1 } }
    ) as { repeats_subject_id?: string | null } | null
    if (!row || !row.repeats_subject_id) return cursor
    cursor = row.repeats_subject_id
  }
}

// Walks the repeats_subject_id chain starting at startId and throws if it cycles back to selfId.
async function assertNoRepeatCycle(studyId: string, selfId: string, startId: string) {
  const c = await col("subjects")
  const visited = new Set<string>()
  let cursor: string | null = startId
  while (cursor) {
    if (cursor === selfId) {
      throw new Error("Opakování by vytvořilo cyklus.")
    }
    if (visited.has(cursor)) {
      throw new Error("Řetězec opakování už obsahuje cyklus.")
    }
    visited.add(cursor)
    const next = await c.findOne(
      { _id: cursor as any, study_id: studyId },
      { projection: { repeats_subject_id: 1 } }
    ) as { repeats_subject_id?: string | null } | null
    cursor = next?.repeats_subject_id || null
  }
}

export async function createSubject(data: Record<string, any>) {
  const c = await col("subjects")
  const id = newId()
  if (data.repeats_subject_id) {
    await assertNoRepeatCycle(data.study_id, id, data.repeats_subject_id)
  }
  const doc = { _id: id as any, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  await c.insertOne(doc)
  return doc
}

export async function updateSubject(id: string, data: Record<string, any>) {
  const c = await col("subjects")
  if (data.repeats_subject_id) {
    const existing = await c.findOne(
      { _id: id as any },
      { projection: { study_id: 1 } }
    ) as { study_id?: string } | null
    if (existing?.study_id) {
      await assertNoRepeatCycle(existing.study_id, id, data.repeats_subject_id)
    }
  }
  await c.updateOne({ _id: id as any }, { $set: { ...data, updated_at: new Date().toISOString() } })
}

export async function deleteSubject(id: string) {
  const db = await getDb()
  const referenced = await db.collection("subjects").findOne(
    { repeats_subject_id: id },
    { projection: { _id: 1, name: 1, abbreviation: 1 } }
  )
  if (referenced) {
    const label = referenced.abbreviation ? `${referenced.abbreviation} – ${referenced.name}` : referenced.name
    throw new Error(`Předmět nelze smazat, protože ho opakuje „${label}“. Nejdřív upravte nebo smažte opakování.`)
  }
  await db.collection("exam_options").deleteMany({ subject_id: id })
  await db.collection("exam_terms").deleteMany({ subject_id: id })
  // Note links are denormalized onto the notes, so they don't go away with the subject
  await db.collection("study_notes").updateMany(
    { "linked_subjects.subject_id": id },
    { $pull: { linked_subjects: { subject_id: id } } as any }
  )
  await deletePracticeData(db, { subject_id: id })
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
  const db = await getDb()
  await db.collection("study_notes").updateMany(
    { "linked_final_exams.final_exam_id": id },
    { $pull: { linked_final_exams: { final_exam_id: id } } as any }
  )
  await db.collection("final_exams").deleteOne({ _id: id as any })
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

export async function getAllTasksWithStudyMeta() {
  const tasksCol = await col("tasks")
  const tasks = await tasksCol.find({}).sort({ deadline: 1, created_at: 1 }).toArray()
  if (tasks.length === 0) return [] as Array<{ task: any; study: any }>

  const studyIds = Array.from(new Set(tasks.map((t) => t.study_id).filter((v): v is string => typeof v === "string")))
  if (studyIds.length === 0) return [] as Array<{ task: any; study: any }>

  const studiesCol = await col("studies")
  const studies = await studiesCol
    .find({ _id: { $in: studyIds as any[] }, tasks_enabled: true })
    .project({ _id: 1, name: 1, logo_url: 1 })
    .toArray()
  const studyMap = new Map(studies.map((s) => [String(s._id), s]))

  return tasks
    .filter((t) => studyMap.has(t.study_id))
    .map((t) => ({ task: t, study: studyMap.get(t.study_id) }))
}

export async function getTasksEnabledStudies() {
  const c = await col("studies")
  return c.find({ tasks_enabled: true }).sort({ name: 1 }).toArray()
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
  if (isReservedStudyChildSlug(slug)) return false
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

export async function getSubjectMaterialsByStudyId(studyId: string) {
  const c = await col("subject_materials")
  return c.find({ study_id: studyId }).sort({ created_at: -1 }).toArray()
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
  if (isReservedStudyChildSlug(slug)) return false
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
  const cache = await db.collection("study_notes_cache").findOne({ study_note_id: id })
  if (cache) {
    await db.collection("study_notes_media").deleteMany({ cache_id: cache._id })
    await db.collection("study_notes_cache").deleteOne({ _id: cache._id })
  }
  await db.collection("study_note_versions").deleteMany({ note_id: id })
  await db.collection("markdown_note_media").deleteMany({ note_id: id })
  await db.collection("practice_modules").updateMany({ primary_note_id: id }, { $set: { primary_note_id: null } })
  await db.collection("study_notes").deleteOne({ _id: id as any })
}

export async function checkStudyNoteSlugAvailability(slug: string, studyId: string, excludeId?: string) {
  if (isReservedStudyChildSlug(slug)) return false
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

// Unlike checkStudyNoteSlugAvailability, checks study_notes only, but across all studies
export async function checkNoteSlugGlobalAvailability(slug: string, excludeId?: string) {
  if (isReservedStudyChildSlug(slug)) return false
  const c = await col("study_notes")
  const filter: Filter<any> = { public_slug: slug }
  if (excludeId) filter._id = { $ne: excludeId }
  const existing = await c.findOne(filter)
  return !existing
}

// ─── Study Notes: linked subjects / final exams (denormalized arrays on the note) ───

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

export async function getStudyNotesBySubjectId(subjectId: string) {
  const c = await col("study_notes")
  return c.find({ "linked_subjects.subject_id": subjectId }).sort({ created_at: -1 }).toArray()
}

export async function getStudyNotesByFinalExamId(finalExamId: string) {
  const c = await col("study_notes")
  return c.find({ "linked_final_exams.final_exam_id": finalExamId }).sort({ created_at: -1 }).toArray()
}

export async function getLinkedSubjectIds(noteId: string) {
  const c = await col("study_notes")
  const note = await c.findOne({ _id: noteId as any }, { projection: { linked_subjects: 1 } })
  return (note?.linked_subjects || []).map((l: any) => l.subject_id)
}

export async function getLinkedFinalExamIds(noteId: string) {
  const c = await col("study_notes")
  const note = await c.findOne({ _id: noteId as any }, { projection: { linked_final_exams: 1 } })
  return (note?.linked_final_exams || []).map((l: any) => l.final_exam_id)
}

export async function getFinalExamIdsWithNotes(examIds: string[], publicOnly = false) {
  const c = await col("study_notes")
  const filter: Filter<any> = { "linked_final_exams.final_exam_id": { $in: examIds } }
  if (publicOnly) filter.is_public = true
  const results = await c.distinct("linked_final_exams.final_exam_id", filter)
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

// ─── Markdown Notes: Content ────────────────────────────────────────────────

export async function getMarkdownNoteContent(noteId: string) {
  const c = await col("study_notes")
  return c.findOne(
    { _id: noteId as any },
    { projection: { content_json: 1, content_updated_at: 1 } }
  )
}

// Autosaved working copy of the note's content. Stored as a JSON *string* so
// MongoDB never inspects the document's inner field names — arbitrary pasted /
// rich content can contain keys that violate BSON field-name rules (dots, $) or
// nesting limits when stored as a nested document.
export async function saveMarkdownNoteContent(noteId: string, contentJson: Record<string, any> | string) {
  const c = await col("study_notes")
  const serialized = typeof contentJson === "string" ? contentJson : JSON.stringify(contentJson)
  await c.updateOne(
    { _id: noteId as any },
    {
      $set: {
        content_json: serialized,
        content_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }
  )
}

// ─── Markdown Notes: Versions (newest MARKDOWN_NOTE_MAX_VERSIONS retained) ───

export async function createMarkdownNoteVersion(
  noteId: string,
  contentJson: Record<string, any> | string,
  createdBy: { email?: string | null; name?: string | null },
  maxVersions: number
) {
  const c = await col("study_note_versions")
  const doc = {
    _id: newId() as any,
    note_id: noteId,
    // Stored as a JSON string (see saveMarkdownNoteContent for rationale).
    content_json: typeof contentJson === "string" ? contentJson : JSON.stringify(contentJson),
    created_by_email: createdBy.email || null,
    created_by_name: createdBy.name || null,
    created_at: new Date().toISOString(),
  }
  await c.insertOne(doc)

  // Prune to the newest `maxVersions` snapshots for this note.
  const stale = await c
    .find({ note_id: noteId }, { projection: { _id: 1 } })
    .sort({ created_at: -1 })
    .skip(maxVersions)
    .toArray()
  if (stale.length > 0) {
    await c.deleteMany({ _id: { $in: stale.map((d) => d._id) } })
  }
  return doc
}

export async function getMarkdownNoteVersions(noteId: string) {
  const c = await col("study_note_versions")
  return c
    .find({ note_id: noteId }, { projection: { content_json: 0 } })
    .sort({ created_at: -1 })
    .toArray()
}

export async function getMarkdownNoteVersionById(versionId: string) {
  const c = await col("study_note_versions")
  return c.findOne({ _id: versionId as any })
}

// ─── Markdown Notes: Inline media (images stored as Binary) ──────────────────

export async function insertMarkdownNoteMedia(
  noteId: string,
  fileData: Buffer,
  mimeType: string,
  originalName: string
) {
  const c = await col("markdown_note_media")
  const id = newId()
  await c.insertOne({
    _id: id as any,
    note_id: noteId,
    file_data: new Binary(fileData),
    mime_type: mimeType,
    original_name: originalName,
    created_at: new Date().toISOString(),
  })
  return id
}

export async function getMarkdownNoteMedia(noteId: string, mediaId: string) {
  const c = await col("markdown_note_media")
  return c.findOne({ _id: mediaId as any, note_id: noteId })
}

// ─── Exam Periods (global exam scheduler) ────────────────────────────────────

export async function getExamPeriods() {
  const c = await col("exam_periods")
  return c.find({}).sort({ start_date: 1, name: 1 }).toArray()
}

export async function getExamPeriodsByStudyId(studyId: string) {
  const c = await col("exam_periods")
  return c.find({ study_id: studyId }).sort({ start_date: 1, name: 1 }).toArray()
}

export async function getExamPeriodById(id: string) {
  const c = await col("exam_periods")
  return c.findOne({ _id: id as any })
}

export async function createExamPeriod(data: Record<string, any>) {
  const c = await col("exam_periods")
  const doc = { _id: newId() as any, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  await c.insertOne(doc)
  return doc
}

export async function updateExamPeriod(id: string, data: Record<string, any>) {
  const c = await col("exam_periods")
  await c.updateOne({ _id: id as any }, { $set: { ...data, updated_at: new Date().toISOString() } })
}

export async function deleteExamPeriod(id: string) {
  const db = await getDb()
  await db.collection("exam_terms").deleteMany({ period_id: id })
  await db.collection("exam_periods").deleteOne({ _id: id as any })
}

// ─── Exam Terms (candidate slots inside a period) ────────────────────────────

export async function getExamTermsByPeriodId(periodId: string) {
  const c = await col("exam_terms")
  return c.find({ period_id: periodId }).sort({ date: 1, start_time: 1 }).toArray()
}

export async function getExamTermsByPeriodIds(periodIds: string[]) {
  if (periodIds.length === 0) return []
  const c = await col("exam_terms")
  return c.find({ period_id: { $in: periodIds } }).sort({ date: 1, start_time: 1 }).toArray()
}

export async function getExamTermById(id: string) {
  const c = await col("exam_terms")
  return c.findOne({ _id: id as any })
}

export async function createExamTerm(data: Record<string, any>) {
  const c = await col("exam_terms")
  const doc = {
    _id: newId() as any,
    locked: false,
    note: null,
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  await c.insertOne(doc)
  return doc
}

/**
 * Updates a term. `by: "import"` is the exam term import; any other caller is the user, whose
 * change of `locked` takes the lock over from the importer (lib/exam-import/lock.ts).
 */
export async function updateExamTerm(id: string, data: Record<string, any>, options: { by?: "user" | "import" } = {}) {
  const c = await col("exam_terms")
  const ownership = options.by === "import" ? {} : userLockOwnershipPatch(await c.findOne({ _id: id as any }), data)
  await c.updateOne({ _id: id as any }, { $set: { ...data, ...ownership, updated_at: new Date().toISOString() } })
}

/**
 * Deletes a term. A synced term (exam_terms.source) deleted by the user is remembered in
 * exam_term_dismissals so the next import doesn't bring it back; the importer itself passes
 * dismiss: false when the source dropped the term.
 */
export async function deleteExamTerm(id: string, options: { dismiss?: boolean; onlyIfUnlocked?: boolean } = {}) {
  const c = await col("exam_terms")
  if (options.onlyIfUnlocked) {
    // Atomic: a term the user locked meanwhile stays. Returns whether it was deleted.
    const res = await c.deleteOne({ _id: id as any, locked: { $ne: true } })
    return res.deletedCount === 1
  }
  const term = await c.findOne({ _id: id as any })
  if (!term) return false
  if (options.dismiss !== false && term.source && term.external_id) {
    await (await col("exam_term_dismissals")).updateOne(
      { _id: `${term.source}:${term.study_id}:${term.external_id}` as any },
      {
        $set: { study_id: term.study_id, source: term.source, external_id: term.external_id, subject_id: term.subject_id, date: term.date },
        $setOnInsert: { dismissed_at: new Date().toISOString() },
      },
      { upsert: true }
    )
  }
  await c.deleteOne({ _id: id as any })
  return true
}

/** External ids of synced terms the user deleted, for the importer to skip. */
export async function getExamTermDismissals(studyId: string, source: string): Promise<string[]> {
  const c = await col("exam_term_dismissals")
  const rows = await c.find({ study_id: studyId, source }).project({ external_id: 1 }).toArray()
  return rows.map((r) => String(r.external_id))
}

export async function deleteExamTermsByPeriodAndSubject(periodId: string, subjectId: string) {
  const c = await col("exam_terms")
  await c.deleteMany({ period_id: periodId, subject_id: subjectId })
}

export async function setExamTermLocked(id: string, locked: boolean) {
  const c = await col("exam_terms")
  const ownership = userLockOwnershipPatch(await c.findOne({ _id: id as any }), { locked })
  await c.updateOne({ _id: id as any }, { $set: { locked, ...ownership, updated_at: new Date().toISOString() } })
}

// One synced term per study, source and external id, so overlapping imports can't duplicate a term.
let examTermIndexesPromise: Promise<void> | null = null

export function ensureExamTermImportIndexes() {
  if (!examTermIndexesPromise) {
    examTermIndexesPromise = getDb()
      .then(async (db) => {
        await db.collection("exam_terms").createIndex(
          { study_id: 1, source: 1, external_id: 1 },
          { unique: true, name: "exam_terms_external_identity", partialFilterExpression: { external_id: { $type: "string" } } }
        )
      })
      .catch((err) => {
        examTermIndexesPromise = null
        throw err
      })
  }
  return examTermIndexesPromise
}

/**
 * Everything the global scheduler needs: active studies with the exam scheduler enabled (with
 * their transit/accommodation/PTO config), their periods, the terms in those periods, and the
 * studies' subjects (for names/abbreviations). Runs the one-time exam_options migration first.
 * Returns raw docs; the action layer normalizes.
 */
export async function getGlobalExamSchedulingData() {
  await migrateExamOptionsToPeriods()

  const studiesCol = await col("studies")
  const studies = await studiesCol
    .find({ exam_scheduler_enabled: true, status: "active" })
    .project({
      _id: 1, name: 1, logo_url: 1,
      transit_duration_hours: 1, transit_cost_one_way: 1, accommodation_cost_per_night: 1,
      earliest_arrival_time: 1, prefer_free_day_exams: 1, pto_day_cost: 1, working_days: 1,
    })
    .toArray()

  const studyIds = studies.map((s) => String(s._id))
  if (studyIds.length === 0) {
    return { studies: [] as any[], periods: [] as any[], terms: [] as any[], subjects: [] as any[] }
  }

  const periodsCol = await col("exam_periods")
  const periods = await periodsCol
    .find({ study_id: { $in: studyIds } })
    .sort({ start_date: 1, name: 1 })
    .toArray()

  const periodIds = periods.map((p) => String(p._id))
  const termsCol = await col("exam_terms")
  const terms = periodIds.length > 0
    ? await termsCol.find({ period_id: { $in: periodIds } }).sort({ date: 1, start_time: 1 }).toArray()
    : []

  const subjectsCol = await col("subjects")
  const subjects = await subjectsCol
    .find({ study_id: { $in: studyIds } })
    .project({ _id: 1, study_id: 1, name: 1, abbreviation: 1, semester: 1, subject_type: 1, completed: 1, planned: 1 })
    .toArray()

  return { studies, periods, terms, subjects }
}

/**
 * Upcoming locked exam terms of active scheduler-enabled studies, with study, subject and
 * period metadata, for the homepage / tasks view. Only locked terms are commitments;
 * unlocked ones are still just candidates. Terms of completed subjects are left out.
 */
export async function getUpcomingLockedExamTerms(fromDate: string) {
  const termsCol = await col("exam_terms")
  const terms = await termsCol
    .find({ locked: true, date: { $gte: fromDate } })
    .sort({ date: 1, start_time: 1 })
    .toArray()
  if (terms.length === 0) return [] as Array<{ term: any; study: any; subject: any; period: any }>

  const studyIds = Array.from(new Set(terms.map((t) => t.study_id).filter((v): v is string => typeof v === "string")))
  const subjectIds = Array.from(new Set(terms.map((t) => t.subject_id).filter((v): v is string => typeof v === "string")))
  const periodIds = Array.from(new Set(terms.map((t) => t.period_id).filter((v): v is string => typeof v === "string")))

  const db = await getDb()
  const [studies, subjects, periods] = await Promise.all([
    db.collection("studies").find({ _id: { $in: studyIds as any[] }, exam_scheduler_enabled: true, status: "active" }).project({ _id: 1, name: 1, logo_url: 1 }).toArray(),
    db.collection("subjects").find({ _id: { $in: subjectIds as any[] } }).project({ _id: 1, name: 1, abbreviation: 1, completed: 1 }).toArray(),
    db.collection("exam_periods").find({ _id: { $in: periodIds as any[] } }).project({ _id: 1, name: 1, exam_parts: 1 }).toArray(),
  ])

  const studyMap = new Map(studies.map((s) => [String(s._id), s]))
  const subjectMap = new Map(subjects.map((s) => [String(s._id), s]))
  const periodMap = new Map(periods.map((p) => [String(p._id), p]))

  return terms
    .filter((t) => studyMap.has(t.study_id) && !subjectMap.get(t.subject_id)?.completed)
    .map((t) => ({
      term: t,
      study: studyMap.get(t.study_id),
      subject: subjectMap.get(t.subject_id) || null,
      period: periodMap.get(t.period_id) || null,
    }))
}

/**
 * One-time, idempotent migration of legacy per-subject exam_options into the
 * new period/term model. Creates a single "Zkouškové období" per study spanning
 * the min..max option date and converts each option into a term. The original
 * exam_options are left untouched. Guarded by app_settings.exam_periods_migrated.
 */
export async function migrateExamOptionsToPeriods() {
  const settings = await getAppSettings()
  if (settings?.exam_periods_migrated) return

  const db = await getDb()
  const options = await db.collection("exam_options").find({}).toArray()

  if (options.length > 0) {
    const subjectIds = Array.from(new Set(options.map((o) => o.subject_id).filter((v): v is string => typeof v === "string")))
    const subjects = await db.collection("subjects")
      .find({ _id: { $in: subjectIds as any[] } })
      .project({ _id: 1, study_id: 1 })
      .toArray()
    const subjectToStudy = new Map(subjects.map((s) => [String(s._id), String(s.study_id)]))

    const byStudy = new Map<string, any[]>()
    for (const opt of options) {
      const studyId = subjectToStudy.get(opt.subject_id)
      if (!studyId) continue // orphaned option (subject deleted)
      const list = byStudy.get(studyId) || []
      list.push(opt)
      byStudy.set(studyId, list)
    }

    const now = new Date().toISOString()
    for (const [studyId, studyOptions] of byStudy) {
      const dates = studyOptions.map((o) => String(o.date)).filter(Boolean).sort()
      if (dates.length === 0) continue
      const periodId = newId()
      await db.collection("exam_periods").insertOne({
        _id: periodId as any,
        study_id: studyId,
        name: "Zkouškové období",
        start_date: dates[0],
        due_date: dates[dates.length - 1],
        created_at: now,
        updated_at: now,
      })
      const termDocs = studyOptions.map((o) => ({
        _id: newId() as any,
        period_id: periodId,
        study_id: studyId,
        subject_id: o.subject_id,
        date: o.date,
        start_time: o.start_time,
        duration_minutes: o.duration_minutes,
        is_online: !!o.is_online,
        note: o.note ?? null,
        locked: false,
        created_at: now,
        updated_at: now,
      }))
      if (termDocs.length > 0) {
        await db.collection("exam_terms").insertMany(termDocs)
      }
    }
  }

  await upsertAppSettings({ exam_periods_migrated: true })
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

/** Documents with an onedrive_id but no cache_onedrive_id yet, for bulk cache sync. */
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

// ─── MCP: OAuth clients, grants, codes and tokens ───────────────────────────
// Remote MCP access for Claude (app/api/mcp). Codes and tokens are stored as SHA-256
// hashes under _id, never in plain text. expires_at is a Date so TTL indexes can
// prune expired rows.

let mcpIndexesPromise: Promise<void> | null = null

function ensureMcpIndexes() {
  if (!mcpIndexesPromise) {
    mcpIndexesPromise = getDb()
      .then(async (db) => {
        await Promise.all([
          db.collection("mcp_auth_codes").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
          db.collection("mcp_tokens").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
          db.collection("mcp_tokens").createIndex({ grant_id: 1 }),
          db.collection("mcp_audit").createIndex({ at: -1 }),
        ])
      })
      .catch((err) => {
        mcpIndexesPromise = null
        throw err
      })
  }
  return mcpIndexesPromise
}

async function mcpCol(name: string) {
  await ensureMcpIndexes()
  return col(name)
}

export async function createMcpClient(data: Record<string, any>) {
  const c = await mcpCol("mcp_clients")
  const doc = { _id: newId() as any, ...data, created_at: new Date().toISOString() }
  await c.insertOne(doc)
  return doc
}

export async function getMcpClient(id: string) {
  const c = await mcpCol("mcp_clients")
  return c.findOne({ _id: id as any })
}

export async function createMcpAuthCode(codeHash: string, data: Record<string, any>) {
  const c = await mcpCol("mcp_auth_codes")
  await c.insertOne({ _id: codeHash as any, ...data, created_at: new Date().toISOString() })
}

// Single use: the code is deleted by the same operation that reads it.
export async function consumeMcpAuthCode(codeHash: string) {
  const c = await mcpCol("mcp_auth_codes")
  return c.findOneAndDelete({ _id: codeHash as any })
}

export async function createMcpGrant(data: Record<string, any>) {
  const c = await mcpCol("mcp_grants")
  const now = new Date().toISOString()
  const doc = { _id: newId() as any, ...data, revoked_at: null, last_used_at: null, created_at: now }
  await c.insertOne(doc)
  return doc
}

export async function getMcpGrant(id: string) {
  const c = await mcpCol("mcp_grants")
  return c.findOne({ _id: id as any })
}

export async function getActiveMcpGrants() {
  const c = await mcpCol("mcp_grants")
  return c.find({ revoked_at: null }).sort({ created_at: -1 }).toArray()
}

export async function touchMcpGrant(id: string) {
  const c = await mcpCol("mcp_grants")
  await c.updateOne({ _id: id as any }, { $set: { last_used_at: new Date().toISOString() } })
}

export async function revokeMcpGrant(id: string) {
  const db = await getDb()
  await ensureMcpIndexes()
  await db.collection("mcp_grants").updateOne(
    { _id: id as any, revoked_at: null },
    { $set: { revoked_at: new Date().toISOString() } }
  )
  await db.collection("mcp_tokens").deleteMany({ grant_id: id })
  // Practice upload tokens issued through this connection stop working with it.
  await db.collection("practice_upload_tokens").updateMany(
    { grant_id: id, revoked_at: null },
    { $set: { revoked_at: new Date() } }
  )
}

export async function insertMcpToken(tokenHash: string, data: Record<string, any>) {
  const c = await mcpCol("mcp_tokens")
  await c.insertOne({ _id: tokenHash as any, ...data, used_at: null, created_at: new Date().toISOString() })
}

export async function getMcpToken(tokenHash: string) {
  const c = await mcpCol("mcp_tokens")
  return c.findOne({ _id: tokenHash as any })
}

// Marks a refresh token used and returns it, or null when it is unknown or was
// already used (the caller treats reuse as theft and revokes the grant).
export async function claimMcpRefreshToken(tokenHash: string) {
  const c = await mcpCol("mcp_tokens")
  return c.findOneAndUpdate(
    { _id: tokenHash as any, kind: "refresh", used_at: null },
    { $set: { used_at: new Date().toISOString() } }
  )
}

export async function deleteMcpToken(tokenHash: string) {
  const c = await mcpCol("mcp_tokens")
  await c.deleteOne({ _id: tokenHash as any })
}

// ─── MCP: audit log of every write made through MCP ─────────────────────────

export async function insertMcpAuditEntry(data: Record<string, any>) {
  const c = await mcpCol("mcp_audit")
  await c.insertOne({ _id: newId() as any, ...data, at: new Date().toISOString() })
}

export async function getMcpAuditEntries(limit: number) {
  const c = await mcpCol("mcp_audit")
  return c.find().sort({ at: -1 }).limit(limit).toArray()
}

// ─── ID normalization helper ────────────────────────────────────────────────
// Maps Mongo's _id to the app's id, and strips the logo_data / diploma_data Binary fields,
// which can't be serialized from Server Components to Client Components.

// ─── Procvičování (practice modules) ────────────────────────────────────────
// One module per subject (practice_modules), its pages with embedded examples (practice_pages),
// the last PRACTICE_PAGE_MAX_VERSIONS contents per page (practice_page_versions), per-example
// progress (practice_progress) and MCP-issued upload tokens (practice_upload_tokens).
// Page content and module HTML only arrive here as Sanitized<…> from lib/practice/content.ts.

let practiceIndexesPromise: Promise<void> | null = null

function ensurePracticeIndexes() {
  if (!practiceIndexesPromise) {
    practiceIndexesPromise = getDb()
      .then(async (db) => {
        await Promise.all([
          db.collection("practice_modules").createIndex({ address_prefix: 1, slug: 1 }, { unique: true }),
          db.collection("practice_modules").createIndex({ subject_id: 1 }, { unique: true }),
          db.collection("practice_modules").createIndex({ study_id: 1 }),
          db.collection("practice_pages").createIndex({ module_id: 1, slug: 1 }, { unique: true }),
          db.collection("practice_pages").createIndex({ subject_id: 1 }),
          db.collection("practice_pages").createIndex({ study_id: 1 }),
          db.collection("practice_page_versions").createIndex({ page_id: 1, revision: -1 }, { unique: true }),
          db.collection("practice_progress").createIndex({ page_id: 1, example_key: 1 }, { unique: true }),
          db.collection("practice_progress").createIndex({ module_id: 1 }),
          db.collection("practice_upload_tokens").createIndex({ token_hash: 1 }, { unique: true }),
          db.collection("practice_upload_tokens").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
          db.collection("practice_upload_tokens").createIndex({ grant_id: 1 }),
        ])
      })
      .catch((err) => {
        practiceIndexesPromise = null
        throw err
      })
  }
  return practiceIndexesPromise
}

async function practiceCol(name: string) {
  await ensurePracticeIndexes()
  return col(name)
}

// Deletes every practice record matching the filter (by subject_id or study_id).
async function deletePracticeData(db: Awaited<ReturnType<typeof getDb>>, filter: { subject_id?: string; study_id?: string }) {
  const modules = await db.collection("practice_modules").find(filter, { projection: { _id: 1 } }).toArray()
  const moduleIds = modules.map((m) => String(m._id))
  if (moduleIds.length === 0) return
  const pages = await db.collection("practice_pages").find({ module_id: { $in: moduleIds } }, { projection: { _id: 1 } }).toArray()
  const pageIds = pages.map((p) => String(p._id))
  if (pageIds.length > 0) {
    await db.collection("practice_page_versions").deleteMany({ page_id: { $in: pageIds } })
  }
  await db.collection("practice_progress").deleteMany({ module_id: { $in: moduleIds } })
  await db.collection("practice_upload_tokens").deleteMany({ module_id: { $in: moduleIds } })
  await db.collection("practice_pages").deleteMany({ module_id: { $in: moduleIds } })
  await db.collection("practice_modules").deleteMany({ _id: { $in: moduleIds as any[] } })
}

// Counts for delete previews (MCP dry runs).
export async function countPracticeData(filter: { subject_id?: string; study_id?: string }) {
  const db = await getDb()
  const modules = await db.collection("practice_modules").find(filter, { projection: { _id: 1 } }).toArray()
  const moduleIds = modules.map((m) => String(m._id))
  if (moduleIds.length === 0) return { practice_modules: 0, practice_pages: 0, practice_progress: 0 }
  const [pages, progress] = await Promise.all([
    db.collection("practice_pages").countDocuments({ module_id: { $in: moduleIds } }),
    db.collection("practice_progress").countDocuments({ module_id: { $in: moduleIds } }),
  ])
  return { practice_modules: moduleIds.length, practice_pages: pages, practice_progress: progress }
}

// Module fields that hold no HTML (HTML goes through SanitizedModuleContent).
export interface PracticeModuleSettings {
  address_prefix?: string
  slug?: string
  title?: string
  flavour?: string
  primary_note_id?: string | null
  groups?: { id: string; key: string; title: string; description: string | null; pages: string[] }[]
}

export async function getPracticeModuleById(id: string) {
  const c = await practiceCol("practice_modules")
  return c.findOne({ _id: id as any })
}

export async function getPracticeModuleBySubjectId(subjectId: string) {
  const c = await practiceCol("practice_modules")
  return c.findOne({ subject_id: subjectId })
}

export async function getPracticeModuleByAddress(addressPrefix: string, slug: string) {
  const c = await practiceCol("practice_modules")
  return c.findOne({ address_prefix: addressPrefix, slug })
}

export async function getPracticeModulesByStudyId(studyId: string) {
  const c = await practiceCol("practice_modules")
  return c.find({ study_id: studyId }).toArray()
}

export async function isPracticeAddressAvailable(addressPrefix: string, slug: string, excludeModuleId?: string) {
  const c = await practiceCol("practice_modules")
  const filter: Filter<any> = { address_prefix: addressPrefix, slug }
  if (excludeModuleId) filter._id = { $ne: excludeModuleId }
  return !(await c.findOne(filter, { projection: { _id: 1 } }))
}

export async function createPracticeModule(
  base: { subject_id: string; study_id: string } & Required<Omit<PracticeModuleSettings, "groups">>
) {
  const c = await practiceCol("practice_modules")
  const now = new Date().toISOString()
  const doc = {
    _id: newId() as any,
    ...base,
    intro_html: "",
    intro_blocks: [],
    closing_blocks: [],
    groups: [],
    created_at: now,
    updated_at: now,
  }
  await c.insertOne(doc)
  return doc
}

export async function updatePracticeModule(id: string, settings: PracticeModuleSettings, content?: SanitizedModuleContent) {
  const c = await practiceCol("practice_modules")
  await c.updateOne(
    { _id: id as any },
    { $set: { ...settings, ...(content ?? {}), updated_at: new Date().toISOString() } }
  )
}

// Page list without the (large) HTML: enough for indexes, progress counts and MCP listings.
export async function getPracticePageSummaries(moduleId: string) {
  const c = await practiceCol("practice_pages")
  return c
    .find(
      { module_id: moduleId },
      {
        projection: {
          slug: 1, title: 1, desc: 1, revision: 1, content_hash: 1, created_at: 1, updated_at: 1, content_updated_at: 1,
          "examples.key": 1, "examples.n": 1, "examples.title": 1, "examples.nav_meta": 1, "examples.steps.title": 1,
        },
      }
    )
    .toArray()
}

export async function getPracticePageById(id: string) {
  const c = await practiceCol("practice_pages")
  return c.findOne({ _id: id as any })
}

export async function getPracticePageBySlug(moduleId: string, slug: string) {
  const c = await practiceCol("practice_pages")
  return c.findOne({ module_id: moduleId, slug })
}

// Throws a duplicate-key error (code 11000) when the slug already exists in the module.
export async function insertPracticePage(
  base: { module_id: string; subject_id: string; study_id: string; slug: string },
  content: Sanitized<PracticePageContent>,
  contentHash: string
) {
  const c = await practiceCol("practice_pages")
  const now = new Date().toISOString()
  const doc = {
    _id: newId() as any,
    ...base,
    ...content,
    desc: null,
    content_hash: contentHash,
    revision: 1,
    created_at: now,
    updated_at: now,
    content_updated_at: now,
  }
  await c.insertOne(doc)
  return doc
}

// Compare-and-set content update: only applies when the page is still at expectedRevision.
// Returns false when another write got there first.
export async function casUpdatePracticePageContent(
  id: string,
  expectedRevision: number,
  content: Sanitized<PracticePageContent>,
  contentHash: string
) {
  const c = await practiceCol("practice_pages")
  const now = new Date().toISOString()
  const result = await c.updateOne(
    { _id: id as any, revision: expectedRevision },
    { $set: { ...content, content_hash: contentHash, updated_at: now, content_updated_at: now }, $inc: { revision: 1 } }
  )
  return result.matchedCount === 1
}

// Plain-text page fields (no HTML) and its address. desc isn't part of the uploaded content, so
// re-uploading a page keeps it.
// The title is part of the uploaded content: editing it clears content_hash, so re-uploading
// the original page counts as a change and restores the generator's title.
export async function updatePracticePageMeta(id: string, fields: { title?: string; desc?: string | null; slug?: string }) {
  const c = await practiceCol("practice_pages")
  const set: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() }
  if (fields.title !== undefined) set.content_hash = null
  await c.updateOne({ _id: id as any }, { $set: set })
}

// Snapshot of a page's content at one revision. Idempotent per (page, revision); keeps the newest
// PRACTICE_PAGE_MAX_VERSIONS.
export async function savePracticePageVersion(
  pageId: string,
  revision: number,
  content: PracticePageContent,
  createdBy: string | null
) {
  const c = await practiceCol("practice_page_versions")
  await c.updateOne(
    { page_id: pageId, revision },
    {
      $setOnInsert: {
        _id: newId() as any,
        page_id: pageId,
        revision,
        content,
        created_by: createdBy,
        created_at: new Date().toISOString(),
      },
    },
    { upsert: true }
  )
  const stale = await c
    .find({ page_id: pageId }, { projection: { _id: 1 } })
    .sort({ revision: -1 })
    .skip(PRACTICE_PAGE_MAX_VERSIONS)
    .toArray()
  if (stale.length > 0) await c.deleteMany({ _id: { $in: stale.map((d) => d._id) } })
}

export async function getPracticePageVersions(pageId: string) {
  const c = await practiceCol("practice_page_versions")
  return c.find({ page_id: pageId }, { projection: { content: 0 } }).sort({ revision: -1 }).toArray()
}

export async function deletePracticePage(id: string) {
  const db = await getDb()
  await ensurePracticeIndexes()
  await db.collection("practice_page_versions").deleteMany({ page_id: id })
  await db.collection("practice_progress").deleteMany({ page_id: id })
  await db.collection("practice_pages").deleteOne({ _id: id as any })
}

export async function countPracticePageData(pageId: string) {
  const db = await getDb()
  const [versions, progress] = await Promise.all([
    db.collection("practice_page_versions").countDocuments({ page_id: pageId }),
    db.collection("practice_progress").countDocuments({ page_id: pageId }),
  ])
  return { practice_page_versions: versions, practice_progress: progress }
}

// Progress rows are matched by example key; rows whose key no longer exists are kept (orphans)
// and simply not shown, so a regeneration that is later fixed restores them.
export async function setPracticeProgress(
  ref: { module_id: string; page_id: string; example_key: string },
  done: boolean,
  email: string | null
) {
  const c = await practiceCol("practice_progress")
  if (done) {
    await c.updateOne(
      { page_id: ref.page_id, example_key: ref.example_key },
      {
        $setOnInsert: { _id: newId() as any, ...ref },
        $set: { done_at: new Date().toISOString(), done_by_email: email },
      },
      { upsert: true }
    )
  } else {
    await c.deleteOne({ page_id: ref.page_id, example_key: ref.example_key })
  }
}

export async function getPracticeProgressByModuleId(moduleId: string) {
  const c = await practiceCol("practice_progress")
  return c.find({ module_id: moduleId }).toArray()
}

export async function getPracticeProgressByPageId(pageId: string) {
  const c = await practiceCol("practice_progress")
  return c.find({ page_id: pageId }).toArray()
}

// Upload tokens (practice_upload_tokens): issued by the MCP tool create_practice_upload, bound to
// one module and the MCP grant that asked for them; only the SHA-256 hash is stored.
export async function insertPracticeUploadToken(data: {
  token_hash: string
  module_id: string
  grant_id: string
  email: string | null
  expires_at: Date
  max_requests: number
}) {
  const c = await practiceCol("practice_upload_tokens")
  const doc = { _id: newId() as any, ...data, used_requests: 0, revoked_at: null, created_at: new Date().toISOString() }
  await c.insertOne(doc)
  return doc
}

// Counts one request against the token and returns it, or null when it is unknown, expired,
// revoked or used up. The checks and the increment are one atomic update.
export async function claimPracticeUploadToken(tokenHash: string) {
  const c = await practiceCol("practice_upload_tokens")
  return c.findOneAndUpdate(
    {
      token_hash: tokenHash,
      revoked_at: null,
      expires_at: { $gt: new Date() },
      $expr: { $lt: ["$used_requests", "$max_requests"] },
    },
    { $inc: { used_requests: 1 } },
    { returnDocument: "after" }
  )
}

export async function getPracticeUploadToken(id: string) {
  const c = await practiceCol("practice_upload_tokens")
  return c.findOne({ _id: id as any }, { projection: { token_hash: 0 } })
}

export async function revokePracticeUploadToken(id: string) {
  const c = await practiceCol("practice_upload_tokens")
  await c.updateOne({ _id: id as any, revoked_at: null }, { $set: { revoked_at: new Date() } })
}

export function normalizeId<T extends Record<string, any>>(doc: T | null): (Omit<T, '_id'> & { id: string }) | null {
  if (!doc) return null
  const { _id, logo_data: _logoData, diploma_data: _diplomaData, ...rest } = doc
  return { id: _id as string, ...rest } as any
}

export function normalizeIds<T extends Record<string, any>>(docs: T[]): (Omit<T, '_id'> & { id: string })[] {
  return docs.map((doc) => normalizeId(doc)!)
}
