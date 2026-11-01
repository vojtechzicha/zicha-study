import { NextResponse } from "next/server"
import * as db from "@/lib/mongodb/db"
import { checkImportToken } from "@/lib/exam-import/auth"
import { planVenueDays, venueDaysRequestSchema } from "@/lib/venues/import"
import { BodyTooLargeError, readUploadBody } from "@/lib/practice/upload"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_BYTES = 200_000

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

// Opening days of an exam venue (Testovací centrum PEF), posted by agents-study exam-watch with
// the exam-import token. Contract: docs/EXAM_WINDOWS.md.
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
  const parsed = venueDaysRequestSchema.safeParse(raw)
  if (!parsed.success) return json({ error: "Invalid venue days.", issues: parsed.error.issues.slice(0, 20) }, 400)

  try {
    const body = parsed.data
    const settings = await db.getAppSettings()
    const previousThrough: string | null = settings?.venue_calendars?.[body.venue]?.published_through ?? null
    const existing = (await db.getVenueDays(body.venue)) as any[]
    const plan = planVenueDays(existing, body, previousThrough)
    if (!body.dry_run) await db.applyVenueDays(body.venue, plan.upserts, plan.deletes, plan.publishedThrough)
    return json({
      dry_run: body.dry_run,
      added: plan.added,
      removed: plan.removed,
      changed: plan.changed,
      days: plan.upserts.length,
      published_through: plan.publishedThrough,
    })
  } catch (err) {
    console.error("Venue days import failed:", err)
    return json({ error: "Internal error." }, 500)
  }
}
