"use server"

import * as db from "@/lib/mongodb/db"
import {
  copyFileToCache,
  createCacheShareLink,
  getCacheFolderConfig,
  checkFileExists,
  findFileByPath,
} from "@/lib/utils/onedrive-cache"
import type { CacheFolderConfig } from "@/lib/types/onedrive"

/**
 * Cache a file to the OneDrive cache directory.
 * Updates the DB document with cache_onedrive_id and cache_onedrive_web_url.
 */
export async function cacheFileToOneDrive(
  docId: string,
  onedriveId: string,
  fileName: string,
  studyId: string,
  type: "materials" | "study-notes",
  collection: "materials" | "subject_materials" | "study_notes"
): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getCacheFolderConfig()
    if (!config?.cache_folder_id) {
      return { success: false, error: "Cache folder not configured" }
    }

    const result = await copyFileToCache(onedriveId, fileName, studyId, docId, type)

    // Update the document with cache fields
    if (collection === "materials") {
      await db.updateMaterial(docId, {
        cache_onedrive_id: result.cacheOnedriveId,
        cache_onedrive_web_url: result.cacheWebUrl,
      })
    } else if (collection === "subject_materials") {
      await db.updateSubjectMaterial(docId, {
        cache_onedrive_id: result.cacheOnedriveId,
        cache_onedrive_web_url: result.cacheWebUrl,
      })
    } else if (collection === "study_notes") {
      await db.updateStudyNote(docId, {
        cache_onedrive_id: result.cacheOnedriveId,
        cache_onedrive_web_url: result.cacheWebUrl,
      })
    }

    return { success: true }
  } catch (error) {
    console.error("Failed to cache file to OneDrive:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Cache operation failed",
    }
  }
}

/**
 * Create a share link for a cache copy and store it on the document.
 */
export async function createCacheShareLinkAction(
  docId: string,
  cacheOnedriveId: string,
  collection: "materials" | "subject_materials"
): Promise<{ success: boolean; shareUrl?: string; error?: string }> {
  try {
    const shareUrl = await createCacheShareLink(cacheOnedriveId)

    if (collection === "materials") {
      await db.updateMaterial(docId, { cache_public_share_url: shareUrl })
    } else {
      await db.updateSubjectMaterial(docId, { cache_public_share_url: shareUrl })
    }

    return { success: true, shareUrl }
  } catch (error) {
    console.error("Failed to create cache share link:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Share link creation failed",
    }
  }
}

/**
 * Fetch app settings (cache folder config).
 */
export async function fetchAppSettings(): Promise<CacheFolderConfig | null> {
  return getCacheFolderConfig()
}

/**
 * Update app settings (cache folder config).
 */
export async function updateAppSettings(data: {
  cache_folder_id: string | null
  cache_folder_name: string
  cache_folder_path: string
}): Promise<void> {
  await db.upsertAppSettings(data)
}

interface SyncResult {
  total: number
  synced: number
  failed: number
  skipped: number
  errors: string[]
}

/**
 * Sync all existing documents to the cache directory.
 * For each material/study note with onedrive_id but no cache_onedrive_id,
 * copies the file to cache. For public materials, also creates cache share links.
 */
