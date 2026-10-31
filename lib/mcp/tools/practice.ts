import crypto from "crypto"
import { z } from "zod"
import * as db from "@/lib/mongodb/db"
import { PRACTICE_FLAVOURS, PRACTICE_INTRO_BLOCK_KINDS, PRACTICE_SLUG_PATTERN } from "@/lib/constants"
import { dryRun, enumOf, recordId, text } from "@/lib/mcp/schemas"
import { ToolError, audit, commitDelete, commitUpdate, defineTool, requireDoc, type ToolContext } from "@/lib/mcp/tool-kit"
import { prepareModuleContent, PracticeContentError } from "@/lib/practice/content"
import { manifestGroupSchema, practiceExampleKeySchema } from "@/lib/practice/schema"
import { PRACTICE_UPLOAD_MAX_BYTES, issuePracticeUploadToken } from "@/lib/practice/upload"
import { practiceLinks } from "@/lib/practice/urls"

// Procvičování: private practice pages per subject (lib/practice). Content goes in through the
// upload endpoint (create_practice_upload), never through tool arguments; these tools read,
// arrange and manage it.

type Doc = Record<string, any>

const DEFAULT_ORIGIN = "https://www.zicha.study"

const practiceSlug = z.string().regex(PRACTICE_SLUG_PATTERN, "Use 2–50 lowercase letters, digits, - or _.")

const blockSchema = z
  .object({
    kind: enumOf(PRACTICE_INTRO_BLOCK_KINDS),
    title: z.string().trim().max(300).nullable(),
    html: z.string().max(200_000),
  })
  .strict()

function origin(ctx: ToolContext) {
  return ctx.origin || DEFAULT_ORIGIN
}

function contentErrors(err: unknown): never {
  if (err instanceof PracticeContentError) throw new ToolError(`Content rejected: ${err.errors.join(" ")}`)
  throw err
}

async function requireModule(subjectId: string) {
  const subject = requireDoc(await db.getSubjectById(subjectId), "Subject", subjectId)
  const practiceModule = await db.getPracticeModuleBySubjectId(subjectId)
  if (!practiceModule) {
    throw new ToolError("This subject has no practice module yet. Enable it with update_subject practice_enabled=true.")
  }
  return { subject, practiceModule }
}

async function requirePage(practiceModule: Doc, pageSlug: string) {
  return requireDoc(await db.getPracticePageBySlug(String(practiceModule._id), pageSlug), "Practice page", pageSlug)
}

function doneKeys(progress: Doc[], pageId: string, keys: string[]) {
  const present = new Set(keys)
  return new Set(progress.filter((p) => p.page_id === pageId && present.has(p.example_key)).map((p) => p.example_key))
}

function moduleSummary(practiceModule: Doc, ctx: ToolContext) {
  return {
    id: String(practiceModule._id),
    subject_id: practiceModule.subject_id,
    study_id: practiceModule.study_id,
    address_prefix: practiceModule.address_prefix,
    slug: practiceModule.slug,
    title: practiceModule.title,
    flavour: practiceModule.flavour,
    primary_note_id: practiceModule.primary_note_id ?? null,
    intro_html: practiceModule.intro_html ?? "",
    intro_blocks: practiceModule.intro_blocks ?? [],
    closing_blocks: practiceModule.closing_blocks ?? [],
    groups: (practiceModule.groups ?? []).map((g: Doc) => ({ key: g.key, title: g.title, description: g.description ?? null, pages: g.pages ?? [] })),
    ...practiceLinks(origin(ctx), practiceModule.address_prefix, practiceModule.slug),
  }
}

