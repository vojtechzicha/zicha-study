import { z } from "zod"
import * as db from "@/lib/mongodb/db"
import { MARKDOWN_NOTE_MAX_VERSIONS, NOTE_TYPES, getNoteType } from "@/lib/constants"
import { dryRun, emptyToNull, optionalText, publicSlug, recordId, text } from "@/lib/mcp/schemas"
import { ToolError, audit, commitCreate, commitDelete, commitUpdate, defineTool, requireDoc, type ToolContext } from "@/lib/mcp/tool-kit"

// Word and Obsidian notes live on OneDrive: their metadata can be edited here, their
// content cannot. Markdown notes (the in-app editor) are fully editable.

const MAX_CONTENT_CHARS = 2_000_000

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] }

const TIPTAP_FORMAT =
  'TipTap/ProseMirror JSON: {"type":"doc","content":[…]}. Blocks: paragraph, title (document title above H1), ' +
  "heading (attrs.level 1–4), bulletList/orderedList > listItem, taskList > taskItem (attrs.checked), blockquote, " +
  "codeBlock (attrs.language), horizontalRule, table > tableRow > tableHeader/tableCell, image (attrs.src), " +
  'blockMath (attrs.latex). Inline: text with marks bold/italic/strike/code/underline/link (attrs.href), ' +
  "inlineMath (attrs.latex), hardBreak. Keep doodle nodes from get_note unchanged."

const noteFields = z
  .object({
    name: text(200),
    description: optionalText(2000),
    is_public: z.boolean().describe("Publish the note on the study's public page."),
    public_slug: publicSlug.nullable().describe("Public address; required when is_public is true."),
  })
  .partial()
  .strict()

const tiptapDoc = z
  .object({ type: z.literal("doc"), content: z.array(z.record(z.unknown())) })
  .passthrough()
  .describe(TIPTAP_FORMAT)

// Lists and results leave out the (large) content; get_note returns it.
function withoutContent<T extends Record<string, any>>(doc: T) {
  const { content_json: _content, ...rest } = doc
  return rest
}

function noteTypeOf(doc: Record<string, any>) {
  return getNoteType({ note_type: doc.note_type })
}

function metadata(doc: Record<string, any> | null) {
  const note = db.normalizeId(doc)
  return note ? { ...withoutContent(note), note_type: noteTypeOf(note) } : null
}

function parseContent(contentJson: unknown) {
  if (typeof contentJson !== "string") return contentJson ?? EMPTY_DOC
  try {
    return JSON.parse(contentJson)
  } catch {
    return EMPTY_DOC
  }
}

async function requireNote(noteId: string) {
  return requireDoc(await db.getStudyNoteById(noteId), "Note", noteId)
}

function requireMarkdown(note: Record<string, any>) {
  if (noteTypeOf(note) !== NOTE_TYPES.MARKDOWN) {
    throw new ToolError("Only Markdown notes can be changed this way; Word and Obsidian notes are files on OneDrive.")
  }
}

async function prepareNotePatch(before: Record<string, any>, fields: z.infer<typeof noteFields>) {
  const patch: Record<string, any> = emptyToNull(fields)
  if ("is_public" in patch || "public_slug" in patch) {
    const isPublic = patch.is_public ?? !!before.is_public
    if (!isPublic) {
      if (patch.public_slug) throw new ToolError("Set is_public to true to give the note a public address.")
      patch.is_public = false
      patch.public_slug = null
    } else {
      const slug = patch.public_slug === undefined ? before.public_slug : patch.public_slug
      if (!slug) throw new ToolError("A public note needs public_slug.")
      if (slug !== before.public_slug && !(await db.checkStudyNoteSlugAvailability(slug, before.study_id, before._id))) {
        throw new ToolError(`The address „${slug}“ is taken in this study.`)
      }
      patch.public_slug = slug
    }
  }
  return patch
}

type LinkTarget = { kind: "subject"; id: string } | { kind: "final_exam"; id: string }

