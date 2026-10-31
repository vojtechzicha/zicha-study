import { describe, it, expect, vi, beforeEach } from "vitest"

const authMock = vi.fn()
vi.mock("@/auth", () => ({ auth: () => authMock() }))
const revalidatePath = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePath(path) }))
const db = vi.hoisted(() => ({
  getPracticePageById: vi.fn(),
  getSubjectById: vi.fn(),
  setPracticeProgress: vi.fn(),
  getPracticeModuleById: vi.fn(),
  getPracticeModuleBySubjectId: vi.fn(),
  updateSubject: vi.fn(),
  updatePracticeModule: vi.fn(),
  isPracticeAddressAvailable: vi.fn(),
  getStudyNoteById: vi.fn(),
  getPracticePageBySlug: vi.fn(),
  insertPracticePage: vi.fn(),
  casUpdatePracticePageContent: vi.fn(),
  savePracticePageVersion: vi.fn(),
  deletePracticePage: vi.fn(),
}))
vi.mock("@/lib/mongodb/db", () => db)
const ensurePracticeModule = vi.hoisted(() => vi.fn())
vi.mock("@/lib/practice/module", () => ({ ensurePracticeModule }))

import fs from "fs"
import path from "path"
import {
  deletePracticePageAction,
  importPracticePageAction,
  setPracticeEnabledAction,
  setPracticeProgressAction,
  updatePracticeModuleAction,
} from "./practice"

const MODULE = { _id: "m1", subject_id: "sub1", study_id: "s1", address_prefix: "fim", slug: "dmo", groups: [{ id: "g1", key: "p2", title: "Přednáška 2", pages: ["cesty_grafem", "dfs"] }] }

beforeEach(() => {
  vi.resetAllMocks()
  authMock.mockResolvedValue({ user: { email: "owner@example.com", name: "Owner" } })
  db.getPracticePageById.mockResolvedValue({ _id: "pg1", module_id: "m1", subject_id: "sub1", slug: "bfs", examples: [{ key: "a" }] })
  db.getSubjectById.mockResolvedValue({ _id: "sub1", practice_enabled: true })
  db.getPracticeModuleById.mockResolvedValue({ _id: "m1", address_prefix: "fim", slug: "dmo" })
})

describe("setPracticeProgressAction", () => {
  it("saves progress and refreshes the cached index and page", async () => {
    expect(await setPracticeProgressAction("pg1", "a", true)).toEqual({ error: null })
    expect(db.setPracticeProgress).toHaveBeenCalledWith({ module_id: "m1", page_id: "pg1", example_key: "a" }, true, "owner@example.com")
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual(["/fim/procvicovani/dmo", "/fim/procvicovani/dmo/bfs"])
  })

  it("refuses unknown examples and subjects with practice off", async () => {
    expect((await setPracticeProgressAction("pg1", "zzz", true)).error).toBeTruthy()
    db.getSubjectById.mockResolvedValue({ _id: "sub1", practice_enabled: false })
    expect((await setPracticeProgressAction("pg1", "a", true)).error).toBeTruthy()
    expect(db.setPracticeProgress).not.toHaveBeenCalled()
  })
})

describe("setPracticeEnabledAction", () => {
  it("turns practice on and creates the module", async () => {
    db.getSubjectById.mockResolvedValue({ _id: "sub1", study_id: "s1", practice_enabled: false })
    expect(await setPracticeEnabledAction("sub1", true)).toEqual({ error: null })
    expect(db.updateSubject).toHaveBeenCalledWith("sub1", { practice_enabled: true })
    expect(ensurePracticeModule).toHaveBeenCalledWith(expect.objectContaining({ _id: "sub1", practice_enabled: true }))
  })

  it("turns it off without touching the module", async () => {
    db.getSubjectById.mockResolvedValue({ _id: "sub1", practice_enabled: true })
    await setPracticeEnabledAction("sub1", false)
    expect(db.updateSubject).toHaveBeenCalledWith("sub1", { practice_enabled: false })
    expect(ensurePracticeModule).not.toHaveBeenCalled()
  })
})

