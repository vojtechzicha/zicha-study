import { makeGraphRequest } from "./onedrive"
import * as db from "@/lib/mongodb/db"
import type { CacheFolderConfig } from "@/lib/types/onedrive"

const GRAPH_BASE = "https://graph.microsoft.com/v1.0"
const SIMPLE_UPLOAD_MAX_SIZE = 4 * 1024 * 1024 // 4MB
type CacheDirectoryType = "materials" | "study-notes"

/**
 * Read cache folder config from app_settings.
 */
export async function getCacheFolderConfig(): Promise<CacheFolderConfig | null> {
  const settings = await db.getAppSettings()
  if (!settings?.cache_folder_id) return null
  return {
    cache_folder_id: settings.cache_folder_id,
    cache_folder_name: settings.cache_folder_name,
    cache_folder_path: settings.cache_folder_path,
  }
}

/**
 * Ensure the nested subfolder structure exists inside the cache root.
 * Structure: [Cache Root] / [studyId first 8 chars] / [type]
 * Returns the final folder ID.
 */
export async function ensureCacheSubfolder(
  studyId: string,
  type: CacheDirectoryType
): Promise<string> {
  const config = await getCacheFolderConfig()
  if (!config?.cache_folder_id) {
    throw new Error("Cache folder not configured")
  }

  // Create or get study subfolder
  const studyFolderName = studyId.substring(0, 8)
  const studyFolderId = await createFolderIfNotExists(
    config.cache_folder_id,
    studyFolderName
  )

  // Create or get type subfolder
  const typeFolderId = await createFolderIfNotExists(studyFolderId, type)

  return typeFolderId
}

function cacheStudyFolderName(studyId: string): string {
  return studyId.substring(0, 8)
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0
}

async function deleteDriveItem(itemId: string): Promise<void> {
  const response = await makeGraphRequest(
    `${GRAPH_BASE}/me/drive/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE" }
  )

  if (response.ok || response.status === 404) {
    return
  }

  throw new Error(`Failed to delete OneDrive cache item: ${response.status}`)
}

async function findChildFolder(parentId: string, folderName: string): Promise<string | null> {
  const params = new URLSearchParams({
    "$filter": `name eq '${folderName.replace(/'/g, "''")}'`,
    "$select": "id,name,folder",
  })
  const response = await makeGraphRequest(
    `${GRAPH_BASE}/me/drive/items/${encodeURIComponent(parentId)}/children?${params.toString()}`
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Failed to inspect OneDrive cache folder: ${response.status}`)
  }

  const data = await response.json()
  const folder = data.value?.find(
    (item: { id?: string; name?: string; folder?: unknown }) =>
      item.name === folderName && item.folder && item.id
  )

  return folder?.id ?? null
}

async function isDriveFolderEmpty(folderId: string): Promise<boolean> {
  const params = new URLSearchParams({
    "$top": "1",
    "$select": "id",
  })
  const response = await makeGraphRequest(
    `${GRAPH_BASE}/me/drive/items/${encodeURIComponent(folderId)}/children?${params.toString()}`
  )

  if (response.status === 404) {
    return true
  }

  if (!response.ok) {
    throw new Error(`Failed to inspect OneDrive cache folder contents: ${response.status}`)
  }

  const data = await response.json()
  return !data.value?.length
}

/**
 * Delete cached OneDrive copies only. This never targets the original file ID.
 */
export async function deleteCacheFiles(
  cacheOnedriveIds: Array<string | null | undefined>
): Promise<void> {
  const uniqueIds = Array.from(new Set(cacheOnedriveIds.filter(isNonEmptyString)))

  for (const cacheOnedriveId of uniqueIds) {
    await deleteDriveItem(cacheOnedriveId)
  }
}

export async function deleteCacheFile(cacheOnedriveId: string | null | undefined): Promise<void> {
  await deleteCacheFiles([cacheOnedriveId])
}

export async function cleanupEmptyCacheDirectories(
  studyId: string,
  types: CacheDirectoryType[] = ["materials", "study-notes"]
): Promise<void> {
  const config = await getCacheFolderConfig()
  if (!config?.cache_folder_id) {
    return
  }

  const studyFolderId = await findChildFolder(config.cache_folder_id, cacheStudyFolderName(studyId))
  if (!studyFolderId) {
    return
  }

  for (const type of types) {
    const typeFolderId = await findChildFolder(studyFolderId, type)
    if (typeFolderId && await isDriveFolderEmpty(typeFolderId)) {
      await deleteDriveItem(typeFolderId)
    }
  }

  if (await isDriveFolderEmpty(studyFolderId)) {
    await deleteDriveItem(studyFolderId)
  }
}

export async function deleteStudyCacheDirectory(studyId: string): Promise<void> {
  const config = await getCacheFolderConfig()
  if (!config?.cache_folder_id) {
    return
  }

  const studyFolderId = await findChildFolder(config.cache_folder_id, cacheStudyFolderName(studyId))
  if (studyFolderId) {
    await deleteDriveItem(studyFolderId)
  }
}

/**
 * Create a folder inside a parent. If it already exists, return the existing one.
 */
async function createFolderIfNotExists(
  parentId: string,
  folderName: string
): Promise<string> {
  const response = await makeGraphRequest(
    `${GRAPH_BASE}/me/drive/items/${parentId}/children`,
    {
      method: "POST",
      body: JSON.stringify({
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "replace",
      }),
    }
  )

  if (response.ok) {
    const data = await response.json()
    return data.id
  }

  // If conflict (folder exists), find it by listing children
  const listResponse = await makeGraphRequest(
    `${GRAPH_BASE}/me/drive/items/${parentId}/children?$filter=name eq '${folderName}'`
  )

  if (listResponse.ok) {
    const listData = await listResponse.json()
    if (listData.value?.length > 0) {
      return listData.value[0].id
    }
  }

  throw new Error(`Failed to create or find folder: ${folderName}`)
}

/**
 * Copy a file to the cache directory.
 * Downloads from original, uploads to cache folder.
 * Returns { cacheOnedriveId, cacheWebUrl }.
 */
export async function copyFileToCache(
  onedriveId: string,
  fileName: string,
  studyId: string,
  docId: string,
  type: CacheDirectoryType
): Promise<{ cacheOnedriveId: string; cacheWebUrl: string }> {
  const folderId = await ensureCacheSubfolder(studyId, type)

  // Download original file content
  const downloadResponse = await makeGraphRequest(
    `${GRAPH_BASE}/me/drive/items/${onedriveId}/content`
  )

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download original file: ${downloadResponse.status}`)
  }

  const fileBuffer = await downloadResponse.arrayBuffer()
  const cacheFileName = `${docId}_${fileName}`

  // Upload to cache folder
  let uploadData: { id: string; webUrl: string }

  if (fileBuffer.byteLength <= SIMPLE_UPLOAD_MAX_SIZE) {
    // Simple upload for files <= 4MB
    uploadData = await simpleUpload(folderId, cacheFileName, fileBuffer)
  } else {
    // Upload session for larger files
    uploadData = await sessionUpload(folderId, cacheFileName, fileBuffer)
  }

  return {
    cacheOnedriveId: uploadData.id,
    cacheWebUrl: uploadData.webUrl,
  }
}

