"use server"

import * as db from "@/lib/mongodb/db"

export async function fetchExamOptions(subjectId: string) {
  const docs = await db.getExamOptionsBySubjectId(subjectId)
  return db.normalizeIds(docs)
}

export async function fetchExamOptionsBySubjectIds(subjectIds: string[]) {
  const docs = await db.getExamOptionsBySubjectIds(subjectIds)
  return db.normalizeIds(docs)
}

export async function saveExamOptions(subjectId: string, options: Record<string, any>[]) {
  await db.deleteExamOptionsBySubjectId(subjectId)
  if (options.length > 0) {
    const optionsToInsert = options.map((opt) => ({
      subject_id: subjectId,
      ...opt,
    }))
    await db.insertExamOptions(optionsToInsert)
  }
}
