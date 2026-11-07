"use server"

import * as db from "@/lib/mongodb/db"
import { getSessionUser, requireUser } from "@/lib/auth-guard"
import { cleanupEmptyCacheDirectories, deleteCacheFile } from "@/lib/utils/onedrive-cache"
import { prepareMaterialData } from "@/lib/utils/material-link"
import { MATERIAL_TYPES, getMaterialType } from "@/lib/constants"

// Updates keep the stored type; link_url is validated against it
async function prepareMaterialUpdate(
  loadExisting: () => Promise<Record<string, any> | null>,
  data: Record<string, any>
) {
  if (!("material_type" in data) && !("link_url" in data)) return data
  const existing = await loadExisting()
  if (!existing) throw new Error("Materiál nebyl nalezen.")
  if ("material_type" in data && getMaterialType(data) !== getMaterialType(existing)) {
    throw new Error("Typ materiálu nejde změnit.")
  }
  return prepareMaterialData({ ...data, material_type: getMaterialType(existing) })
}

// Link materials have no backup copy in OneDrive
async function deleteMaterialCache(material: Record<string, any> | null) {
  if (!material || getMaterialType(material) === MATERIAL_TYPES.LINK) return
  await deleteCacheFile(material.cache_onedrive_id as string | null | undefined)
  if (material.study_id) {
    await cleanupEmptyCacheDirectories(material.study_id as string)
  }
}

export async function fetchMaterials(studyId: string) {
  await requireUser()
  const docs = await db.getMaterialsByStudyId(studyId)
  return db.normalizeIds(docs)
}

// Called by the public study page, so it must work signed out. Anonymous
// callers only get public materials of a published study.
export async function fetchPublicMaterials(studyId: string) {
  if (!(await getSessionUser())) {
    const publicStudyIds = await db.getPublicStudyIds([studyId])
    if (!publicStudyIds.has(studyId)) return []
  }
  const docs = await db.getPublicMaterialsByStudyId(studyId)
  return db.normalizeIds(docs)
}

export async function createMaterial(data: Record<string, any>) {
  try {
    await requireUser()
    const doc = await db.createMaterial(prepareMaterialData(data))
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Neznámá chyba." } }
  }
}

export async function createSubjectMaterial(data: Record<string, any>) {
  try {
    await requireUser()
    const doc = await db.createSubjectMaterial(prepareMaterialData(data))
    return { data: db.normalizeId(doc), error: null }
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Neznámá chyba." } }
  }
}

export async function updateMaterialAction(id: string, data: Record<string, any>) {
  try {
    await requireUser()
    await db.updateMaterial(id, await prepareMaterialUpdate(() => db.getMaterialById(id), data))
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Neznámá chyba." } }
  }
}

export async function deleteMaterialAction(id: string) {
  try {
    await requireUser()
    await deleteMaterialCache(await db.getMaterialById(id))

    await db.deleteMaterial(id)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Neznámá chyba." } }
  }
}

export async function checkMaterialSlug(studyId: string, slug: string, excludeId?: string) {
  await requireUser()
  return db.checkMaterialSlugAvailability(studyId, slug, excludeId)
}

export async function checkSubjectMaterialSlug(studyId: string, slug: string, excludeId?: string) {
  await requireUser()
  return db.checkSubjectMaterialSlugAvailability(studyId, slug, excludeId)
}

export async function fetchSubjectMaterials(subjectId: string) {
  await requireUser()
  const docs = await db.getSubjectMaterialsBySubjectId(subjectId)
  return db.normalizeIds(docs)
}

export async function deleteSubjectMaterialAction(id: string) {
  try {
    await requireUser()
    await deleteMaterialCache(await db.getSubjectMaterialById(id))

    await db.deleteSubjectMaterial(id)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Neznámá chyba." } }
  }
}

export async function updateSubjectMaterialAction(id: string, data: Record<string, any>) {
  try {
    await requireUser()
    await db.updateSubjectMaterial(id, await prepareMaterialUpdate(() => db.getSubjectMaterialById(id), data))
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Neznámá chyba." } }
  }
}