export async function syncAllToCache(): Promise<SyncResult> {
  const config = await getCacheFolderConfig()
  if (!config?.cache_folder_id) {
    return { total: 0, synced: 0, failed: 0, skipped: 0, errors: ["Cache folder not configured"] }
  }

  const result: SyncResult = { total: 0, synced: 0, failed: 0, skipped: 0, errors: [] }

  // Gather all documents that need caching
  const collections = [
    { name: "materials" as const, type: "materials" as const },
    { name: "subject_materials" as const, type: "materials" as const },
    { name: "study_notes" as const, type: "study-notes" as const },
  ]

  for (const { name: collectionName, type } of collections) {
    const docs = await db.getDocumentsNeedingCache(collectionName)
    result.total += docs.length

    for (const doc of docs) {
      const docId = doc._id as string
      const onedriveId = doc.onedrive_id as string
      const fileName = doc.file_name as string
      const studyId = doc.study_id as string

      // Check if original still exists
      const { exists } = await checkFileExists(onedriveId)
      if (!exists) {
        result.skipped++
        result.errors.push(`${collectionName}/${docId}: original file no longer exists in OneDrive`)
        continue
      }

      try {
        const cacheResult = await copyFileToCache(onedriveId, fileName, studyId, docId, type)

        // Update document
        const updateData: Record<string, string> = {
          cache_onedrive_id: cacheResult.cacheOnedriveId,
          cache_onedrive_web_url: cacheResult.cacheWebUrl,
        }

        if (collectionName === "materials") {
          await db.updateMaterial(docId, updateData)
        } else if (collectionName === "subject_materials") {
          await db.updateSubjectMaterial(docId, updateData)
        } else {
          await db.updateStudyNote(docId, updateData)
        }

        // For public materials, create cache share link
        if (
          (collectionName === "materials" || collectionName === "subject_materials") &&
          doc.is_public
        ) {
          try {
            const shareUrl = await createCacheShareLink(cacheResult.cacheOnedriveId)
            if (collectionName === "materials") {
              await db.updateMaterial(docId, { cache_public_share_url: shareUrl })
            } else {
              await db.updateSubjectMaterial(docId, { cache_public_share_url: shareUrl })
            }
          } catch {
            result.errors.push(`${collectionName}/${docId}: cached but share link creation failed`)
          }
        }

        result.synced++
      } catch (error) {
        result.failed++
        result.errors.push(
          `${collectionName}/${docId}: ${error instanceof Error ? error.message : "unknown error"}`
        )
      }

      // Rate limit: 500ms between operations
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  return result
}

/**
 * Sync documents whose original onedrive_id is stale (file was deleted and re-uploaded).
 * Matches by parent_path + file_name, updates onedrive_id to the new ID,
 * then copies to cache.
 */
export async function syncByFilename(): Promise<SyncResult> {
  const config = await getCacheFolderConfig()
  if (!config?.cache_folder_id) {
    return { total: 0, synced: 0, failed: 0, skipped: 0, errors: ["Cache folder not configured"] }
  }

  const result: SyncResult = { total: 0, synced: 0, failed: 0, skipped: 0, errors: [] }

  const collections = [
    { name: "materials" as const, type: "materials" as const },
    { name: "subject_materials" as const, type: "materials" as const },
    { name: "study_notes" as const, type: "study-notes" as const },
  ]

  for (const { name: collectionName, type } of collections) {
    const docs = await db.getDocumentsNeedingCache(collectionName)

    // Only process docs whose original ID is stale
    for (const doc of docs) {
      const docId = doc._id as string
      const onedriveId = doc.onedrive_id as string
      const fileName = doc.file_name as string
      const studyId = doc.study_id as string
      const parentPath = (doc.parent_path as string) || null

      // Skip if original ID still works
      const { exists } = await checkFileExists(onedriveId)
      if (exists) continue

      result.total++

      // Try to find the file by path/name
      const found = await findFileByPath(parentPath, fileName)

      if (!found) {
        result.skipped++
        result.errors.push(
          `${collectionName}/${docId}: "${fileName}" not found in OneDrive`
        )
        // Rate limit between search requests
        await new Promise((resolve) => setTimeout(resolve, 300))
        continue
      }

      try {
        // Update the document with the new onedrive_id
        const idUpdate: Record<string, string> = {
          onedrive_id: found.id,
          onedrive_web_url: found.webUrl,
        }
        if (found.downloadUrl) {
          idUpdate.onedrive_download_url = found.downloadUrl
        }

        if (collectionName === "materials") {
          await db.updateMaterial(docId, idUpdate)
        } else if (collectionName === "subject_materials") {
          await db.updateSubjectMaterial(docId, idUpdate)
        } else {
          await db.updateStudyNote(docId, idUpdate)
        }

        // Now copy to cache using the new ID
        const cacheResult = await copyFileToCache(found.id, fileName, studyId, docId, type)

        const cacheUpdate: Record<string, string> = {
          cache_onedrive_id: cacheResult.cacheOnedriveId,
          cache_onedrive_web_url: cacheResult.cacheWebUrl,
        }

        if (collectionName === "materials") {
          await db.updateMaterial(docId, cacheUpdate)
        } else if (collectionName === "subject_materials") {
          await db.updateSubjectMaterial(docId, cacheUpdate)
        } else {
          await db.updateStudyNote(docId, cacheUpdate)
        }

        // For public materials, create cache share link
        if (
          (collectionName === "materials" || collectionName === "subject_materials") &&
          doc.is_public
        ) {
          try {
            const shareUrl = await createCacheShareLink(cacheResult.cacheOnedriveId)
            if (collectionName === "materials") {
              await db.updateMaterial(docId, { cache_public_share_url: shareUrl })
            } else {
              await db.updateSubjectMaterial(docId, { cache_public_share_url: shareUrl })
            }
          } catch {
            result.errors.push(`${collectionName}/${docId}: cached but share link failed`)
          }
        }

        result.synced++
      } catch (error) {
        result.failed++
        result.errors.push(
          `${collectionName}/${docId}: ${error instanceof Error ? error.message : "unknown error"}`
        )
      }

      // Rate limit: 500ms between operations
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  return result
}
