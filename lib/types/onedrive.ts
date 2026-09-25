export interface OneDriveParentReference {
  driveId?: string
  driveType?: string
  id?: string
  path?: string
}

export interface OneDriveFileInfo {
  mimeType: string
  hashes?: {
    quickXorHash?: string
    sha1Hash?: string
    sha256Hash?: string
  }
}

export interface OneDriveFolderInfo {
  childCount: number
}

// Raw driveItem as returned by Microsoft Graph
export interface OneDriveItem {
  id: string
  name: string
  size?: number
  webUrl?: string
  createdDateTime?: string
  lastModifiedDateTime?: string
  parentReference?: OneDriveParentReference
  file?: OneDriveFileInfo
  folder?: OneDriveFolderInfo
  "@microsoft.graph.downloadUrl"?: string
}

// Folder-picker item; id is null for the drive root
export interface OneDriveFolderItem {
  id: string | null
  name: string
  webUrl?: string
  createdDateTime?: string
  lastModifiedDateTime?: string
  parentReference?: OneDriveParentReference
  folder: OneDriveFolderInfo
  isRoot?: boolean
}

export interface OneDriveFileItem {
  id: string
  name: string
  size?: number
  webUrl?: string
  createdDateTime?: string
  lastModifiedDateTime?: string
  "@microsoft.graph.downloadUrl"?: string
  file: OneDriveFileInfo
  parentReference?: OneDriveParentReference
}

export type OneDriveProcessedItem = OneDriveFolderItem | OneDriveFileItem

export interface OneDriveListResponse {
  value: OneDriveItem[]
  "@odata.nextLink"?: string
  "@odata.context"?: string
}

export interface OneDriveError {
  code: string
  message: string
  innerError?: {
    code?: string
    "request-id"?: string
    date?: string
  }
}

export interface OneDriveErrorResponse {
  error: OneDriveError
}

// Folder path history item for breadcrumb navigation
export interface FolderPathHistoryItem {
  name: string
  path: string
}

export interface MaterialsRootFolder {
  id: string | null
  name: string
  path: string
}

// Cache folder configuration (global app setting)
export interface CacheFolderConfig {
  cache_folder_id: string | null
  cache_folder_name: string
  cache_folder_path: string
}

export function isOneDriveFolder(item: OneDriveItem): boolean {
  return !!item.folder
}

export function isOneDriveFile(item: OneDriveItem): boolean {
  return !!item.file
}

export function isOneDriveError(response: OneDriveListResponse | OneDriveErrorResponse): response is OneDriveErrorResponse {
  return 'error' in response
}
