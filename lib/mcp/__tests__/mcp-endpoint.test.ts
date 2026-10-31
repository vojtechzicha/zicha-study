import { describe, it, expect, vi, beforeEach } from "vitest"
import { fakeCollection, fakeMcpDb, pkcePair, resetFakeDb } from "./fake-db"

const domain = vi.hoisted(() => ({
  getStudies: vi.fn(),
  getStudyById: vi.fn(),
  updateStudy: vi.fn(),
  deleteStudy: vi.fn(),
  checkStudySlugAvailability: vi.fn(),
  getCacheOneDriveIdsByStudyId: vi.fn(),
  getSubjectsByStudyId: vi.fn(),
  createSubject: vi.fn(),
  getTaskById: vi.fn(),
  updateTask: vi.fn(),
  getStudyNoteById: vi.fn(),
  deleteStudyNote: vi.fn(),
  getSubjectById: vi.fn(),
  getFinalExamById: vi.fn(),
  unlinkSubjectFromNote: vi.fn(),
  unlinkFinalExamFromNote: vi.fn(),
  getExamPeriodsByStudyId: vi.fn(),
  getExamTermsByPeriodIds: vi.fn(),
  getStudyNotesBySubjectId: vi.fn(),
  countPracticeData: vi.fn(),
  deleteSubject: vi.fn(),
  getFinalExamsByStudyId: vi.fn(),
  getTasksByStudyId: vi.fn(),
  getStudyNotesByStudyId: vi.fn(),
  getMaterialsByStudyId: vi.fn(),
  getSubjectMaterialsByStudyId: vi.fn(),
}))

vi.mock("@/lib/mongodb/db", () => ({
  ...fakeMcpDb,
  ...domain,
  normalizeId: (doc: Record<string, any> | null) => {
    if (!doc) return null
    const { _id, ...rest } = doc
    return { id: _id, ...rest }
  },
  normalizeIds: (docs: Record<string, any>[]) => docs.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
}))

import { POST, GET } from "@/app/api/mcp/route"
import { exchangeAuthorizationCode, issueAuthorizationCode, registerClient, validateAuthorizeRequest } from "@/lib/mcp/oauth"

const ORIGIN = "https://www.zicha.study"
const REDIRECT = "https://claude.ai/api/mcp/auth_callback"

