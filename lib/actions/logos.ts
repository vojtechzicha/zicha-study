"use server"

import * as db from "@/lib/mongodb/db"
import { requireUser } from "@/lib/auth-guard"

export async function uploadLogo(studyId: string, fileArrayBuffer: ArrayBuffer, mimeType: string) {
  await requireUser()
  const buffer = Buffer.from(fileArrayBuffer)
  const logoUrl = await db.storeLogo(studyId, buffer, mimeType)
  return logoUrl
}

export async function removeLogo(studyId: string) {
  await requireUser()
  await db.deleteLogo(studyId)
}