/**
 * Simple PUT upload for files <= 4MB.
 */
async function simpleUpload(
  folderId: string,
  fileName: string,
  buffer: ArrayBuffer
): Promise<{ id: string; webUrl: string }> {
  const encodedName = encodeURIComponent(fileName)
  const response = await makeGraphRequest(
    `${GRAPH_BASE}/me/drive/items/${folderId}:/${encodedName}:/content`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: Buffer.from(buffer),
    }
  )

  if (!response.ok) {
    throw new Error(`Simple upload failed: ${response.status}`)
  }

  const data = await response.json()
  return { id: data.id, webUrl: data.webUrl }
}

/**
 * Upload session for files > 4MB.
 */
async function sessionUpload(
  folderId: string,
  fileName: string,
  buffer: ArrayBuffer
): Promise<{ id: string; webUrl: string }> {
  const encodedName = encodeURIComponent(fileName)

  // Create upload session
  const sessionResponse = await makeGraphRequest(
    `${GRAPH_BASE}/me/drive/items/${folderId}:/${encodedName}:/createUploadSession`,
    {
      method: "POST",
      body: JSON.stringify({
        item: {
          "@microsoft.graph.conflictBehavior": "replace",
          name: fileName,
        },
      }),
    }
  )

  if (!sessionResponse.ok) {
    throw new Error(`Failed to create upload session: ${sessionResponse.status}`)
  }

  const sessionData = await sessionResponse.json()
  const uploadUrl = sessionData.uploadUrl
  const fileSize = buffer.byteLength
  const chunkSize = 10 * 1024 * 1024 // 10MB chunks

  let offset = 0
  let lastResponse: Response | null = null

  while (offset < fileSize) {
    const end = Math.min(offset + chunkSize, fileSize)
    const chunk = buffer.slice(offset, end)

    lastResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.byteLength),
        "Content-Range": `bytes ${offset}-${end - 1}/${fileSize}`,
      },
      body: Buffer.from(chunk),
    })

    if (!lastResponse.ok && lastResponse.status !== 202) {
      throw new Error(`Chunk upload failed: ${lastResponse.status}`)
    }

    offset = end
  }

  if (!lastResponse) {
    throw new Error("No upload response received")
  }

  const data = await lastResponse.json()
  return { id: data.id, webUrl: data.webUrl }
}

/**
 * Update cache copy from original (when original is newer).
 * Downloads from original, replaces cache file content.
 */
