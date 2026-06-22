import type { NoteType } from "@/lib/constants"

// A single freehand pen stroke captured from pointer/Apple Pencil input.
// Points are [x, y, pressure] in the doodle's local coordinate space.
export interface DoodleStroke {
  points: [number, number, number][]
  color: string
  size: number
}

// Editable scene data for an in-note doodle / annotation block.
export interface DoodleScene {
  version: 1
  width: number
  height: number
  strokes: DoodleStroke[]
  // Optional background image (used when annotating an existing image).
  background?: {
    src: string
    mediaId?: string | null
  } | null
}

// ProseMirror/TipTap document JSON. Kept loose on purpose — the editor owns the shape.
export type NoteContentJSON = {
  type: string
  content?: unknown[]
  [key: string]: unknown
}

// Note content is stored as a JSON string (Mongo-safe), but legacy rows may hold
// a nested object. This normalises either form to an object the editor accepts.
export function coerceNoteContent(value: unknown): NoteContentJSON | null {
  if (value == null) return null
  if (typeof value === "string") {
    if (!value.trim()) return null
    try {
      return JSON.parse(value) as NoteContentJSON
    } catch {
      return null
    }
  }
  if (typeof value === "object") return value as NoteContentJSON
  return null
}

// A stored snapshot of a Markdown note's content (newest 50 retained per note).
export interface MarkdownNoteVersion {
  id: string
  note_id: string
  content_json: NoteContentJSON
  created_at: string
  // Identity of whoever produced the snapshot (multi-user allow-list aware).
  created_by_email?: string | null
  created_by_name?: string | null
}

// Lightweight version descriptor used by the History list (no heavy content).
export interface MarkdownNoteVersionMeta {
  id: string
  note_id: string
  created_at: string
  created_by_email?: string | null
  created_by_name?: string | null
}

// The note shape the Markdown editor screen works with.
export interface MarkdownNoteEditorData {
  id: string
  study_id: string
  name: string
  description?: string | null
  note_type: NoteType
  is_public: boolean
  public_slug?: string | null
  content_json: NoteContentJSON | null
  content_updated_at?: string | null
  created_at: string
  updated_at?: string | null
}
