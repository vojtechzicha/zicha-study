import { NextResponse } from "next/server"
import * as db from "@/lib/mongodb/db"
import { checkImportToken } from "@/lib/exam-import/auth"
import { runExamTermImport } from "@/lib/exam-import/apply"
import { importRequestSchema } from "@/lib/exam-import/schema"
import { BodyTooLargeError, readUploadBody } from "@/lib/practice/upload"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_BYTES = 512_000

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

// Sync of exam terms from a university system (UIS at ČZU). Auth: a bearer token whose SHA-256 is
// in EXAM_IMPORT_TOKEN_SHA256. Contract and matching rules: docs/EXAM_IMPORT.md.
export async function POST(request: Request) {
  const auth = checkImportToken(request.headers.get("authorization"))
  if (!auth.ok) return json({ error: auth.error }, auth.status)

  if ((request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "Send application/json." }, 415)
  }

  let raw: unknown
  try {
    raw = JSON.parse(await readUploadBody(request, MAX_BYTES))
  } catch (err) {
    if (err instanceof BodyTooLargeError) return json({ error: `The request body is larger than ${MAX_BYTES} bytes.` }, 413)
    return json({ error: "The body is not valid JSON." }, 400)
  }

  const parsed = importRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return json({ error: "Invalid import.", issues: parsed.error.issues.slice(0, 20) }, 400)
  }

  try {
    const study = await db.getStudyById(parsed.data.study_id)
    if (!study) return json({ error: `Study ${parsed.data.study_id} not found.` }, 404)
    return json(await runExamTermImport(parsed.data, study))
  } catch (err) {
    console.error("Exam term import failed:", err)
    return json({ error: "Internal error." }, 500)
  }
}
