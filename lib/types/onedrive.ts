/**
 * OneDrive TypeScript Types
 *
 * Proper interfaces for OneDrive/Microsoft Graph API responses.
 */

// Parent reference for file/folder location
export interface OneDriveParentReference {
  driveId?: string
  driveType?: string
  id?: string
  path?: string
}

// File information
export interface OneDriveFileInfo {
  mimeType: string
  hashes?: {
    quickXorHash?: string
    sha1Hash?: string
    sha256Hash?: string
  }
}

// Folder information
export interface OneDriveFolderInfo {
  childCount: number
}

// Base item from Microsoft Graph API
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

// Processed folder item for folder picker
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

// Processed file item
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

// Combined processed item (can be folder or file)
export type OneDriveProcessedItem = OneDriveFolderItem | OneDriveFileItem

// Microsoft Graph API list response
export interface OneDriveListResponse {
  value: OneDriveItem[]
  "@odata.nextLink"?: string
  "@odata.context"?: string
}

// Error response from Microsoft Graph API
export interface OneDriveError {
  code: string
  message: string
  innerError?: {
    code?: string
    "request-id"?: string
    date?: string
  }
}

// Microsoft Graph API error response
export interface OneDriveErrorResponse {
  error: OneDriveError
}

// Folder path history item for breadcrumb navigation
export interface FolderPathHistoryItem {
  name: string
  path: string
}

// Materials root folder state
export interface MaterialsRootFolder {
  id: string | null
  name: string
  path: string
}

// Type guard to check if an item is a folder
export function isOneDriveFolder(item: OneDriveItem): boolean {
  return !!item.folder
}

// Type guard to check if an item is a file
export function isOneDriveFile(item: OneDriveItem): boolean {
  return !!item.file
}

// Type guard to check if response is an error
export function isOneDriveError(response: OneDriveListResponse | OneDriveErrorResponse): response is OneDriveErrorResponse {
  return 'error' in response
}
