export interface Material {
  id: string
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
  category: string | null
  tags: string[] | null
  
  // Timestamps
  created_at: string
  updated_at: string
  last_modified_onedrive: string | null
}

export interface OneDriveFile {
  id: string
  name: string
  size?: number
  file?: {
    mimeType: string
    hashes?: {
      quickXorHash?: string
      sha1Hash?: string
      sha256Hash?: string
    }
  }
  folder?: {
    childCount: number
  }
  parentReference?: {
    path: string
    driveId: string
    driveType: string
  }
  webUrl: string
  createdDateTime: string
  lastModifiedDateTime: string
  "@microsoft.graph.downloadUrl"?: string
}

export interface MaterialFormData {
  name: string
  description?: string
  category?: string
  tags?: string[]
  onedrive_file: OneDriveFile
}