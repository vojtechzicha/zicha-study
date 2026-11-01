import crypto from "crypto"

// The importer authenticates with a long-lived bearer token. Vercel holds only its SHA-256
// (EXAM_IMPORT_TOKEN_SHA256, hex; several comma-separated hashes allow rotation), so the
// environment never contains a usable secret. Tokens start with "zsi_".

export const EXAM_IMPORT_TOKEN_PREFIX = "zsi_"

export type ImportAuth = { ok: true } | { ok: false; status: number; error: string }

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest()

export function checkImportToken(
  authorization: string | null,
  configured: string | undefined = process.env.EXAM_IMPORT_TOKEN_SHA256
): ImportAuth {
  const hashes = (configured || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => /^[0-9a-f]{64}$/.test(h))
  if (hashes.length === 0) return { ok: false, status: 503, error: "Exam term import is not configured." }

  const bearer = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!bearer || !bearer.startsWith(EXAM_IMPORT_TOKEN_PREFIX)) {
    return { ok: false, status: 401, error: "Missing or malformed import token." }
  }
  const presented = sha256(bearer)
  // Compare against every hash so the time taken doesn't reveal which one matched.
  let match = false
  for (const hex of hashes) {
    if (crypto.timingSafeEqual(presented, Buffer.from(hex, "hex"))) match = true
  }
  return match ? { ok: true } : { ok: false, status: 401, error: "Unknown import token." }
}
