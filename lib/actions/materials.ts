"use server"

import * as db from "@/lib/mongodb/db"
import { cleanupEmptyCacheDirectories, deleteCacheFile } from "@/lib/utils/onedrive-cache"

export async function fetchMaterials(studyId: string) {
  const docs = await db.getMaterialsByStudyId(studyId)
  return db.normalizeIds(docs)
}

export async function fetchPublicMaterials(studyId: string) {
  const docs = await db.getPublicMaterialsByStudyId(studyId)
  return db.normalizeIds(docs)
}

export async function createMaterial(data: Record<string, any>) {
  try {
    const doc = await db.createMaterial(data)
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Unknown error" } }
  }
}

export async function createSubjectMaterial(data: Record<string, any>) {
  try {
    const doc = await db.createSubjectMaterial(data)
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Unknown error" } }
  }
}

export async function updateMaterialAction(id: string, data: Record<string, any>) {
  try {
    await db.updateMaterial(id, data)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function deleteMaterialAction(id: string) {
  try {
    const material = await db.getMaterialById(id)
    await deleteCacheFile(material?.cache_onedrive_id as string | null | undefined)
    if (material?.study_id) {
      await cleanupEmptyCacheDirectories(material.study_id as string)
    }

    await db.deleteMaterial(id)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function checkMaterialSlug(studyId: string, slug: string, excludeId?: string) {
  return db.checkMaterialSlugAvailability(studyId, slug, excludeId)
}

export async function checkSubjectMaterialSlug(studyId: string, slug: string, excludeId?: string) {
  return db.checkSubjectMaterialSlugAvailability(studyId, slug, excludeId)
}

export async function fetchSubjectMaterials(subjectId: string) {
  const docs = await db.getSubjectMaterialsBySubjectId(subjectId)
  return db.normalizeIds(docs)
}

export async function deleteSubjectMaterialAction(id: string) {
  try {
    const material = await db.getSubjectMaterialById(id)
    await deleteCacheFile(material?.cache_onedrive_id as string | null | undefined)
    if (material?.study_id) {
      await cleanupEmptyCacheDirectories(material.study_id as string)
    }

    await db.deleteSubjectMaterial(id)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}

export async function updateSubjectMaterialAction(id: string, data: Record<string, any>) {
  try {
    await db.updateSubjectMaterial(id, data)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Unknown error" } }
  }
}
