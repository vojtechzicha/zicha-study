import { OneDriveFile } from './materials'

export interface StudyNote {
  id: string
  subject_id: string
  study_id: string
  user_id: string
  
  // OneDrive metadata
  name: string
  file_name: string
  file_extension: string | null
  file_size: number | null
  mime_type: string | null
  onedrive_id: string
  onedrive_web_url: string
  onedrive_download_url: string | null
  parent_path: string | null
  
  // Additional metadata
  description: string | null
  
  // Public sharing (published by default)
  is_public: boolean
  public_slug: string
  
  // Timestamps
  created_at: string
  updated_at: string
  last_modified_onedrive: string | null
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