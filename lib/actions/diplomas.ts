"use server"

import * as db from "@/lib/mongodb/db"
import { requireUser } from "@/lib/auth-guard"

export async function uploadDiploma(studyId: string, fileArrayBuffer: ArrayBuffer, mimeType: string) {
  await requireUser()
  const buffer = Buffer.from(fileArrayBuffer)
  const diplomaUrl = await db.storeDiploma(studyId, buffer, mimeType)
  return diplomaUrl
}

export async function removeDiploma(studyId: string) {
  await requireUser()
  await db.deleteDiploma(studyId)
}
