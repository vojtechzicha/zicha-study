"use server"

import * as db from "@/lib/mongodb/db"
import { requireUser } from "@/lib/auth-guard"
import { deleteCacheFiles, deleteStudyCacheDirectory } from "@/lib/utils/onedrive-cache"

export async function fetchStudies() {
  await requireUser()
  const docs = await db.getStudies()
  return db.normalizeIds(docs)
}

export async function fetchStudy(id: string) {
  await requireUser()
  const doc = await db.getStudyById(id)
  return db.normalizeId(doc)
}

export async function fetchStudyBySlug(slug: string) {
  await requireUser()
  const doc = await db.getStudyBySlug(slug)
  return db.normalizeId(doc)
}

export async function createStudy(data: Record<string, any>) {
  await requireUser()
  const doc = await db.createStudy(data)
  return db.normalizeId(doc)
}

export async function updateStudy(id: string, data: Record<string, any>) {
  await requireUser()
  await db.updateStudy(id, data)
}

export async function deleteStudyAction(id: string) {
  await requireUser()
  const cacheOneDriveIds = await db.getCacheOneDriveIdsByStudyId(id)
  await deleteCacheFiles(cacheOneDriveIds)
  await deleteStudyCacheDirectory(id)
  await db.deleteStudy(id)
}

export async function checkSlugAvailability(slug: string, excludeId?: string) {
  await requireUser()
  return db.checkStudySlugAvailability(slug, excludeId)
}

export async function fetchStudyMaterialSettings(studyId: string) {
  await requireUser()
  const doc = await db.getStudyById(studyId)
  if (!doc) return null
  return {
    materials_root_folder_id: doc.materials_root_folder_id,
    materials_root_folder_name: doc.materials_root_folder_name,
    materials_root_folder_path: doc.materials_root_folder_path,
  }
}

export async function fetchStudiesWithPublicSlug() {
  await requireUser()
  const docs = await db.getStudiesWithPublicSlug()
  return db.normalizeIds(docs)
}