export async function updateCacheFromOriginal(
  originalOnedriveId: string,
  cacheOnedriveId: string
): Promise<void> {
  const downloadResponse = await makeGraphRequest(
    `${GRAPH_BASE}/me/drive/items/${originalOnedriveId}/content`
  )

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download original: ${downloadResponse.status}`)
  }

  const fileBuffer = await downloadResponse.arrayBuffer()

  const uploadResponse = await makeGraphRequest(
    `${GRAPH_BASE}/me/drive/items/${cacheOnedriveId}/content`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: Buffer.from(fileBuffer),
    }
  )

  if (!uploadResponse.ok) {
    throw new Error(`Failed to update cache: ${uploadResponse.status}`)
  }
}

/**
 * Check if a file exists in OneDrive.
 * Returns existence status and last modified date.
 */
export async function checkFileExists(
  onedriveId: string
): Promise<{ exists: boolean; lastModified?: Date }> {
  try {
    const response = await makeGraphRequest(
      `${GRAPH_BASE}/me/drive/items/${onedriveId}?$select=id,lastModifiedDateTime`
    )

    if (response.ok) {
      const data = await response.json()
      return {
        exists: true,
        lastModified: new Date(data.lastModifiedDateTime),
      }
    }

    return { exists: false }
  } catch {
    return { exists: false }
  }
}

/**
 * Create an anonymous share link for a cache copy.
 * Same pattern as /api/onedrive/share.
 */
export async function createCacheShareLink(
  cacheOnedriveId: string
): Promise<string> {
  const shareResponse = await makeGraphRequest(
    `${GRAPH_BASE}/me/drive/items/${cacheOnedriveId}/createLink`,
    {
      method: "POST",
      body: JSON.stringify({
        type: "view",
        scope: "anonymous",
      }),
    }
  )

  if (shareResponse.ok) {
    const shareData = await shareResponse.json()
    return shareData.link.webUrl
  }

  // Fallback: for personal accounts that don't support anonymous sharing
  const fileResponse = await makeGraphRequest(
    `${GRAPH_BASE}/me/drive/items/${cacheOnedriveId}`
  )

  if (fileResponse.ok) {
    const fileData = await fileResponse.json()
    return fileData.webUrl
  }

  throw new Error("Failed to create share link for cache copy")
}

/**
 * Find a file in OneDrive by its parent path and filename.
 * Used when the original onedrive_id is stale (file was re-uploaded).
 * Returns the new item metadata or null if not found.
 */
export async function findFileByPath(
  parentPath: string | null,
  fileName: string
): Promise<{ id: string; webUrl: string; downloadUrl?: string; lastModified: Date } | null> {
  // Strategy 1: Path-based lookup if we have parent_path
  if (parentPath) {
    // parentPath format: "/drive/root:/Folder/Subfolder" or "/drive/root:"
    // We need: GET /me/drive/root:/Folder/Subfolder/filename.ext
    const pathPrefix = parentPath.replace(/^\/drive\/root:?\/?/, "")
    const fullPath = pathPrefix
      ? `${pathPrefix}/${fileName}`
      : fileName
    const encodedPath = fullPath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")

    try {
      const response = await makeGraphRequest(
        `${GRAPH_BASE}/me/drive/root:/${encodedPath}`
      )

      if (response.ok) {
        const data = await response.json()
        // Make sure it's a file, not a folder
        if (data.file) {
          return {
            id: data.id,
            webUrl: data.webUrl,
            downloadUrl: data["@microsoft.graph.downloadUrl"],
            lastModified: new Date(data.lastModifiedDateTime),
          }
        }
      }
    } catch {
      // Path lookup failed, try search
    }
  }

  // Strategy 2: Search by filename across the entire drive
  try {
    const response = await makeGraphRequest(
      `${GRAPH_BASE}/me/drive/search(q='${encodeURIComponent(fileName)}')?$top=5`
    )

    if (response.ok) {
      const data = await response.json()
      // Find exact filename match
      const match = data.value?.find(
        (item: { name: string; file?: unknown }) =>
          item.name === fileName && item.file
      )
      if (match) {
        return {
          id: match.id,
          webUrl: match.webUrl,
          downloadUrl: match["@microsoft.graph.downloadUrl"],
          lastModified: new Date(match.lastModifiedDateTime),
        }
      }
    }
  } catch {
    // Search also failed
  }

  return null
}

/**
 * Download file content from OneDrive by item ID.
 * Returns the file buffer and metadata, or null if not accessible.
 */
export async function downloadFromOneDrive(
  onedriveId: string
): Promise<{ buffer: ArrayBuffer; lastModified: Date } | null> {
  try {
    const metadataResponse = await makeGraphRequest(
      `${GRAPH_BASE}/me/drive/items/${onedriveId}`
    )

    if (!metadataResponse.ok) return null

    const metadata = await metadataResponse.json()
    const lastModified = new Date(metadata.lastModifiedDateTime)

    const downloadResponse = await makeGraphRequest(
      `${GRAPH_BASE}/me/drive/items/${onedriveId}/content`
    )

    if (!downloadResponse.ok) return null

    const buffer = await downloadResponse.arrayBuffer()
    return { buffer, lastModified }
  } catch {
    return null
  }
}
