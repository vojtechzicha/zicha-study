import { NextResponse } from "next/server"
import * as db from "@/lib/mongodb/db"
import { getPublicOrigin } from "@/lib/mcp/oauth"
import { PRACTICE_SLUG_PATTERN } from "@/lib/constants"
import { parsePracticePageHtml } from "./parse-html"
import { PracticeContentError, parseManifest, preparePageContent } from "./content"
import { PracticeConflictError, applyPracticeManifest, upsertPracticePage } from "./import"
import { BodyTooLargeError, authenticatePracticeUpload, readUploadBody } from "./upload"
import { practiceLinks } from "./urls"

// PUT /api/practice/upload/pages/<slug> and PUT /api/practice/upload/module (see upload.ts).

type Doc = Record<string, any>

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

async function auditUpload(grant: Doc, entry: { action: "create" | "update"; collection: string; documentId: string; before: unknown; after: unknown }) {
  // Never the token and never full page bodies (the page versions keep those).
  await db.insertMcpAuditEntry({
    tool: "practice_upload",
    action: entry.action,
    collection: entry.collection,
    document_id: entry.documentId,
    before: entry.before,
    after: entry.after,
    grant_id: String(grant._id),
    client_name: grant.client_name || "MCP klient",
    email: grant.email ?? null,
  })
}

function failure(err: unknown) {
  if (err instanceof BodyTooLargeError) return json({ error: err.message }, 413)
  if (err instanceof PracticeContentError) return json({ error: "The content was rejected.", errors: err.errors, warnings: err.warnings }, 422)
  if (err instanceof PracticeConflictError) return json({ error: err.message }, 409)
  console.error("Practice upload failed:", err)
  return json({ error: "Internal error." }, 500)
}

export async function handlePracticePageUpload(request: Request, slug: string) {
  if (!PRACTICE_SLUG_PATTERN.test(slug)) {
    return json({ error: "The page address must be 2–50 lowercase letters, digits, - or _." }, 400)
  }
  const auth = await authenticatePracticeUpload(request.headers.get("authorization"))
  if (!auth.ok) return json({ error: auth.error }, auth.status)

  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
  if (contentType !== "text/html" && contentType !== "application/json") {
    return json({ error: "Send the page as text/html (generator output) or application/json (envelope)." }, 415)
  }
  const strict = new URL(request.url).searchParams.get("strict") === "1"

  try {
    const body = await readUploadBody(request)
    let input: unknown
    const warnings: string[] = []
    if (contentType === "text/html") {
      const parsed = parsePracticePageHtml(body, { urlSlug: slug })
      if (parsed.errors.length > 0) throw new PracticeContentError(parsed.errors, parsed.warnings)
      warnings.push(...parsed.warnings)
      input = parsed.content
    } else {
      try {
        input = JSON.parse(body)
      } catch {
        return json({ error: "Malformed JSON." }, 400)
      }
    }

    const prepared = preparePageContent(input, { strict })
    const before = await db.getPracticePageBySlug(String(auth.module._id), slug)
    const result = await upsertPracticePage(auth.module, slug, prepared, auth.grant.email ?? null)
    if (result.changed) {
      await auditUpload(auth.grant, {
        action: result.created ? "create" : "update",
        collection: "practice_pages",
        documentId: String(result.page._id),
        before: before ? { slug, revision: before.revision, content_hash: before.content_hash } : null,
        after: { slug, revision: result.revision, content_hash: prepared.contentHash, examples: prepared.content.examples.length },
      })
    }

    const links = practiceLinks(getPublicOrigin(request.headers), auth.module.address_prefix, auth.module.slug, slug)
    return json(
      {
        slug,
        ...links,
        created: result.created,
        changed: result.changed,
        revision: result.revision,
        examples: prepared.content.examples.length,
        steps: prepared.content.examples.reduce((n, ex) => n + ex.steps.length, 0),
        warnings: [...warnings, ...prepared.warnings],
      },
      result.created ? 201 : 200
    )
  } catch (err) {
    return failure(err)
  }
}

export async function handlePracticeModuleUpload(request: Request) {
  const auth = await authenticatePracticeUpload(request.headers.get("authorization"))
  if (!auth.ok) return json({ error: auth.error }, auth.status)

  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
  if (contentType !== "application/json") return json({ error: "Send the manifest as application/json." }, 415)

  try {
    const body = await readUploadBody(request)
    let input: unknown
    try {
      input = JSON.parse(body)
    } catch {
      return json({ error: "Malformed JSON." }, 400)
    }
    const manifest = parseManifest(input)
    const { warnings } = await applyPracticeManifest(auth.module, manifest)
    const after = await db.getPracticeModuleById(String(auth.module._id))
    await auditUpload(auth.grant, {
      action: "update",
      collection: "practice_modules",
      documentId: String(auth.module._id),
      before: { groups: auth.module.groups ?? [], intro_blocks: (auth.module.intro_blocks ?? []).length },
      after: { groups: after?.groups ?? [], intro_blocks: (after?.intro_blocks ?? []).length },
    })
    const links = practiceLinks(getPublicOrigin(request.headers), auth.module.address_prefix, auth.module.slug)
    return json({ ...links, groups: (after?.groups ?? []).map((g: Doc) => ({ key: g.key, title: g.title, pages: g.pages })), warnings })
  } catch (err) {
    return failure(err)
  }
}
