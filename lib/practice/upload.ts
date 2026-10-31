import crypto from "crypto"
import * as db from "@/lib/mongodb/db"
import { isEmailAllowed } from "@/lib/allowed-emails"
import { hashSecret } from "@/lib/mcp/oauth"

// Practice upload tokens. The MCP tool create_practice_upload issues one per module; an agent
// then PUTs pages and the manifest to /api/practice/upload/… with the token as a bearer, so page
// bodies never pass through tool arguments. A token lasts 30 minutes and 200 requests, and stops
// working as soon as its MCP connection is revoked, its email leaves ALLOWED_EMAILS, or the
// subject's practice is turned off.

export const PRACTICE_UPLOAD_TOKEN_PREFIX = "zsp_"
export const PRACTICE_UPLOAD_TTL_MS = 30 * 60 * 1000
export const PRACTICE_UPLOAD_MAX_REQUESTS = 200
export const PRACTICE_UPLOAD_MAX_BYTES = 1_500_000

type Doc = Record<string, any>

export async function issuePracticeUploadToken(moduleId: string, grantId: string, email: string | null) {
  const token = PRACTICE_UPLOAD_TOKEN_PREFIX + crypto.randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + PRACTICE_UPLOAD_TTL_MS)
  const doc = await db.insertPracticeUploadToken({
    token_hash: hashSecret(token),
    module_id: moduleId,
    grant_id: grantId,
    email,
    expires_at: expiresAt,
    max_requests: PRACTICE_UPLOAD_MAX_REQUESTS,
  })
  return { token, tokenId: String(doc._id), expiresAt, maxRequests: PRACTICE_UPLOAD_MAX_REQUESTS }
}

export type UploadAuth =
  | { ok: true; token: Doc; module: Doc; subject: Doc; grant: Doc }
  | { ok: false; status: number; error: string }

/** Checks the bearer token of an upload request and counts the request against it. */
export async function authenticatePracticeUpload(authorization: string | null): Promise<UploadAuth> {
  const bearer = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!bearer || !bearer.startsWith(PRACTICE_UPLOAD_TOKEN_PREFIX)) {
    return { ok: false, status: 401, error: "Missing or malformed upload token." }
  }
  const token = await db.claimPracticeUploadToken(hashSecret(bearer))
  if (!token) return { ok: false, status: 401, error: "The upload token is unknown, expired, revoked or used up." }

  // Same checks as an MCP access token: the connection must still exist and be allowed.
  const grant = await db.getMcpGrant(token.grant_id)
  if (!grant || grant.revoked_at || !isEmailAllowed(grant.email)) {
    return { ok: false, status: 401, error: "The Claude connection that issued this token was revoked." }
  }
  const practiceModule = await db.getPracticeModuleById(token.module_id)
  const subject = practiceModule ? await db.getSubjectById(practiceModule.subject_id) : null
  if (!practiceModule || !subject?.practice_enabled) {
    return { ok: false, status: 403, error: "Practice is turned off for this subject." }
  }
  return { ok: true, token, module: practiceModule, subject, grant }
}

export class BodyTooLargeError extends Error {
  constructor() {
    super(`The request body is larger than ${PRACTICE_UPLOAD_MAX_BYTES} bytes.`)
    this.name = "BodyTooLargeError"
  }
}

/** Reads the body as UTF-8, stopping as soon as it exceeds the size limit. */
export async function readUploadBody(request: Request, maxBytes = PRACTICE_UPLOAD_MAX_BYTES): Promise<string> {
  const declared = Number(request.headers.get("content-length") || 0)
  if (declared > maxBytes) throw new BodyTooLargeError()
  if (!request.body) return ""
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new BodyTooLargeError()
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString("utf-8")
}
