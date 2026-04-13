import { OneDriveFile } from './materials'

export interface StudyNote {
  id: string
  subject_id?: string | null
  study_id: string
  user_id: string

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

  // Additional metadata
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

  // Timestamps
  created_at: string
  updated_at?: string
  last_modified_onedrive?: string | null
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

// Many-to-many relationship
export interface StudyNoteSubjectLink {
  id: string
  study_note_id?: string
  subject_id: string
  is_primary: boolean
  linked_at?: string
  linked_by?: string | null
}

// Final exam link (similar to subject link)
export interface StudyNoteFinalExamLink {
  id: string
  study_note_id?: string
  final_exam_id: string
  is_primary: boolean
  linked_at?: string
  linked_by?: string | null
}

// Raw link from denormalized array in study_notes document
export interface RawStudyNoteSubjectLink {
  id: string
  is_primary: boolean
  subject_id: string
}

// Raw link from denormalized array in study_notes document
export interface RawStudyNoteFinalExamLink {
  id: string
  is_primary: boolean
  final_exam_id: string
}

// Subject info for display
export interface SubjectInfo {
  id: string
  name: string
  study_id: string
}

// Final exam info for display
export interface FinalExamInfo {
  id: string
  name: string
  shortcut?: string
  study_id: string
}

// Subject info for display in study notes
export interface StudyNoteSubject {
  id: string
  name: string
  study_id: string
  is_primary: boolean
  is_final_exam?: boolean
  shortcut?: string | null
}

// Extended study note with subject links
export interface StudyNoteWithSubjects extends StudyNote {
  // Denormalized arrays stored in MongoDB document
  linked_subjects?: RawStudyNoteSubjectLink[]
  linked_final_exams?: RawStudyNoteFinalExamLink[]
  // Legacy Supabase join table fields (kept for compatibility)
  study_note_subjects?: StudyNoteSubjectLink[] | RawStudyNoteSubjectLink[]
  study_note_final_exams?: StudyNoteFinalExamLink[] | RawStudyNoteFinalExamLink[]
  subjects?: StudyNoteSubject[]
}