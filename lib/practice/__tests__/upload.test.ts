import { describe, it, expect, vi, beforeEach } from "vitest"
import fs from "fs"
import path from "path"

const db = vi.hoisted(() => ({
  insertPracticeUploadToken: vi.fn(),
  claimPracticeUploadToken: vi.fn(),
  getMcpGrant: vi.fn(),
  getPracticeModuleById: vi.fn(),
  getSubjectById: vi.fn(),
  getPracticePageBySlug: vi.fn(),
  getPracticePageById: vi.fn(),
  insertPracticePage: vi.fn(),
  casUpdatePracticePageContent: vi.fn(),
  savePracticePageVersion: vi.fn(),
  updatePracticeModule: vi.fn(),
  insertMcpAuditEntry: vi.fn(),
}))
vi.mock("@/lib/mongodb/db", () => db)

import { hashSecret } from "@/lib/mcp/oauth"
import { authenticatePracticeUpload, issuePracticeUploadToken, readUploadBody, BodyTooLargeError } from "../upload"
import { handlePracticeModuleUpload, handlePracticePageUpload } from "../upload-handlers"

const fixture = fs.readFileSync(path.join(__dirname, "../__fixtures__/graph-page.html"), "utf-8")
const MODULE = { _id: "m1", subject_id: "sub1", study_id: "s1", address_prefix: "fim", slug: "dmo", groups: [] }
const TOKEN = "zsp_secret-token-value"

function request(url: string, body: string, contentType: string, token = TOKEN) {
  return new Request(url, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": contentType, host: "www.zicha.study" },
    body,
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("ALLOWED_EMAILS", "owner@example.com")
  vi.stubEnv("MCP_PUBLIC_URL", "https://www.zicha.study")
  db.claimPracticeUploadToken.mockResolvedValue({ _id: "t1", module_id: "m1", grant_id: "g1" })
  db.getMcpGrant.mockResolvedValue({ _id: "g1", email: "owner@example.com", client_name: "Claude", revoked_at: null })
  db.getPracticeModuleById.mockResolvedValue(MODULE)
  db.getSubjectById.mockResolvedValue({ _id: "sub1", practice_enabled: true })
})

describe("issuePracticeUploadToken", () => {
  it("stores only the hash, with an expiry and a request limit", async () => {
    db.insertPracticeUploadToken.mockImplementation(async (doc) => ({ _id: "t1", ...doc }))
    const issued = await issuePracticeUploadToken("m1", "g1", "owner@example.com")
    expect(issued.token).toMatch(/^zsp_[A-Za-z0-9_-]{40,}$/)
    const stored = db.insertPracticeUploadToken.mock.calls[0][0]
    expect(stored.token_hash).toBe(hashSecret(issued.token))
    expect(JSON.stringify(stored)).not.toContain(issued.token)
    expect(stored.expires_at).toBeInstanceOf(Date)
    expect(stored).toMatchObject({ module_id: "m1", grant_id: "g1", max_requests: 200 })
  })
})

describe("authenticatePracticeUpload", () => {
  it("accepts a valid token and claims it by hash", async () => {
    const auth = await authenticatePracticeUpload(`Bearer ${TOKEN}`)
    expect(auth.ok).toBe(true)
    expect(db.claimPracticeUploadToken).toHaveBeenCalledWith(hashSecret(TOKEN))
  })

  it("rejects missing, malformed, unknown or used-up tokens", async () => {
    expect((await authenticatePracticeUpload(null)).ok).toBe(false)
    expect((await authenticatePracticeUpload("Bearer mcp_abc")).ok).toBe(false)
    db.claimPracticeUploadToken.mockResolvedValue(null)
    expect(await authenticatePracticeUpload(`Bearer ${TOKEN}`)).toMatchObject({ ok: false, status: 401 })
  })

  it("stops working when the connection is revoked or the email no longer allowed", async () => {
    db.getMcpGrant.mockResolvedValue({ _id: "g1", email: "owner@example.com", revoked_at: "2026-10-31" })
    expect(await authenticatePracticeUpload(`Bearer ${TOKEN}`)).toMatchObject({ ok: false, status: 401 })
    db.getMcpGrant.mockResolvedValue({ _id: "g1", email: "someone@example.com", revoked_at: null })
    expect(await authenticatePracticeUpload(`Bearer ${TOKEN}`)).toMatchObject({ ok: false, status: 401 })
  })

  it("stops working when practice is turned off", async () => {
    db.getSubjectById.mockResolvedValue({ _id: "sub1", practice_enabled: false })
    expect(await authenticatePracticeUpload(`Bearer ${TOKEN}`)).toMatchObject({ ok: false, status: 403 })
  })
})