async function resolveLinkTarget(note: Record<string, any>, subjectId?: string, finalExamId?: string): Promise<LinkTarget> {
  if (!!subjectId === !!finalExamId) throw new ToolError("Give exactly one of subject_id or final_exam_id.")
  const target = subjectId
    ? requireDoc(await db.getSubjectById(subjectId), "Subject", subjectId)
    : requireDoc(await db.getFinalExamById(finalExamId!), "Final exam", finalExamId!)
  if (target.study_id !== note.study_id) throw new ToolError("The note and the subject/final exam belong to different studies.")
  return subjectId ? { kind: "subject", id: subjectId } : { kind: "final_exam", id: finalExamId! }
}

function isLinked(note: Record<string, any>, target: LinkTarget) {
  return target.kind === "subject"
    ? (note.linked_subjects || []).some((l: any) => l.subject_id === target.id)
    : (note.linked_final_exams || []).some((l: any) => l.final_exam_id === target.id)
}

async function auditLinkChange(ctx: ToolContext, tool: string, before: Record<string, any>) {
  const after = await db.getStudyNoteById(String(before._id))
  await audit(ctx, {
    tool,
    action: "update",
    collection: "study_notes",
    documentId: String(before._id),
    before: { linked_subjects: before.linked_subjects, linked_final_exams: before.linked_final_exams },
    after: { linked_subjects: after?.linked_subjects, linked_final_exams: after?.linked_final_exams },
  })
  return metadata(after)
}

