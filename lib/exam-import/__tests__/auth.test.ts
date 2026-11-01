import crypto from "crypto"
import { describe, expect, it } from "vitest"
import { checkImportToken } from "@/lib/exam-import/auth"

const token = "zsi_test-token"
const hash = crypto.createHash("sha256").update(token).digest("hex")

describe("checkImportToken", () => {
  it("is off until a hash is configured", () => {
    expect(checkImportToken(`Bearer ${token}`, undefined)).toMatchObject({ ok: false, status: 503 })
    expect(checkImportToken(`Bearer ${token}`, "not-a-hash")).toMatchObject({ ok: false, status: 503 })
  })

  it("accepts the token whose hash is configured", () => {
    expect(checkImportToken(`Bearer ${token}`, hash)).toEqual({ ok: true })
    expect(checkImportToken(`bearer ${token}`, `${"0".repeat(64)}, ${hash.toUpperCase()}`)).toEqual({ ok: true })
  })

  it("rejects missing, malformed and unknown tokens", () => {
    expect(checkImportToken(null, hash)).toMatchObject({ ok: false, status: 401 })
    expect(checkImportToken("Bearer other_token", hash)).toMatchObject({ ok: false, status: 401 })
    expect(checkImportToken("Bearer zsi_wrong", hash)).toMatchObject({ ok: false, status: 401 })
    expect(checkImportToken(hash, hash)).toMatchObject({ ok: false, status: 401 })
  })
})