describe("readUploadBody", () => {
  it("stops at the size limit", async () => {
    const big = new Request("https://x/", { method: "PUT", body: "x".repeat(2000) })
    await expect(readUploadBody(big, 1000)).rejects.toBeInstanceOf(BodyTooLargeError)
    expect(await readUploadBody(new Request("https://x/", { method: "PUT", body: "čau" }), 1000)).toBe("čau")
  })
})

describe("PUT /api/practice/upload/pages/<slug>", () => {
  const URL_BASE = "https://www.zicha.study/api/practice/upload/pages"

  it("imports a generator page and audits it without the token", async () => {
    db.getPracticePageBySlug.mockResolvedValue(null)
    db.insertPracticePage.mockImplementation(async (base) => ({ _id: "pg1", ...base, revision: 1 }))
    const response = await handlePracticePageUpload(request(`${URL_BASE}/cesty_grafem`, fixture, "text/html"), "cesty_grafem")
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body).toMatchObject({ slug: "cesty_grafem", created: true, changed: true, revision: 1, examples: 2, steps: 3 })
    expect(body.www_url).toBe("https://www.zicha.study/fim/procvicovani/dmo/cesty_grafem")
    const auditEntry = db.insertMcpAuditEntry.mock.calls[0][0]
    expect(auditEntry).toMatchObject({ tool: "practice_upload", action: "create", grant_id: "g1" })
    expect(JSON.stringify(auditEntry)).not.toContain(TOKEN)
    expect(JSON.stringify(auditEntry)).not.toContain("Trojúhelník")
  })

  it("rejects a page whose practice-slug contradicts the address", async () => {
    const response = await handlePracticePageUpload(request(`${URL_BASE}/jina`, fixture, "text/html"), "jina")
    expect(response.status).toBe(422)
    expect((await response.json()).errors[0]).toContain("doesn't match")
  })

  it("requires data-key on every example in strict mode", async () => {
    const response = await handlePracticePageUpload(request(`${URL_BASE}/cesty_grafem?strict=1`, fixture, "text/html"), "cesty_grafem")
    expect(response.status).toBe(422)
    expect(db.insertPracticePage).not.toHaveBeenCalled()
  })

  it("rejects other content types, bad addresses and bad tokens before reading content", async () => {
    expect((await handlePracticePageUpload(request(`${URL_BASE}/x1`, "x", "text/plain"), "x1")).status).toBe(415)
    expect((await handlePracticePageUpload(request(`${URL_BASE}/X!`, "x", "text/html"), "X!")).status).toBe(400)
    db.claimPracticeUploadToken.mockResolvedValue(null)
    expect((await handlePracticePageUpload(request(`${URL_BASE}/x1`, fixture, "text/html"), "x1")).status).toBe(401)
  })

  it("rejects bodies over the limit", async () => {
    const response = await handlePracticePageUpload(request(`${URL_BASE}/x1`, "x".repeat(1_600_000), "text/html"), "x1")
    expect(response.status).toBe(413)
  })
})

describe("PUT /api/practice/upload/module", () => {
  it("applies a manifest", async () => {
    db.getPracticeModuleById.mockResolvedValueOnce(MODULE).mockResolvedValue({ ...MODULE, groups: [{ key: "p2", title: "Přednáška 2", pages: ["bfs"] }] })
    const manifest = { intro_html: "<p>Úvod</p>", groups: [{ key: "p2", title: "Přednáška 2", pages: ["bfs"] }] }
    const response = await handlePracticeModuleUpload(
      request("https://www.zicha.study/api/practice/upload/module", JSON.stringify(manifest), "application/json")
    )
    expect(response.status).toBe(200)
    expect((await response.json()).groups).toEqual([{ key: "p2", title: "Přednáška 2", pages: ["bfs"] }])
    expect(db.updatePracticeModule.mock.calls[0][2].intro_html).toBe("<p>Úvod</p>")
  })

  it("rejects an invalid manifest", async () => {
    const response = await handlePracticeModuleUpload(
      request("https://www.zicha.study/api/practice/upload/module", JSON.stringify({ groups: [{ key: "x" }] }), "application/json")
    )
    expect(response.status).toBe(422)
  })
})
