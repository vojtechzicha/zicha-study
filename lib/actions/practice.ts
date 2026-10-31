"use server"

import * as db from "@/lib/mongodb/db"
import { requireUser } from "@/lib/auth-guard"

// Marks an example of a practice page as gone through ("Prošel jsem") or not.
export async function setPracticeProgressAction(pageId: string, exampleKey: string, done: boolean) {
  try {
    const user = await requireUser()
    const page = await db.getPracticePageById(pageId)
    if (!page || !(page.examples ?? []).some((ex: { key: string }) => ex.key === exampleKey)) {
      return { error: { code: "NOT_FOUND", message: "Příklad nebyl nalezen." } }
    }
    const subject = await db.getSubjectById(page.subject_id)
    if (!subject?.practice_enabled) {
      return { error: { code: "NOT_FOUND", message: "Příklad nebyl nalezen." } }
    }
    await db.setPracticeProgress(
      { module_id: page.module_id, page_id: pageId, example_key: exampleKey },
      done === true,
      user.email
    )
    return { error: null }
  } catch (err: any) {
    return { error: { code: "UNKNOWN", message: err?.message || "Neznámá chyba." } }
  }
}
