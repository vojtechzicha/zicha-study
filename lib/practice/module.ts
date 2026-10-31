import * as db from "@/lib/mongodb/db"
import { PRACTICE_FLAVOURS, PRACTICE_SLUG_PATTERN } from "@/lib/constants"
import { createSlug } from "@/lib/utils/slug"

// Creating a subject's practice module. Its address is owned by the module, so private links
// keep working when the study is unpublished or renamed:
//   address_prefix = the study's public address at creation time (or its name as a slug)
//   slug           = the subject's primary note address, else its abbreviation, else its name

type Doc = Record<string, any>

function validSlug(value: unknown): string | null {
  if (typeof value !== "string") return null
  const slug = createSlug(value)
  return PRACTICE_SLUG_PATTERN.test(slug) ? slug : null
}

// The note linked to this subject as its primary note (the first one, if several).
export function findPrimaryNote(notes: Doc[], subjectId: string): Doc | null {
  return (
    notes.find((note) =>
      (note.linked_subjects || []).some((link: Doc) => link.subject_id === subjectId && link.is_primary)
    ) ?? null
  )
}

export function defaultModuleAddress(study: Doc, subject: Doc, primaryNote: Doc | null) {
  const addressPrefix =
    (typeof study.public_slug === "string" && PRACTICE_SLUG_PATTERN.test(study.public_slug) ? study.public_slug : null) ??
    validSlug(study.name) ??
    "studium"
  const slug =
    (typeof primaryNote?.public_slug === "string" && PRACTICE_SLUG_PATTERN.test(primaryNote.public_slug)
      ? primaryNote.public_slug
      : null) ??
    validSlug(subject.abbreviation) ??
    validSlug(subject.name) ??
    "procvicovani"
  return { addressPrefix, slug }
}

async function freeSlug(addressPrefix: string, slug: string): Promise<string> {
  let candidate = slug
  for (let n = 2; !(await db.isPracticeAddressAvailable(addressPrefix, candidate)); n++) {
    candidate = `${slug.slice(0, 46)}-${n}`
  }
  return candidate
}

/** Returns the subject's practice module, creating it with default settings on first use. */
export async function ensurePracticeModule(subject: Doc) {
  const existing = await db.getPracticeModuleBySubjectId(String(subject._id))
  if (existing) return existing

  const study = await db.getStudyById(subject.study_id)
  if (!study) throw new Error(`Study ${subject.study_id} not found.`)
  const notes = await db.getStudyNotesBySubjectId(String(subject._id))
  const primaryNote = findPrimaryNote(notes, String(subject._id))
  const { addressPrefix, slug } = defaultModuleAddress(study, subject, primaryNote)

  try {
    return await db.createPracticeModule({
      subject_id: String(subject._id),
      study_id: subject.study_id,
      address_prefix: addressPrefix,
      slug: await freeSlug(addressPrefix, slug),
      title: subject.name,
      flavour: PRACTICE_FLAVOURS.CALC,
      primary_note_id: primaryNote ? String(primaryNote._id) : null,
    })
  } catch (err: any) {
    // A concurrent call created it first (unique subject_id).
    if (err?.code === 11000) {
      const created = await db.getPracticeModuleBySubjectId(String(subject._id))
      if (created) return created
    }
    throw err
  }
}
