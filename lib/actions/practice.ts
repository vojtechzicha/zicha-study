"use server"

import crypto from "crypto"
import { revalidatePath } from "next/cache"
import * as db from "@/lib/mongodb/db"
import { UNAUTHORIZED_MESSAGE, requireUser } from "@/lib/auth-guard"
import { PRACTICE_ROUTE_SEGMENT, PRACTICE_SLUG_PATTERN } from "@/lib/constants"
import { PracticeContentError, preparePageContent } from "@/lib/practice/content"
import { PracticeConflictError, upsertPracticePage } from "@/lib/practice/import"
import { ensurePracticeModule } from "@/lib/practice/module"
import { parsePracticePageHtml } from "@/lib/practice/parse-html"

// Generator pages are up to ~280 KB; the serverActions body limit is 4 MB.
const PRACTICE_UPLOAD_MAX_HTML = 3_000_000

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

// ─── Admin (subject edit form and the subject dialog's Procvičování tab) ─────────

type Doc = Record<string, any>

function actionError(err: any, fallback: string) {
  if (err instanceof PracticeContentError) {
    return { code: "INVALID", message: fallback, details: err.errors, warnings: err.warnings }
  }
  if (err instanceof PracticeConflictError) return { code: "CONFLICT", message: "Stránku právě nahrává někdo jiný. Zkuste to znovu." }
  if (err?.message === UNAUTHORIZED_MESSAGE) return { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE }
  return { code: "UNKNOWN", message: fallback }
}

// Turns Procvičování on or off for a subject; turning it on creates the module.
export async function setPracticeEnabledAction(subjectId: string, enabled: boolean) {
  try {
    await requireUser()
    const subject = await db.getSubjectById(subjectId)
    if (!subject) return { error: { code: "NOT_FOUND", message: "Předmět nebyl nalezen." } }
    await db.updateSubject(subjectId, { practice_enabled: enabled === true })
    if (enabled === true) await ensurePracticeModule({ ...subject, practice_enabled: true })
    return { error: null }
  } catch (err: any) {
    return { error: actionError(err, "Nepodařilo se uložit procvičování.") }
  }
}

export interface PracticeAdminData {
  module: {
    id: string
    addressPrefix: string
    slug: string
    title: string
    primaryNoteId: string | null
    groups: { key: string; title: string; pages: string[] }[]
  }
  pages: {
    id: string
    slug: string
    title: string
    examples: number
    done: number
    group: string | null
    updatedAt: string | null
  }[]
  notes: { id: string; name: string }[]
}

export async function fetchPracticeAdmin(subjectId: string): Promise<{ data: PracticeAdminData | null; error: { message: string } | null }> {
  try {
    await requireUser()
    const subject = await db.getSubjectById(subjectId)
    if (!subject?.practice_enabled) return { data: null, error: null }
    const practiceModule = await ensurePracticeModule(subject)
    const moduleId = String(practiceModule._id)
    const [pages, progress, notes] = await Promise.all([
      db.getPracticePageSummaries(moduleId),
      db.getPracticeProgressByModuleId(moduleId),
      db.getStudyNotesByStudyId(subject.study_id),
    ])
    const groupOf = new Map<string, string>()
    for (const g of practiceModule.groups ?? []) for (const slug of g.pages ?? []) if (!groupOf.has(slug)) groupOf.set(slug, g.title)
    const done = new Map<string, Set<string>>()
    for (const row of progress) {
      if (!done.has(row.page_id)) done.set(row.page_id, new Set())
      done.get(row.page_id)!.add(row.example_key)
    }
    return {
      error: null,
      data: {
        module: {
          id: moduleId,
          addressPrefix: practiceModule.address_prefix,
          slug: practiceModule.slug,
          title: practiceModule.title,
          primaryNoteId: practiceModule.primary_note_id ?? null,
          groups: (practiceModule.groups ?? []).map((g: Doc) => ({ key: g.key, title: g.title, pages: g.pages ?? [] })),
        },
        pages: pages
          .map((page: Doc) => {
            const keys: string[] = (page.examples ?? []).map((ex: Doc) => ex.key)
            const pageDone = done.get(String(page._id)) ?? new Set()
            return {
              id: String(page._id),
              slug: page.slug,
              title: page.title,
              examples: keys.length,
              done: keys.filter((k) => pageDone.has(k)).length,
              group: groupOf.get(page.slug) ?? null,
              updatedAt: page.content_updated_at ?? page.updated_at ?? null,
            }
          })
          .sort((a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title, "cs")),
        notes: notes.map((note: Doc) => ({ id: String(note._id), name: note.name })),
      },
    }
  } catch (err: any) {
    return { data: null, error: { message: actionError(err, "Nepodařilo se načíst procvičování.").message } }
  }
}

export async function checkPracticeAddressAction(addressPrefix: string, slug: string, excludeModuleId?: string) {
  await requireUser()
  if (!PRACTICE_SLUG_PATTERN.test(addressPrefix) || !PRACTICE_SLUG_PATTERN.test(slug)) return false
  return db.isPracticeAddressAvailable(addressPrefix, slug, excludeModuleId)
}