describe("updatePracticeModuleAction", () => {
  beforeEach(() => {
    db.getPracticeModuleBySubjectId.mockResolvedValue(MODULE)
  })

  it("saves a free address", async () => {
    db.isPracticeAddressAvailable.mockResolvedValue(true)
    expect(await updatePracticeModuleAction("sub1", { slug: "dmo2" })).toEqual({ error: null })
    expect(db.updatePracticeModule).toHaveBeenCalledWith("m1", { address_prefix: "fim", slug: "dmo2" })
  })

  it("refuses a taken or invalid address and a note of another study", async () => {
    db.isPracticeAddressAvailable.mockResolvedValue(false)
    expect((await updatePracticeModuleAction("sub1", { slug: "obda" })).error?.code).toBe("TAKEN")
    expect((await updatePracticeModuleAction("sub1", { slug: "X" })).error?.code).toBe("INVALID")
    db.getStudyNoteById.mockResolvedValue({ _id: "n9", study_id: "other" })
    expect((await updatePracticeModuleAction("sub1", { primaryNoteId: "n9" })).error?.code).toBe("INVALID")
    expect(db.updatePracticeModule).not.toHaveBeenCalled()
  })
})

describe("importPracticePageAction", () => {
  const html = fs.readFileSync(path.join(__dirname, "../practice/__fixtures__/graph-page.html"), "utf-8")

  beforeEach(() => {
    db.getSubjectById.mockResolvedValue({ _id: "sub1", study_id: "s1", practice_enabled: true })
    ensurePracticeModule.mockResolvedValue(MODULE)
    db.getPracticeModuleById.mockResolvedValue(MODULE)
    db.getPracticePageBySlug.mockResolvedValue(null)
    db.insertPracticePage.mockImplementation(async (base) => ({ _id: "pg1", ...base, revision: 1 }))
  })

  it("imports the page and moves it to the chosen group", async () => {
    db.getPracticeModuleById.mockResolvedValue({ ...MODULE, groups: [...MODULE.groups, { id: "g2", key: "p3", title: "Přednáška 3", pages: [] }] })
    ensurePracticeModule.mockResolvedValue({ ...MODULE, groups: [...MODULE.groups, { id: "g2", key: "p3", title: "Přednáška 3", pages: [] }] })
    const result = await importPracticePageAction("sub1", "cesty_grafem", html, { key: "p3" })
    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({ slug: "cesty_grafem", created: true, examples: 2 })
    const groups = db.updatePracticeModule.mock.calls[0][1].groups
    expect(groups.find((g: any) => g.key === "p2").pages).toEqual(["dfs"])
    expect(groups.find((g: any) => g.key === "p3").pages).toEqual(["cesty_grafem"])
  })

  it("creates a new group by title", async () => {
    await importPracticePageAction("sub1", "cesty_grafem", html, { newTitle: "Přednáška 4" })
    const groups = db.updatePracticeModule.mock.calls[0][1].groups
    expect(groups.at(-1)).toMatchObject({ title: "Přednáška 4", pages: ["cesty_grafem"] })
  })

  it("leaves the groups alone without a choice", async () => {
    await importPracticePageAction("sub1", "cesty_grafem", html)
    expect(db.updatePracticeModule).not.toHaveBeenCalled()
  })

  it("reports rejected content and refuses when practice is off", async () => {
    const bad = await importPracticePageAction("sub1", "jina", html)
    expect(bad.error?.code).toBe("INVALID")
    expect(bad.error && "details" in bad.error ? bad.error.details?.[0] : "").toContain("doesn't match")
    db.getSubjectById.mockResolvedValue({ _id: "sub1", practice_enabled: false })
    expect((await importPracticePageAction("sub1", "cesty_grafem", html)).error?.code).toBe("NOT_FOUND")
  })
})

describe("deletePracticePageAction", () => {
  it("deletes a page of the subject's module", async () => {
    db.getPracticeModuleBySubjectId.mockResolvedValue(MODULE)
    db.getPracticePageBySlug.mockResolvedValue({ _id: "pg1", slug: "bfs" })
    expect(await deletePracticePageAction("sub1", "bfs")).toEqual({ error: null })
    expect(db.deletePracticePage).toHaveBeenCalledWith("pg1")
  })
})