export const practiceTools = [
  defineTool({
    name: "get_practice_module",
    title: "Get practice module",
    description:
      "A subject's Procvičování module: settings, groups and every page with its example count, progress and link. Pages are private (sign-in required).",
    access: "read",
    input: { subject_id: recordId },
    handler: async ({ subject_id }, ctx) => {
      const subject = requireDoc(await db.getSubjectById(subject_id), "Subject", subject_id)
      const practiceModule = await db.getPracticeModuleBySubjectId(subject_id)
      if (!practiceModule) return { practice_enabled: !!subject.practice_enabled, module: null }
      const moduleId = String(practiceModule._id)
      const [pages, progress] = await Promise.all([db.getPracticePageSummaries(moduleId), db.getPracticeProgressByModuleId(moduleId)])
      const groupOf = new Map<string, string>()
      for (const g of practiceModule.groups ?? []) for (const slug of g.pages ?? []) if (!groupOf.has(slug)) groupOf.set(slug, g.key)
      return {
        practice_enabled: !!subject.practice_enabled,
        module: moduleSummary(practiceModule, ctx),
        pages: pages.map((page: Doc) => {
          const keys = (page.examples ?? []).map((ex: Doc) => ex.key)
          return {
            id: String(page._id),
            slug: page.slug,
            title: page.title,
            desc: page.desc ?? null,
            group: groupOf.get(page.slug) ?? null,
            examples: keys.length,
            done: doneKeys(progress, String(page._id), keys).size,
            revision: page.revision,
            updated_at: page.content_updated_at ?? page.updated_at,
            ...practiceLinks(origin(ctx), practiceModule.address_prefix, practiceModule.slug, page.slug),
          }
        }),
      }
    },
  }),

  defineTool({
    name: "update_practice_module",
    title: "Update practice module",
    description:
      "Change a practice module: address (address_prefix/slug – changing it breaks existing links), title, flavour (graph for DMO-style graph pages, calc otherwise), index texts (sanitized HTML), groups with their page order, and the primary study note.",
    access: "write",
    input: {
      subject_id: recordId,
      fields: z
        .object({
          address_prefix: practiceSlug,
          slug: practiceSlug,
          title: text(300),
          flavour: enumOf(PRACTICE_FLAVOURS),
          intro_html: z.string().max(200_000),
          intro_blocks: z.array(blockSchema).max(20),
          closing_blocks: z.array(blockSchema).max(20),
          groups: z.array(manifestGroupSchema).max(100).describe("Replaces all groups; pages listed in order by slug."),
          primary_note_id: recordId.nullable(),
        })
        .partial()
        .strict(),
      dry_run: dryRun,
    },
    handler: async ({ subject_id, fields, dry_run }, ctx) => {
      const { practiceModule } = await requireModule(subject_id)
      const moduleId = String(practiceModule._id)
      const { intro_html, intro_blocks, closing_blocks, groups, ...rest } = fields
      const settings: db.PracticeModuleSettings = { ...rest }

      const prefix = settings.address_prefix ?? practiceModule.address_prefix
      const slug = settings.slug ?? practiceModule.slug
      if ((prefix !== practiceModule.address_prefix || slug !== practiceModule.slug) && !(await db.isPracticeAddressAvailable(prefix, slug, moduleId))) {
        throw new ToolError(`The address ${prefix}/${slug} is taken.`)
      }
      if (settings.primary_note_id) {
        const note = await db.getStudyNoteById(settings.primary_note_id)
        if (!note || note.study_id !== practiceModule.study_id) throw new ToolError("primary_note_id must be a note of the same study.")
      }
      if (groups) {
        const existing = new Map<string, string>((practiceModule.groups ?? []).map((g: Doc) => [g.key, g.id]))
        const seen = new Set<string>()
        settings.groups = groups.map((g) => {
          if (seen.has(g.key)) throw new ToolError(`Group key „${g.key}“ is listed twice.`)
          seen.add(g.key)
          return { id: existing.get(g.key) ?? crypto.randomUUID(), key: g.key, title: g.title, description: g.description ?? null, pages: g.pages }
        })
      }
      let content
      try {
        content = prepareModuleContent({ intro_html, intro_blocks, closing_blocks }).content
      } catch (err) {
        contentErrors(err)
      }

      return commitUpdate({
        ctx,
        tool: "update_practice_module",
        collection: "practice_modules",
        before: practiceModule,
        patch: { ...settings, ...content },
        dryRun: dry_run,
        write: () => db.updatePracticeModule(moduleId, settings, content),
        reload: () => db.getPracticeModuleById(moduleId),
      })
    },
  }),

  defineTool({
    name: "get_practice_page",
    title: "Get practice page",
    description:
      "One practice page: its examples (key, number, title, nav meta, step count, done) and link. include_html returns the full stored content (all sanitized HTML) instead.",
    access: "read",
    input: { subject_id: recordId, page_slug: practiceSlug, include_html: z.boolean().optional() },
    handler: async ({ subject_id, page_slug, include_html }, ctx) => {
      const { practiceModule } = await requireModule(subject_id)
      const page = await requirePage(practiceModule, page_slug)
      const keys = (page.examples ?? []).map((ex: Doc) => ex.key)
      const done = doneKeys(await db.getPracticeProgressByPageId(String(page._id)), String(page._id), keys)
      const meta = {
        id: String(page._id),
        slug: page.slug,
        title: page.title,
        desc: page.desc ?? null,
        revision: page.revision,
        content_hash: page.content_hash ?? null,
        updated_at: page.content_updated_at ?? page.updated_at,
        ...practiceLinks(origin(ctx), practiceModule.address_prefix, practiceModule.slug, page.slug),
      }
      if (include_html) {
        return {
          ...meta,
          content: {
            title: page.title,
            lead_html: page.lead_html,
            intro_blocks: page.intro_blocks,
            footer_html: page.footer_html,
            examples: page.examples,
          },
          done: [...done],
        }
      }
      return {
        ...meta,
        examples: (page.examples ?? []).map((ex: Doc) => ({
          key: ex.key,
          n: ex.n,
          title: ex.title,
          nav_meta: ex.nav_meta ?? null,
          steps: (ex.steps ?? []).length,
          done: done.has(ex.key),
        })),
      }
    },
  }),

  defineTool({
    name: "update_practice_page",
    title: "Update practice page",
    description:
      "Change a page's title, description or address (slug – breaks existing links). The content itself is replaced by re-uploading the page; re-uploading the original also restores an edited title.",
    access: "write",
    input: {
      subject_id: recordId,
      page_slug: practiceSlug,
      fields: z.object({ title: text(300), desc: z.string().trim().max(2000).nullable(), slug: practiceSlug }).partial().strict(),
      dry_run: dryRun,
    },
    handler: async ({ subject_id, page_slug, fields, dry_run }, ctx) => {
      const { practiceModule } = await requireModule(subject_id)
      const page = await requirePage(practiceModule, page_slug)
      if (fields.slug && fields.slug !== page.slug && (await db.getPracticePageBySlug(String(practiceModule._id), fields.slug))) {
        throw new ToolError(`The page address „${fields.slug}“ is taken in this module.`)
      }
      const result = await commitUpdate({
        ctx,
        tool: "update_practice_page",
        collection: "practice_pages",
        before: { ...page, examples: undefined, intro_blocks: undefined },
        patch: fields,
        dryRun: dry_run,
        write: () => db.updatePracticePageMeta(String(page._id), fields),
        reload: async () => {
          const after = await db.getPracticePageById(String(page._id))
          return after ? { ...after, examples: undefined, intro_blocks: undefined } : null
        },
      })
      // Keep the module's group lists pointing at the renamed page
      if (!dry_run && fields.slug && fields.slug !== page.slug) {
        const groups = (practiceModule.groups ?? []).map((g: Doc) => ({
          ...g,
          pages: (g.pages ?? []).map((s: string) => (s === page.slug ? fields.slug : s)),
        }))
        await db.updatePracticeModule(String(practiceModule._id), { groups })
      }
      return result
    },
  }),

  defineTool({
    name: "delete_practice_page",
    title: "Delete practice page",
    description: "Permanently delete a practice page with its versions and progress. Try dry_run first.",
    access: "delete",
    input: { subject_id: recordId, page_slug: practiceSlug, dry_run: dryRun },
    handler: async ({ subject_id, page_slug, dry_run }, ctx) => {
      const { practiceModule } = await requireModule(subject_id)
      const page = await requirePage(practiceModule, page_slug)
      return commitDelete({
        ctx,
        tool: "delete_practice_page",
        collection: "practice_pages",
        before: { _id: page._id, slug: page.slug, title: page.title, revision: page.revision, examples: (page.examples ?? []).length },
        dryRun: dry_run,
        cascade: await db.countPracticePageData(String(page._id)),
        remove: () => db.deletePracticePage(String(page._id)),
      })
    },
  }),

  defineTool({
    name: "set_practice_progress",
    title: "Set practice progress",
    description: "Mark an example as gone through (\"Prošel jsem\") or not. Only when the user says so.",
    access: "write",
    input: { subject_id: recordId, page_slug: practiceSlug, example_key: practiceExampleKeySchema, done: z.boolean() },
    handler: async ({ subject_id, page_slug, example_key, done }, ctx) => {
      const { subject, practiceModule } = await requireModule(subject_id)
      if (!subject.practice_enabled) throw new ToolError("Practice is turned off for this subject.")
      const page = await requirePage(practiceModule, page_slug)
      if (!(page.examples ?? []).some((ex: Doc) => ex.key === example_key)) {
        throw new ToolError(`Example „${example_key}“ not found on page „${page_slug}“.`)
      }
      await db.setPracticeProgress({ module_id: String(practiceModule._id), page_id: String(page._id), example_key }, done, ctx.auth.email)
      await audit(ctx, {
        tool: "set_practice_progress",
        action: "update",
        collection: "practice_progress",
        documentId: `${page._id}:${example_key}`,
        after: { page: page_slug, example_key, done },
      })
      return { page: page_slug, example_key, done }
    },
  }),

  defineTool({
    name: "create_practice_upload",
    title: "Create practice upload",
    description:
      "Issue a short-lived upload token for a subject's practice module (30 min, 200 requests). Upload with HTTP PUT – never paste page bodies into tool calls: " +
      "PUT <upload_base_url>/pages/<page-slug> with the generator page (Content-Type: text/html; add ?strict=1 to require data-key on every example) or a JSON envelope, " +
      "and PUT <upload_base_url>/module with a JSON manifest {intro_html, intro_blocks, closing_blocks, groups:[{key,title,description,pages:[slug…]}]}. " +
      "Send the token as 'Authorization: Bearer <token>'. Keep the token out of logs and chat.",
    access: "write",
    input: { subject_id: recordId },
    handler: async ({ subject_id }, ctx) => {
      const { subject, practiceModule } = await requireModule(subject_id)
      if (!subject.practice_enabled) throw new ToolError("Practice is turned off for this subject.")
      const issued = await issuePracticeUploadToken(String(practiceModule._id), ctx.auth.grantId, ctx.auth.email)
      const base = `${origin(ctx)}/api/practice/upload`
      await audit(ctx, {
        tool: "create_practice_upload",
        action: "create",
        collection: "practice_upload_tokens",
        documentId: issued.tokenId,
        after: { module_id: String(practiceModule._id), expires_at: issued.expiresAt.toISOString(), max_requests: issued.maxRequests },
      })
      return {
        token_id: issued.tokenId,
        token: issued.token,
        upload_base_url: base,
        expires_at: issued.expiresAt.toISOString(),
        max_requests: issued.maxRequests,
        max_body_bytes: PRACTICE_UPLOAD_MAX_BYTES,
        examples: {
          page: `curl -sS -X PUT "${base}/pages/<page-slug>?strict=1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: text/html" --data-binary @page.html`,
          module: `curl -sS -X PUT "${base}/module" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @manifest.json`,
        },
        module: practiceLinks(origin(ctx), practiceModule.address_prefix, practiceModule.slug),
      }
    },
  }),

  defineTool({
    name: "revoke_practice_upload",
    title: "Revoke practice upload",
    description: "Revoke an upload token (by token_id from create_practice_upload) before it expires.",
    access: "write",
    input: { token_id: recordId },
    handler: async ({ token_id }, ctx) => {
      const token = requireDoc(await db.getPracticeUploadToken(token_id), "Upload token", token_id)
      await db.revokePracticeUploadToken(token_id)
      await audit(ctx, { tool: "revoke_practice_upload", action: "update", collection: "practice_upload_tokens", documentId: token_id, after: { revoked: true } })
      return { token_id, revoked: true, was_used: token.used_requests ?? 0 }
    },
  }),
]
