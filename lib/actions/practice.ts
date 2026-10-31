"use server"

import { revalidatePath } from "next/cache"
import * as db from "@/lib/mongodb/db"
import { requireUser } from "@/lib/auth-guard"
import { PRACTICE_ROUTE_SEGMENT } from "@/lib/constants"

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
    // The index and page show progress counts; drop their cached render (incl. back/forward)
    const practiceModule = await db.getPracticeModuleById(page.module_id)
    if (practiceModule) {
      const index = `/${practiceModule.address_prefix}/${PRACTICE_ROUTE_SEGMENT}/${practiceModule.slug}`
      revalidatePath(index)
      revalidatePath(`${index}/${page.slug}`)
    }
    return { error: null }
  } catch (err: any) {
    return { error: { code: "UNKNOWN", message: err?.message || "Neznámá chyba." } }
  }
}
