import * as db from "@/lib/mongodb/db"
import { NOTE_TYPES, PRACTICE_FLAVOURS, PRACTICE_UNGROUPED_LABEL, getNoteType, type PracticeFlavour } from "@/lib/constants"
import { getShareUrl } from "@/lib/utils/share-url"
import type { PracticeExample, PracticeIntroBlock } from "./schema"

// Read models for the private practice pages. Callers must have checked the session; these
// return null for anything that doesn't exist or whose subject has practice turned off.

type Doc = Record<string, any>

export interface PracticeNoteLink {
  name: string
  href: string
  external: boolean
}

export interface PracticePageCard {
  id: string
  slug: string
  title: string
  desc: string | null
  examples: number
  done: number
}

export interface PracticeGroupView {
  id: string
  title: string
  description: string | null
  pages: PracticePageCard[]
}

export interface PracticeModuleView {
  module: {
    id: string
    title: string
    addressPrefix: string
    slug: string
    flavour: PracticeFlavour
    introHtml: string
    introBlocks: PracticeIntroBlock[]
    closingBlocks: PracticeIntroBlock[]
  }
  study: { id: string; name: string; logoUrl: string | null }
  subject: { id: string; name: string; abbreviation: string | null }
  primaryNote: PracticeNoteLink | null
  groups: PracticeGroupView[]
  totals: { examples: number; done: number }
}

export interface PracticePageView {
  module: PracticeModuleView["module"]
  study: PracticeModuleView["study"]
  page: {
    id: string
    slug: string
    title: string
    leadHtml: string
    introBlocks: PracticeIntroBlock[]
    footerHtml: string | null
    examples: PracticeExample[]
  }
  done: string[]
}

function noteLink(note: Doc | null, study: Doc): PracticeNoteLink | null {
  if (!note) return null
  if (getNoteType(note) === NOTE_TYPES.MARKDOWN) {
    return { name: note.name, href: `/studies/${study._id}/notes/${note._id}`, external: false }
  }
  if (note.is_public && note.public_slug && study.is_public && study.public_slug) {
    return { name: note.name, href: getShareUrl(study.public_slug, note.public_slug), external: false }
  }
  if (note.onedrive_web_url) return { name: note.name, href: note.onedrive_web_url, external: true }
  return null
}

async function loadModule(addressPrefix: string, moduleSlug: string) {
  const practiceModule = await db.getPracticeModuleByAddress(addressPrefix, moduleSlug)
  if (!practiceModule) return null
  const subject = await db.getSubjectById(practiceModule.subject_id)
  if (!subject?.practice_enabled) return null
  const study = await db.getStudyById(practiceModule.study_id)
  if (!study) return null
  return { practiceModule, subject, study }
}

function moduleHeader(practiceModule: Doc): PracticeModuleView["module"] {
  return {
    id: String(practiceModule._id),
    title: practiceModule.title,
    addressPrefix: practiceModule.address_prefix,
    slug: practiceModule.slug,
    flavour: practiceModule.flavour === PRACTICE_FLAVOURS.GRAPH ? PRACTICE_FLAVOURS.GRAPH : PRACTICE_FLAVOURS.CALC,
    introHtml: practiceModule.intro_html ?? "",
    introBlocks: practiceModule.intro_blocks ?? [],
    closingBlocks: practiceModule.closing_blocks ?? [],
  }
}

function studyHeader(study: Doc): PracticeModuleView["study"] {
  return { id: String(study._id), name: study.name, logoUrl: study.logo_url ?? null }
}

export async function loadPracticeModuleView(addressPrefix: string, moduleSlug: string): Promise<PracticeModuleView | null> {
  const loaded = await loadModule(addressPrefix, moduleSlug)
  if (!loaded) return null
  const { practiceModule, subject, study } = loaded
  const moduleId = String(practiceModule._id)

  const [pages, progress, note] = await Promise.all([
    db.getPracticePageSummaries(moduleId),
    db.getPracticeProgressByModuleId(moduleId),
    practiceModule.primary_note_id ? db.getStudyNoteById(practiceModule.primary_note_id) : Promise.resolve(null),
  ])

  const doneByPage = new Map<string, Set<string>>()
  for (const row of progress) {
    if (!doneByPage.has(row.page_id)) doneByPage.set(row.page_id, new Set())
    doneByPage.get(row.page_id)!.add(row.example_key)
  }
  const cards = new Map<string, PracticePageCard>()
  for (const page of pages) {
    const keys = (page.examples ?? []).map((ex: Doc) => ex.key)
    const done = doneByPage.get(String(page._id)) ?? new Set()
    cards.set(page.slug, {
      id: String(page._id),
      slug: page.slug,
      title: page.title,
      desc: page.desc ?? null,
      examples: keys.length,
      // Only keys the page still has count (orphaned progress is kept but not shown)
      done: keys.filter((key: string) => done.has(key)).length,
    })
  }

  const listed = new Set<string>()
  const groups: PracticeGroupView[] = (practiceModule.groups ?? []).map((group: Doc) => ({
    id: group.id,
    title: group.title,
    description: group.description ?? null,
    pages: (group.pages ?? [])
      .map((slug: string) => {
        listed.add(slug)
        return cards.get(slug)
      })
      .filter(Boolean),
  }))
  const unlisted = [...cards.values()].filter((card) => !listed.has(card.slug)).sort((a, b) => a.title.localeCompare(b.title, "cs"))
  if (unlisted.length > 0) {
    groups.push({ id: "ungrouped", title: PRACTICE_UNGROUPED_LABEL, description: null, pages: unlisted })
  }

  const all = [...cards.values()]
  return {
    module: moduleHeader(practiceModule),
    study: studyHeader(study),
    subject: { id: String(subject._id), name: subject.name, abbreviation: subject.abbreviation ?? null },
    primaryNote: noteLink(note, study),
    groups: groups.filter((group) => group.pages.length > 0),
    totals: { examples: all.reduce((n, c) => n + c.examples, 0), done: all.reduce((n, c) => n + c.done, 0) },
  }
}

export async function loadPracticePageView(
  addressPrefix: string,
  moduleSlug: string,
  pageSlug: string
): Promise<PracticePageView | null> {
  const loaded = await loadModule(addressPrefix, moduleSlug)
  if (!loaded) return null
  const { practiceModule, study } = loaded
  const page = await db.getPracticePageBySlug(String(practiceModule._id), pageSlug)
  if (!page) return null
  const progress = await db.getPracticeProgressByPageId(String(page._id))
  const keys = new Set((page.examples ?? []).map((ex: Doc) => ex.key))

  return {
    module: moduleHeader(practiceModule),
    study: studyHeader(study),
    page: {
      id: String(page._id),
      slug: page.slug,
      title: page.title,
      leadHtml: page.lead_html ?? "",
      introBlocks: page.intro_blocks ?? [],
      footerHtml: page.footer_html ?? null,
      examples: page.examples ?? [],
    },
    done: progress.map((row: Doc) => row.example_key).filter((key: string) => keys.has(key)),
  }
}
