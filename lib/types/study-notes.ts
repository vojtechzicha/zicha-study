import { OneDriveFile } from './materials'

export interface StudyNote {
  id: string
  subject_id?: string | null
  study_id: string
  user_id: string

  // Discriminator: 'word' (OneDrive DOCX, legacy) | 'markdown' (in-app editor)
  // | 'obsidian' (OneDrive .md file, read-only mirror of an Obsidian vault).
  // Absent on legacy rows → treated as 'word'. See getNoteType() in lib/constants.
  note_type?: string | null

  // OneDrive metadata
  name: string
  file_name: string
  file_extension: string | null
  file_size?: number | null
  mime_type?: string | null
  onedrive_id?: string | null
  onedrive_item_id?: string | null
  onedrive_web_url?: string | null
  onedrive_download_url?: string | null
  onedrive_embed_url?: string | null
  parent_path?: string | null

  description?: string | null

  // Public sharing (published by default)
  is_public: boolean
  public_slug?: string | null

  // OneDrive cache
  cache_onedrive_id?: string | null
  cache_onedrive_web_url?: string | null

  // Converted HTML cache
  converted_html?: string | null
  converted_at?: string | null
  onedrive_ctag?: string | null

  created_at: string
  updated_at?: string
  last_modified_onedrive?: string | null
  // Markdown notes: timestamp of the last content edit (autosave/version).
  content_updated_at?: string | null
}

export interface StudyNoteFormData {
  name: string
  description?: string
  onedrive_file: OneDriveFile
}

export interface UpdateStudyNoteData {
  name?: string
  description?: string
  public_slug?: string
  is_public?: boolean
}

export interface StudyNoteSubjectLink {
  id: string
  study_note_id?: string
  subject_id: string
  is_primary: boolean
  linked_at?: string
  linked_by?: string | null
}

export interface StudyNoteFinalExamLink {
  id: string
  study_note_id?: string
  final_exam_id: string
  is_primary: boolean
  linked_at?: string
  linked_by?: string | null
}

// Element of the denormalized link arrays on a study_notes document
export interface RawStudyNoteSubjectLink {
  id: string
  is_primary: boolean
  subject_id: string
}

// Element of the denormalized link arrays on a study_notes document
export interface RawStudyNoteFinalExamLink {
  id: string
  is_primary: boolean
  final_exam_id: string
}

export interface SubjectInfo {
  id: string
  name: string
  study_id: string
}

export interface FinalExamInfo {
  id: string
  name: string
  shortcut?: string
  study_id: string
}

export interface StudyNoteSubject {
  id: string
  name: string
  study_id: string
  is_primary: boolean
  is_final_exam?: boolean
  shortcut?: string | null
}

export interface StudyNoteWithSubjects extends StudyNote {
  // Denormalized link arrays stored on the note document
  linked_subjects?: RawStudyNoteSubjectLink[]
  linked_final_exams?: RawStudyNoteFinalExamLink[]
  // Not populated by the MongoDB layer; use linked_subjects / linked_final_exams
  study_note_subjects?: StudyNoteSubjectLink[] | RawStudyNoteSubjectLink[]
  study_note_final_exams?: StudyNoteFinalExamLink[] | RawStudyNoteFinalExamLink[]
  subjects?: StudyNoteSubject[]
}