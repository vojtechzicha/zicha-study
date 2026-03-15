"use server"

import * as db from "@/lib/mongodb/db"

export async function uploadLogo(studyId: string, fileArrayBuffer: ArrayBuffer, mimeType: string) {
  const buffer = Buffer.from(fileArrayBuffer)
  const logoUrl = await db.storeLogo(studyId, buffer, mimeType)
  return logoUrl
}

export async function removeLogo(studyId: string) {
  await db.deleteLogo(studyId)
}
