import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({
  getSubjectById: vi.fn(),
  getStudyById: vi.fn(),
  getStudyNotesBySubjectId: vi.fn(),
  getStudyNoteById: vi.fn(),
  getPracticeModuleBySubjectId: vi.fn(),
  getPracticeModuleById: vi.fn(),
  getPracticePageSummaries: vi.fn(),
  getPracticeProgressByModuleId: vi.fn(),
  getPracticeProgressByPageId: vi.fn(),
  getPracticePageBySlug: vi.fn(),
  getPracticePageById: vi.fn(),
  isPracticeAddressAvailable: vi.fn(),
  createPracticeModule: vi.fn(),
  updatePracticeModule: vi.fn(),
  updatePracticePageMeta: vi.fn(),
  setPracticeProgress: vi.fn(),
  insertPracticeUploadToken: vi.fn(),
  getPracticeUploadToken: vi.fn(),
  revokePracticeUploadToken: vi.fn(),
  countPracticePageData: vi.fn(),
  deletePracticePage: vi.fn(),
  updateSubject: vi.fn(),
  insertMcpAuditEntry: vi.fn(),
  normalizeId: (doc: Record<string, any> | null) => {
    if (!doc) return null
    const { _id, ...rest } = doc
    return { id: _id, ...rest }
  },
}))
vi.mock("@/lib/mongodb/db", () => db)

import { practiceTools } from "../tools/practice"
import { subjectTools } from "../tools/subjects"
import { runTool, type ToolContext } from "../tool-kit"

const ctx: ToolContext = {
  auth: { token: "t", clientId: "c", scopes: ["study:read", "study:write"], expiresAt: 0, grantId: "g1", clientName: "Claude", email: "owner@example.com", name: "Owner" },
  origin: "https://www.zicha.study",
}

async function call(name: string, args: Record<string, unknown>) {
  const def = [...practiceTools, ...subjectTools].find((t) => t.name === name)!
  const result = await runTool(def, args, ctx)
  const text = (result.content[0] as { text: string }).text
  let data: any = text
  try {
    data = JSON.parse(text)
  } catch {
    // error text
  }
  return { isError: !!result.isError, data }
}

const SUBJECT = { _id: "sub1", study_id: "s1", name: "Diskrétní metody a optimalizace", abbreviation: "KDMO", practice_enabled: true }
const MODULE = {
  _id: "m1",
  subject_id: "sub1",
  study_id: "s1",
  address_prefix: "fim",
  slug: "dmo",
  title: "DMO",
  flavour: "calc",
  groups: [{ id: "g-a", key: "p2", title: "Přednáška 2", pages: ["bfs", "dfs"] }],
}
const PAGE = { _id: "pg1", module_id: "m1", slug: "bfs", title: "BFS", revision: 2, examples: [{ key: "a", n: 1, title: "A", steps: [{}, {}] }] }

beforeEach(() => {
  vi.resetAllMocks()
  db.getSubjectById.mockResolvedValue(SUBJECT)
  db.getPracticeModuleBySubjectId.mockResolvedValue(MODULE)
  db.getPracticeModuleById.mockResolvedValue(MODULE)
  db.getPracticePageBySlug.mockImplementation(async (_m: string, slug: string) => (slug === "bfs" ? PAGE : null))
  db.isPracticeAddressAvailable.mockResolvedValue(true)
})

describe("update_subject practice_enabled", () => {
  it("creates the module with the primary note's address and reports its link", async () => {
    db.getSubjectById.mockResolvedValueOnce({ ...SUBJECT, practice_enabled: false }).mockResolvedValue(SUBJECT)
    db.getStudyById.mockResolvedValue({ _id: "s1", type: "Magisterské", public_slug: "fim" })
    db.getPracticeModuleBySubjectId.mockResolvedValue(null)
    db.getStudyNotesBySubjectId.mockResolvedValue([{ _id: "n1", public_slug: "dmo", linked_subjects: [{ subject_id: "sub1", is_primary: true }] }])
    db.createPracticeModule.mockImplementation(async (doc) => ({ _id: "m1", ...doc }))
    const { isError, data } = await call("update_subject", { subject_id: "sub1", fields: { practice_enabled: true } })
    expect(isError).toBe(false)
    expect(db.updateSubject).toHaveBeenCalledWith("sub1", { practice_enabled: true })
    expect(data.practice_module).toMatchObject({ address_prefix: "fim", slug: "dmo", www_url: "https://www.zicha.study/fim/procvicovani/dmo" })
  })

  it("is accepted for high-school subjects too", async () => {
    db.getSubjectById.mockResolvedValue({ ...SUBJECT, practice_enabled: false })
    db.getStudyById.mockResolvedValue({ _id: "s1", type: "Střední škola" })
    const { isError } = await call("update_subject", { subject_id: "sub1", fields: { practice_enabled: false }, dry_run: true })
    expect(isError).toBe(false)
  })
})

describe("get_practice_module", () => {
  it("returns null when the subject has none", async () => {
    db.getPracticeModuleBySubjectId.mockResolvedValue(null)
    expect((await call("get_practice_module", { subject_id: "sub1" })).data).toEqual({ practice_enabled: true, module: null })
  })

  it("lists pages with group, progress and links", async () => {
    db.getPracticePageSummaries.mockResolvedValue([PAGE])
    db.getPracticeProgressByModuleId.mockResolvedValue([{ page_id: "pg1", example_key: "a" }, { page_id: "pg1", example_key: "gone" }])
    const { data } = await call("get_practice_module", { subject_id: "sub1" })
    expect(data.pages[0]).toMatchObject({ slug: "bfs", group: "p2", examples: 1, done: 1, www_url: "https://www.zicha.study/fim/procvicovani/dmo/bfs" })
  })
})