export const noteTools = [
  defineTool({
    name: "list_notes",
    title: "List notes",
    description: "Study notes of a study (Word, Obsidian and Markdown), without their content.",
    access: "read",
    input: { study_id: recordId },
    handler: async ({ study_id }) => {
      requireDoc(await db.getStudyById(study_id), "Study", study_id)
      return (await db.getStudyNotesByStudyId(study_id)).map(metadata)
    },
  }),

  defineTool({
    name: "get_note",
    title: "Get note",
    description: "One note. Markdown notes include their content as TipTap JSON; Word and Obsidian content stays on OneDrive.",
    access: "read",
    input: { note_id: recordId },
    handler: async ({ note_id }) => {
      const note = await requireNote(note_id)
      const meta = metadata(note)
      return noteTypeOf(note) === NOTE_TYPES.MARKDOWN ? { ...meta, content: parseContent(note.content_json) } : meta
    },
  }),

  defineTool({
    name: "create_markdown_note",
    title: "Create Markdown note",
    description: "Create an empty Markdown note in a study; fill it with set_markdown_note_content.",
    access: "write",
    input: { study_id: recordId, name: text(200), description: optionalText(2000).optional() },
    handler: async ({ study_id, name, description }, ctx) => {
      requireDoc(await db.getStudyById(study_id), "Study", study_id)
      const result = await commitCreate({ ctx, tool: "create_markdown_note", collection: "study_notes" }, () =>
        db.createStudyNote({
          study_id,
          user_id: ctx.auth.email ?? "owner",
          note_type: NOTE_TYPES.MARKDOWN,
          name,
          description: description || null,
          file_name: name,
          file_extension: "md",
          is_public: false,
          public_slug: null,
          content_json: JSON.stringify(EMPTY_DOC),
          content_updated_at: new Date().toISOString(),
        })
      )
      return { created: { ...withoutContent(result.created), note_type: NOTE_TYPES.MARKDOWN } }
    },
  }),

  defineTool({
    name: "update_note",
    title: "Update note",
    description: "Rename a note, change its description, or publish/unpublish it. Works for every note type.",
    access: "write",
    input: { note_id: recordId, fields: noteFields, dry_run: dryRun },
    handler: async ({ note_id, fields, dry_run }, ctx) => {
      const before = await requireNote(note_id)
      return commitUpdate({
        ctx,
        tool: "update_note",
        collection: "study_notes",
        before: withoutContent(before),
        patch: await prepareNotePatch(before, fields),
        dryRun: dry_run,
        write: (p) => db.updateStudyNote(note_id, p),
        reload: async () => {
          const after = await db.getStudyNoteById(note_id)
          return after && withoutContent(after)
        },
      })
    },
  }),

  defineTool({
    name: "set_markdown_note_content",
    title: "Set Markdown note content",
    description: `Replace the whole content of a Markdown note and save it as a new version (the previous content stays in the note's history). Read it with get_note first. An editor open in the app may overwrite the change when it autosaves. ${TIPTAP_FORMAT}`,
    access: "write",
    input: { note_id: recordId, content: tiptapDoc },
    handler: async ({ note_id, content }, ctx) => {
      const note = await requireNote(note_id)
      requireMarkdown(note)
      const serialized = JSON.stringify(content)
      if (serialized.length > MAX_CONTENT_CHARS) throw new ToolError("The content is too large.")

      // Keep the content being replaced in the history if no version holds it yet
      // (the editor autosaves the working copy and commits versions less often).
      const [latest] = await db.getMarkdownNoteVersions(note_id)
      const latestFull = latest ? await db.getMarkdownNoteVersionById(String(latest._id)) : null
      if (note.content_json && latestFull?.content_json !== note.content_json) {
        await db.createMarkdownNoteVersion(
          note_id,
          note.content_json,
          { email: null, name: "Před úpravou Claudem" },
          MARKDOWN_NOTE_MAX_VERSIONS
        )
      }

      await db.saveMarkdownNoteContent(note_id, serialized)
      await db.createMarkdownNoteVersion(note_id, serialized, { email: ctx.auth.email, name: "Claude" }, MARKDOWN_NOTE_MAX_VERSIONS)
      await audit(ctx, {
        tool: "set_markdown_note_content",
        action: "update",
        collection: "study_notes",
        documentId: note_id,
        before: { content_json: note.content_json ?? null },
        after: { content_json: serialized },
      })
      return { updated: metadata(await db.getStudyNoteById(note_id)) }
    },
  }),

  defineTool({
    name: "delete_note",
    title: "Delete note",
    description: "Permanently delete a Markdown note with its version history and images. Word and Obsidian notes are deleted in the app.",
    access: "delete",
    input: { note_id: recordId, dry_run: dryRun },
    handler: async ({ note_id, dry_run }, ctx) => {
      const note = await requireNote(note_id)
      requireMarkdown(note)
      if (note.cache_onedrive_id) throw new ToolError("This note has a backup copy on OneDrive; delete it in the app.")
      const versions = await db.getMarkdownNoteVersions(note_id)
      return commitDelete({
        ctx,
        tool: "delete_note",
        collection: "study_notes",
        before: note,
        dryRun: dry_run,
        cascade: { versions: versions.length },
        remove: () => db.deleteStudyNote(note_id),
      })
    },
  }),

  defineTool({
    name: "link_note",
    title: "Link note",
    description: "Link a note to a subject or a final exam of the same study, so it shows next to it.",
    access: "write",
    input: {
      note_id: recordId,
      subject_id: recordId.optional(),
      final_exam_id: recordId.optional(),
      is_primary: z.boolean().optional().describe("The note's main subject/final exam."),
    },
    handler: async ({ note_id, subject_id, final_exam_id, is_primary }, ctx) => {
      const note = await requireNote(note_id)
      const target = await resolveLinkTarget(note, subject_id, final_exam_id)
      if (isLinked(note, target)) return { already_linked: true, note: metadata(note) }
      if (target.kind === "subject") await db.linkSubjectToNote(note_id, target.id, !!is_primary)
      else await db.linkFinalExamToNote(note_id, target.id, !!is_primary)
      return { linked: await auditLinkChange(ctx, "link_note", note) }
    },
  }),

  defineTool({
    name: "unlink_note",
    title: "Unlink note",
    description: "Remove a note's link to a subject or a final exam.",
    access: "write",
    input: { note_id: recordId, subject_id: recordId.optional(), final_exam_id: recordId.optional() },
    handler: async ({ note_id, subject_id, final_exam_id }, ctx) => {
      const note = await requireNote(note_id)
      const target = await resolveLinkTarget(note, subject_id, final_exam_id)
      if (!isLinked(note, target)) return { not_linked: true, note: metadata(note) }
      if (target.kind === "subject") await db.unlinkSubjectFromNote(note_id, target.id)
      else await db.unlinkFinalExamFromNote(note_id, target.id)
      return { unlinked: await auditLinkChange(ctx, "unlink_note", note) }
    },
  }),
]