export async function updatePracticeModuleAction(
  subjectId: string,
  fields: { addressPrefix?: string; slug?: string; primaryNoteId?: string | null }
) {
  try {
    await requireUser()
    const practiceModule = await db.getPracticeModuleBySubjectId(subjectId)
    if (!practiceModule) return { error: { code: "NOT_FOUND", message: "Procvičování nebylo nalezeno." } }
    const settings: db.PracticeModuleSettings = {}
    if (fields.addressPrefix !== undefined || fields.slug !== undefined) {
      const prefix = fields.addressPrefix ?? practiceModule.address_prefix
      const slug = fields.slug ?? practiceModule.slug
      if (!PRACTICE_SLUG_PATTERN.test(prefix) || !PRACTICE_SLUG_PATTERN.test(slug)) {
        return { error: { code: "INVALID", message: "Adresa smí obsahovat 2–50 malých písmen, číslic, - nebo _." } }
      }
      if (!(await db.isPracticeAddressAvailable(prefix, slug, String(practiceModule._id)))) {
        return { error: { code: "TAKEN", message: "Adresa je obsazená." } }
      }
      settings.address_prefix = prefix
      settings.slug = slug
    }
    if (fields.primaryNoteId !== undefined) {
      if (fields.primaryNoteId) {
        const note = await db.getStudyNoteById(fields.primaryNoteId)
        if (!note || note.study_id !== practiceModule.study_id) {
          return { error: { code: "INVALID", message: "Zápis nepatří k tomuto studiu." } }
        }
      }
      settings.primary_note_id = fields.primaryNoteId
    }
    await db.updatePracticeModule(String(practiceModule._id), settings)
    return { error: null }
  } catch (err: any) {
    return { error: actionError(err, "Nepodařilo se uložit procvičování.") }
  }
}

// Uploads one generator page (HTML) from the dialog. group: an existing group key, a new group
// title, or neither (the page keeps its place or stays under "Nezařazené").
export async function importPracticePageAction(
  subjectId: string,
  slug: string,
  html: string,
  group: { key?: string; newTitle?: string } = {}
) {
  try {
    const user = await requireUser()
    if (typeof html !== "string" || html.length > PRACTICE_UPLOAD_MAX_HTML) {
      return { error: { code: "TOO_LARGE", message: "Soubor je příliš velký." } }
    }
    if (!PRACTICE_SLUG_PATTERN.test(slug)) {
      return { error: { code: "INVALID", message: "Adresa stránky smí obsahovat 2–50 malých písmen, číslic, - nebo _." } }
    }
    const subject = await db.getSubjectById(subjectId)
    if (!subject?.practice_enabled) return { error: { code: "NOT_FOUND", message: "Procvičování je vypnuté." } }
    const practiceModule = await ensurePracticeModule(subject)

    const parsed = parsePracticePageHtml(html, { urlSlug: slug })
    if (parsed.errors.length > 0) throw new PracticeContentError(parsed.errors, parsed.warnings)
    const prepared = preparePageContent(parsed.content)
    const result = await upsertPracticePage(practiceModule, slug, prepared, user.email)

    if (group.key || group.newTitle?.trim()) {
      const groups: Doc[] = (practiceModule.groups ?? []).map((g: Doc) => ({
        ...g,
        pages: (g.pages ?? []).filter((s: string) => s !== slug),
      }))
      let target = group.key ? groups.find((g) => g.key === group.key) : undefined
      if (!target) {
        const title = group.newTitle!.trim().slice(0, 300)
        target = groups.find((g) => g.title === title)
        if (!target) {
          target = { id: crypto.randomUUID(), key: `g-${crypto.randomUUID().slice(0, 8)}`, title, description: null, pages: [] }
          groups.push(target)
        }
      }
      target.pages = [...target.pages, slug]
      await db.updatePracticeModule(String(practiceModule._id), { groups: groups as db.PracticeModuleSettings["groups"] })
    }

    const moduleNow = await db.getPracticeModuleById(String(practiceModule._id))
    if (moduleNow) {
      const index = `/${moduleNow.address_prefix}/${PRACTICE_ROUTE_SEGMENT}/${moduleNow.slug}`
      revalidatePath(index)
      revalidatePath(`${index}/${slug}`)
    }
    return {
      error: null,
      data: {
        slug,
        created: result.created,
        changed: result.changed,
        examples: prepared.content.examples.length,
        warnings: [...parsed.warnings, ...prepared.warnings],
      },
    }
  } catch (err: any) {
    return { error: actionError(err, "Stránku se nepodařilo nahrát.") }
  }
}

export async function deletePracticePageAction(subjectId: string, pageSlug: string) {
  try {
    await requireUser()
    const practiceModule = await db.getPracticeModuleBySubjectId(subjectId)
    const page = practiceModule ? await db.getPracticePageBySlug(String(practiceModule._id), pageSlug) : null
    if (!practiceModule || !page) return { error: { code: "NOT_FOUND", message: "Stránka nebyla nalezena." } }
    await db.deletePracticePage(String(page._id))
    revalidatePath(`/${practiceModule.address_prefix}/${PRACTICE_ROUTE_SEGMENT}/${practiceModule.slug}`)
    return { error: null }
  } catch (err: any) {
    return { error: actionError(err, "Nepodařilo se smazat stránku.") }
  }
}
