"use server"

import * as db from "@/lib/mongodb/db"

export async function uploadDiploma(studyId: string, fileArrayBuffer: ArrayBuffer, mimeType: string) {
  const buffer = Buffer.from(fileArrayBuffer)
  const diplomaUrl = await db.storeDiploma(studyId, buffer, mimeType)
  return diplomaUrl
}

export async function removeDiploma(studyId: string) {
  await db.deleteDiploma(studyId)
}