async function accessToken(scope: string) {
  const client = await registerClient({ client_name: "Claude", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none" })
  const { verifier, challenge } = pkcePair()
  const validation = await validateAuthorizeRequest(
    { client_id: client.client_id, redirect_uri: REDIRECT, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", scope },
    ORIGIN
  )
  if (!validation.ok) throw new Error(validation.error)
  const code = await issueAuthorizationCode(validation.request, { email: "owner@example.com", name: "Owner" }, validation.request.scopes)
  const tokens = await exchangeAuthorizationCode(
    new URLSearchParams({ code, code_verifier: verifier }),
    (await fakeMcpDb.getMcpClient(client.client_id))!,
    ORIGIN
  )
  return tokens.access_token
}

let nextId = 1

async function rpc(token: string | null, method: string, params: Record<string, unknown> = {}) {
  const request = new Request(`${ORIGIN}/api/mcp`, {
    method: "POST",
    headers: {
      host: "www.zicha.study",
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  })
  return POST(request as any)
}

async function callTool(token: string, name: string, args: Record<string, unknown>) {
  const response = await rpc(token, "tools/call", { name, arguments: args })
  const body = await response.json()
  const result = body.result as { isError?: boolean; content: { text: string }[] }
  const text = result.content[0].text
  let data: any = text
  try {
    data = JSON.parse(text)
  } catch {
    // error messages are plain text
  }
  return { isError: !!result.isError, data }
}

const STUDY = {
  _id: "s1",
  name: "Informatika",
  type: "Bakalářské",
  form: "prezenční",
  status: "active",
  start_year: 2022,
  is_public: true,
  public_slug: "informatika",
  public_description: "Popis",
}

beforeEach(() => {
  resetFakeDb()
  vi.clearAllMocks()
  vi.stubEnv("ALLOWED_EMAILS", "owner@example.com")
  vi.stubEnv("MCP_PUBLIC_URL", ORIGIN)
  domain.getStudies.mockResolvedValue([STUDY])
  domain.getStudyById.mockImplementation(async (id: string) => (id === "s1" ? { ...STUDY } : null))
  domain.getCacheOneDriveIdsByStudyId.mockResolvedValue([])
})

describe("/api/mcp authentication", () => {
  it("answers 401 with the resource metadata link", async () => {
    const response = await rpc(null, "tools/list")
    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate")).toContain(
      `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/api/mcp"`
    )
  })

  it("rejects an unknown token", async () => {
    const response = await rpc("zs_at_bogus", "tools/list")
    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate")).toContain('error="invalid_token"')
  })

  it("answers 405 to an authenticated GET (no SSE stream)", async () => {
    const token = await accessToken("study:read")
    const response = await GET(new Request(`${ORIGIN}/api/mcp`, { headers: { authorization: `Bearer ${token}` } }) as any)
    expect(response.status).toBe(405)
  })
})

describe("/api/mcp tools", () => {
  it("initializes with server instructions", async () => {
    const token = await accessToken("study:read")
    const response = await rpc(token, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    })
    const body = await response.json()
    expect(body.result.serverInfo.name).toBe("zicha-study")
    expect(body.result.instructions).toContain("list_studies")
  })

  it("lists only read tools for a read-only token", async () => {
    const token = await accessToken("study:read")
    const body = await (await rpc(token, "tools/list")).json()
    const names: string[] = body.result.tools.map((t: { name: string }) => t.name)
    expect(names).toContain("list_studies")
    expect(names.some((n) => /^(create|update|delete|set|link|unlink)_/.test(n))).toBe(false)
  })

  it("lists write and delete tools with annotations for a write token", async () => {
    const token = await accessToken("study:read study:write")
    const body = await (await rpc(token, "tools/list")).json()
    const tools = Object.fromEntries(body.result.tools.map((t: any) => [t.name, t]))
    expect(tools.delete_study.annotations).toMatchObject({ destructiveHint: true, readOnlyHint: false })
    expect(tools.list_studies.annotations).toMatchObject({ readOnlyHint: true })
    expect(tools.update_study.inputSchema.properties.fields.additionalProperties).toBe(false)
  })

  it("returns study summaries", async () => {
    const token = await accessToken("study:read")
    const { data } = await callTool(token, "list_studies", {})
    expect(data).toEqual([expect.objectContaining({ id: "s1", name: "Informatika", kind: "university" })])
  })

  it("dry runs an update without writing", async () => {
    const token = await accessToken("study:write")
    const { data } = await callTool(token, "update_study", { study_id: "s1", fields: { name: "Informatika 2" }, dry_run: true })
    expect(data).toEqual({ dry_run: true, changes: { name: { from: "Informatika", to: "Informatika 2" } } })
    expect(domain.updateStudy).not.toHaveBeenCalled()
    expect(fakeCollection("mcp_audit")).toHaveLength(0)
  })

  it("clears the address when sharing is turned off and audits the write", async () => {
    const token = await accessToken("study:write")
    await callTool(token, "update_study", { study_id: "s1", fields: { is_public: false } })
    expect(domain.updateStudy).toHaveBeenCalledWith("s1", { is_public: false, public_slug: null, public_description: null })
    const [entry] = fakeCollection("mcp_audit")
    expect(entry).toMatchObject({ tool: "update_study", action: "update", document_id: "s1", email: "owner@example.com" })
    expect(entry.before.public_slug).toBe("informatika")
  })

  it("rejects unknown fields and invalid enum values", async () => {
    const token = await accessToken("study:write")
    const unknown = await callTool(token, "update_study", { study_id: "s1", fields: { logo_data: "x" } })
    expect(unknown.isError).toBe(true)
    const badEnum = await callTool(token, "update_study", { study_id: "s1", fields: { status: "done" } })
    expect(badEnum.isError).toBe(true)
    expect(domain.updateStudy).not.toHaveBeenCalled()
  })

  it("refuses to enable the exam scheduler on a non-active study", async () => {
    const token = await accessToken("study:write")
    const { isError, data } = await callTool(token, "update_study", {
      study_id: "s1",
      fields: { status: "completed", exam_scheduler_enabled: true },
    })
    expect(isError).toBe(true)
    expect(data).toContain("active")
  })

  it("refuses to delete a study with OneDrive backup copies", async () => {
    domain.getCacheOneDriveIdsByStudyId.mockResolvedValue(["od1"])
    const token = await accessToken("study:write")
    const { isError, data } = await callTool(token, "delete_study", { study_id: "s1" })
    expect(isError).toBe(true)
    expect(data).toContain("OneDrive")
    expect(domain.deleteStudy).not.toHaveBeenCalled()
  })

  it("keeps high-school subjects to their own fields", async () => {
    domain.getStudyById.mockResolvedValue({ ...STUDY, type: "Střední škola" })
    const token = await accessToken("study:write")
    const { isError } = await callTool(token, "create_subject", { study_id: "s1", fields: { name: "Matematika", semester: "1. ročník ZS" } })
    expect(isError).toBe(true)
    expect(domain.createSubject).not.toHaveBeenCalled()
  })

  it("stores completed_at when a task is marked done", async () => {
    domain.getTaskById.mockResolvedValue({ _id: "t1", study_id: "s1", title: "Esej", deadline: "2026-11-01", completed_at: null })
    const token = await accessToken("study:write")
    await callTool(token, "update_task", { task_id: "t1", fields: { completed: true } })
    expect(domain.updateTask).toHaveBeenCalledWith("t1", { completed_at: expect.any(String) })
  })

  it("only deletes Markdown notes", async () => {
    domain.getStudyNoteById.mockResolvedValue({ _id: "n1", study_id: "s1", note_type: "word", name: "Zápis" })
    const token = await accessToken("study:write")
    const { isError } = await callTool(token, "delete_note", { note_id: "n1" })
    expect(isError).toBe(true)
    expect(domain.deleteStudyNote).not.toHaveBeenCalled()
  })

  it("removes a note's link to a deleted subject", async () => {
    domain.getStudyNoteById.mockResolvedValue({
      _id: "n1",
      study_id: "s1",
      name: "SZZ Management",
      linked_subjects: [{ subject_id: "gone", is_primary: false }],
    })
    domain.getSubjectById.mockResolvedValue(null)
    const token = await accessToken("study:write")
    const { isError } = await callTool(token, "unlink_note", { note_id: "n1", subject_id: "gone" })
    expect(isError).toBe(false)
    expect(domain.unlinkSubjectFromNote).toHaveBeenCalledWith("n1", "gone")
  })

  it("removes a note's link to a deleted final exam", async () => {
    domain.getStudyNoteById.mockResolvedValue({
      _id: "n1",
      study_id: "s1",
      name: "SZZ Management",
      linked_final_exams: [{ final_exam_id: "gone", is_primary: true }],
    })
    domain.getFinalExamById.mockResolvedValue(null)
    const token = await accessToken("study:write")
    const { isError } = await callTool(token, "unlink_note", { note_id: "n1", final_exam_id: "gone" })
    expect(isError).toBe(false)
    expect(domain.unlinkFinalExamFromNote).toHaveBeenCalledWith("n1", "gone")
  })

  it("still rejects unlinking an unknown subject the note isn't linked to", async () => {
    domain.getStudyNoteById.mockResolvedValue({ _id: "n1", study_id: "s1", name: "Zápis", linked_subjects: [] })
    domain.getSubjectById.mockResolvedValue(null)
    const token = await accessToken("study:write")
    const { isError, data } = await callTool(token, "unlink_note", { note_id: "n1", subject_id: "nope" })
    expect(isError).toBe(true)
    expect(String(data)).toContain("not found")
    expect(domain.unlinkSubjectFromNote).not.toHaveBeenCalled()
  })

  it("reports the practice pages a subject deletion removes", async () => {
    domain.getSubjectById.mockResolvedValue({ _id: "sub1", study_id: "s1", name: "DMO" })
    domain.getExamPeriodsByStudyId.mockResolvedValue([])
    domain.getExamTermsByPeriodIds.mockResolvedValue([])
    domain.getStudyNotesBySubjectId.mockResolvedValue([])
    domain.countPracticeData.mockResolvedValue({ practice_modules: 1, practice_pages: 12, practice_progress: 40 })
    const token = await accessToken("study:write")
    const { data } = await callTool(token, "delete_subject", { subject_id: "sub1", dry_run: true })
    expect(data.would_delete.also_deleted).toMatchObject({ practice_modules: 1, practice_pages: 12, practice_progress: 40 })
    expect(domain.countPracticeData).toHaveBeenCalledWith({ subject_id: "sub1" })
    expect(domain.deleteSubject).not.toHaveBeenCalled()
  })

  it("reports the practice pages a study deletion removes", async () => {
    for (const fn of [
      domain.getSubjectsByStudyId, domain.getFinalExamsByStudyId, domain.getTasksByStudyId, domain.getStudyNotesByStudyId,
      domain.getMaterialsByStudyId, domain.getSubjectMaterialsByStudyId, domain.getExamPeriodsByStudyId, domain.getExamTermsByPeriodIds,
    ]) fn.mockResolvedValue([])
    domain.countPracticeData.mockResolvedValue({ practice_modules: 2, practice_pages: 30, practice_progress: 0 })
    const token = await accessToken("study:write")
    const { data } = await callTool(token, "delete_study", { study_id: "s1", dry_run: true })
    expect(data.would_delete.also_deleted).toMatchObject({ practice_modules: 2, practice_pages: 30 })
    expect(domain.countPracticeData).toHaveBeenCalledWith({ study_id: "s1" })
    expect(domain.deleteStudy).not.toHaveBeenCalled()
  })

  it("does not let a read-only token call write tools", async () => {
    const token = await accessToken("study:read")
    const body = await (await rpc(token, "tools/call", { name: "delete_study", arguments: { study_id: "s1" } })).json()
    expect(body.error ?? body.result?.isError).toBeTruthy()
    expect(domain.deleteStudy).not.toHaveBeenCalled()
  })
})