describe("update_practice_module", () => {
  it("sanitizes HTML and keeps group ids by key", async () => {
    const { isError } = await call("update_practice_module", {
      subject_id: "sub1",
      fields: { flavour: "graph", intro_html: '<p onclick="x">Úvod</p>', groups: [{ key: "p2", title: "Přednáška 2", pages: ["dfs", "bfs"] }, { key: "p3", title: "Přednáška 3", pages: [] }] },
    })
    expect(isError).toBe(false)
    const [, settings, content] = db.updatePracticeModule.mock.calls[0]
    expect(settings.flavour).toBe("graph")
    expect(settings.groups[0]).toMatchObject({ id: "g-a", pages: ["dfs", "bfs"] })
    expect(settings.groups[1].id).not.toBe("g-a")
    expect(content.intro_html).toBe("<p>Úvod</p>")
  })

  it("refuses a taken address and light-only colours", async () => {
    db.isPracticeAddressAvailable.mockResolvedValue(false)
    expect((await call("update_practice_module", { subject_id: "sub1", fields: { slug: "obda" } })).isError).toBe(true)
    db.isPracticeAddressAvailable.mockResolvedValue(true)
    const { isError, data } = await call("update_practice_module", { subject_id: "sub1", fields: { intro_html: '<span style="background:#fff">x</span>' } })
    expect(isError).toBe(true)
    expect(data).toContain("literal colour")
    expect(db.updatePracticeModule).not.toHaveBeenCalled()
  })

  it("only accepts a primary note of the same study", async () => {
    db.getStudyNoteById.mockResolvedValue({ _id: "n9", study_id: "other" })
    expect((await call("update_practice_module", { subject_id: "sub1", fields: { primary_note_id: "n9" } })).isError).toBe(true)
  })
})

describe("update_practice_page", () => {
  it("renames a page and keeps the group lists pointing at it", async () => {
    db.getPracticePageById.mockResolvedValue({ ...PAGE, slug: "bfs2" })
    const { isError } = await call("update_practice_page", { subject_id: "sub1", page_slug: "bfs", fields: { slug: "bfs2" } })
    expect(isError).toBe(false)
    expect(db.updatePracticePageMeta).toHaveBeenCalledWith("pg1", { slug: "bfs2" })
    expect(db.updatePracticeModule.mock.calls[0][1].groups[0].pages).toEqual(["bfs2", "dfs"])
  })

  it("refuses an address another page has", async () => {
    db.getPracticePageBySlug.mockResolvedValue(PAGE)
    expect((await call("update_practice_page", { subject_id: "sub1", page_slug: "bfs", fields: { slug: "dfs" } })).isError).toBe(true)
  })
})

describe("set_practice_progress", () => {
  it("marks a known example", async () => {
    await call("set_practice_progress", { subject_id: "sub1", page_slug: "bfs", example_key: "a", done: true })
    expect(db.setPracticeProgress).toHaveBeenCalledWith({ module_id: "m1", page_id: "pg1", example_key: "a" }, true, "owner@example.com")
  })

  it("refuses unknown examples", async () => {
    expect((await call("set_practice_progress", { subject_id: "sub1", page_slug: "bfs", example_key: "zzz", done: true })).isError).toBe(true)
  })
})

describe("create_practice_upload", () => {
  it("returns a token for the www origin and never audits it", async () => {
    db.insertPracticeUploadToken.mockImplementation(async (doc) => ({ _id: "t1", ...doc }))
    const { data } = await call("create_practice_upload", { subject_id: "sub1" })
    expect(data.token).toMatch(/^zsp_/)
    expect(data.upload_base_url).toBe("https://www.zicha.study/api/practice/upload")
    expect(db.insertPracticeUploadToken.mock.calls[0][0]).toMatchObject({ module_id: "m1", grant_id: "g1" })
    expect(JSON.stringify(db.insertMcpAuditEntry.mock.calls)).not.toContain(data.token)
  })

  it("refuses while practice is turned off", async () => {
    db.getSubjectById.mockResolvedValue({ ...SUBJECT, practice_enabled: false })
    expect((await call("create_practice_upload", { subject_id: "sub1" })).isError).toBe(true)
    expect(db.insertPracticeUploadToken).not.toHaveBeenCalled()
  })
})

describe("delete_practice_page", () => {
  it("previews versions and progress, deletes only when confirmed", async () => {
    db.countPracticePageData.mockResolvedValue({ practice_page_versions: 2, practice_progress: 5 })
    const preview = await call("delete_practice_page", { subject_id: "sub1", page_slug: "bfs", dry_run: true })
    expect(preview.data.would_delete.also_deleted).toEqual({ practice_page_versions: 2, practice_progress: 5 })
    expect(db.deletePracticePage).not.toHaveBeenCalled()
    await call("delete_practice_page", { subject_id: "sub1", page_slug: "bfs" })
    expect(db.deletePracticePage).toHaveBeenCalledWith("pg1")
  })
})
