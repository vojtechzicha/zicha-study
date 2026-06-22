"use server"

import * as db from "@/lib/mongodb/db"
import { auth } from "@/auth"
import { NOTE_TYPES, MARKDOWN_NOTE_MAX_VERSIONS } from "@/lib/constants"
import type { NoteContentJSON } from "@/lib/types/markdown-notes"

// An empty TipTap/ProseMirror document.
const EMPTY_DOC: NoteContentJSON = { type: "doc", content: [{ type: "paragraph" }] }

async function requireUser() {
  const session = await auth()
  if (!session) {
    throw new Error("Neautorizováno")
  }
  return {
    email: session.user?.email ?? null,
    name: session.user?.name ?? null,
  }
}

interface CreateMarkdownNoteInput {
  studyId: string
  name: string
  description?: string | null
  isPublic?: boolean
  publicSlug?: string | null
}

export async function createMarkdownNote(input: CreateMarkdownNoteInput) {
  try {
    const user = await requireUser()
    const doc = await db.createStudyNote({
      study_id: input.studyId,
      user_id: user.email ?? "owner",
      note_type: NOTE_TYPES.MARKDOWN,
      name: input.name,
      description: input.description ?? null,
      // OneDrive fields intentionally absent for Markdown notes
      file_name: input.name,
      file_extension: "md",
      is_public: !!input.isPublic,
      public_slug: input.isPublic ? input.publicSlug ?? null : null,
      content_json: JSON.stringify(EMPTY_DOC),
      content_updated_at: new Date().toISOString(),
    })
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Unknown error" } }
  }
}

// Fetch a Markdown note (with content) for the editor screen.
export async function fetchMarkdownNote(noteId: string) {
  await requireUser()
  const doc = await db.getStudyNoteById(noteId)
  if (!doc) return { data: null, error: { message: "Zápis nenalezen" } }
  return { data: db.normalizeId(doc), error: null }
}

// Autosave the working copy. Returns the save timestamp.
export async function saveMarkdownContent(noteId: string, contentJson: NoteContentJSON) {
  try {
    await requireUser()
    await db.saveMarkdownNoteContent(noteId, contentJson)
    return { error: null, savedAt: new Date().toISOString() }
  } catch (err: any) {
    console.error("saveMarkdownContent failed:", err)
    return { error: { message: err?.message || "Unknown error" }, savedAt: null }
  }
}

// Commit a version snapshot (one per editing session that produced edits).
export async function commitMarkdownVersion(noteId: string, contentJson: NoteContentJSON) {
  try {
    const user = await requireUser()
    // Persist the working copy first so the note and its latest version agree.
    await db.saveMarkdownNoteContent(noteId, contentJson)
    await db.createMarkdownNoteVersion(noteId, contentJson, user, MARKDOWN_NOTE_MAX_VERSIONS)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

// Version list metadata (content omitted) — used by the History tab.
export async function fetchMarkdownVersions(noteId: string) {
  await requireUser()
  const docs = await db.getMarkdownNoteVersions(noteId)
  return db.normalizeIds(docs)
}

// Full content of a single version — for preview / restore.
export async function fetchMarkdownVersion(versionId: string) {
  await requireUser()
  const doc = await db.getMarkdownNoteVersionById(versionId)
  return doc ? db.normalizeId(doc) : null
}

// Upload an inline image; returns the URL to embed in the document.
export async function uploadMarkdownImage(
  noteId: string,
  fileArrayBuffer: ArrayBuffer,
  mimeType: string,
  originalName: string
) {
  try {
    await requireUser()
    const buffer = Buffer.from(fileArrayBuffer)
    const id = await db.insertMarkdownNoteMedia(noteId, buffer, mimeType, originalName)
    return { url: `/api/markdown-notes/${noteId}/media/${id}`, error: null }
  } catch (err: any) {
    return { url: null, error: { message: err?.message || "Unknown error" } }
  }
}
