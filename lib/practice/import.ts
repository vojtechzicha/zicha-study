import crypto from "crypto"
import * as db from "@/lib/mongodb/db"
import { prepareModuleContent, type PreparedPageContent } from "./content"
import type { PracticeManifest, PracticePageContent } from "./schema"

// Writes uploaded practice content. Page updates keep the previous content as a version and use
// a revision compare-and-set, so two concurrent uploads can't silently lose history.

type Doc = Record<string, any>

export class PracticeConflictError extends Error {
  constructor(slug: string) {
    super(`The page „${slug}“ was changed by another upload at the same time. Try again.`)
    this.name = "PracticeConflictError"
  }
}

export interface UpsertResult {
  page: Doc
  created: boolean
  changed: boolean
  revision: number
}

function storedContent(page: Doc): PracticePageContent {
  return {
    title: page.title,
    lead_html: page.lead_html ?? "",
    intro_blocks: page.intro_blocks ?? [],
    footer_html: page.footer_html ?? null,
    examples: page.examples ?? [],
  }
}

/** Inserts or updates a page by slug. An identical re-upload (same content hash) is a no-op. */
export async function upsertPracticePage(
  module: Doc,
  slug: string,
  prepared: PreparedPageContent,
  actor: string | null
): Promise<UpsertResult> {
  const moduleId = String(module._id)
  const base = { module_id: moduleId, subject_id: module.subject_id, study_id: module.study_id, slug }

  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = await db.getPracticePageBySlug(moduleId, slug)
    if (!existing) {
      try {
        const page = await db.insertPracticePage(base, prepared.content, prepared.contentHash)
        return { page, created: true, changed: true, revision: 1 }
      } catch (err: any) {
        if (err?.code === 11000) continue // created concurrently: update it instead
        throw err
      }
    }
    if (existing.content_hash === prepared.contentHash) {
      return { page: existing, created: false, changed: false, revision: existing.revision }
    }
    await db.savePracticePageVersion(String(existing._id), existing.revision, storedContent(existing), actor)
    if (await db.casUpdatePracticePageContent(String(existing._id), existing.revision, prepared.content, prepared.contentHash)) {
      const page = await db.getPracticePageById(String(existing._id))
      return { page: page!, created: false, changed: true, revision: existing.revision + 1 }
    }
  }
  throw new PracticeConflictError(slug)
}

/**
 * Applies a manifest: index texts and groups (matched by key, so group ids stay stable).
 * Pages are never deleted; slugs listed before their page exists are kept for later.
 */
export async function applyPracticeManifest(module: Doc, manifest: PracticeManifest) {
  const { content, warnings } = prepareModuleContent({
    intro_html: manifest.intro_html,
    intro_blocks: manifest.intro_blocks,
    closing_blocks: manifest.closing_blocks,
  })
  const settings: db.PracticeModuleSettings = {}
  if (manifest.groups) {
    const existingIds = new Map<string, string>((module.groups || []).map((g: Doc) => [g.key, g.id]))
    const seenKeys = new Set<string>()
    const seenPages = new Set<string>()
    settings.groups = manifest.groups.map((group) => {
      if (seenKeys.has(group.key)) warnings.push(`Group key „${group.key}“ is listed twice.`)
      seenKeys.add(group.key)
      const pages = group.pages.filter((slug) => {
        if (seenPages.has(slug)) {
          warnings.push(`Page „${slug}“ is listed in more than one group; kept in the first.`)
          return false
        }
        seenPages.add(slug)
        return true
      })
      return {
        id: existingIds.get(group.key) ?? crypto.randomUUID(),
        key: group.key,
        title: group.title,
        description: group.description ?? null,
        pages,
      }
    })
  }
  await db.updatePracticeModule(String(module._id), settings, content)
  return { warnings }
}
