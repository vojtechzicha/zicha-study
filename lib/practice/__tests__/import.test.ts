import { describe, it, expect, vi, beforeEach } from "vitest"
import fs from "fs"
import path from "path"

const db = vi.hoisted(() => ({
  getPracticePageBySlug: vi.fn(),
  getPracticePageById: vi.fn(),
  insertPracticePage: vi.fn(),
  casUpdatePracticePageContent: vi.fn(),
  savePracticePageVersion: vi.fn(),
  updatePracticeModule: vi.fn(),
}))
vi.mock("@/lib/mongodb/db", () => db)

import { applyPracticeManifest, PracticeConflictError, upsertPracticePage } from "../import"
import { preparePageContent } from "../content"
import { parsePracticePageHtml } from "../parse-html"

const html = fs.readFileSync(path.join(__dirname, "../__fixtures__/graph-page.html"), "utf-8")
const MODULE = { _id: "m1", subject_id: "sub1", study_id: "s1", groups: [{ id: "g-old", key: "p2", title: "Přednáška 2", pages: [] }] }

function prepared(lead = "Úvod.") {
  const content = parsePracticePageHtml(html).content
  content.lead_html = lead
  return preparePageContent(content)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("upsertPracticePage", () => {
  it("inserts a new page at revision 1", async () => {
    db.getPracticePageBySlug.mockResolvedValue(null)
    db.insertPracticePage.mockImplementation(async (base) => ({ _id: "pg1", ...base, revision: 1 }))
    const result = await upsertPracticePage(MODULE, "cesty", prepared(), "owner@example.com")
    expect(result).toMatchObject({ created: true, changed: true, revision: 1 })
    expect(db.insertPracticePage.mock.calls[0][0]).toEqual({ module_id: "m1", subject_id: "sub1", study_id: "s1", slug: "cesty" })
  })

  it("does nothing for an identical upload", async () => {
    const p = prepared()
    db.getPracticePageBySlug.mockResolvedValue({ _id: "pg1", content_hash: p.contentHash, revision: 4 })
    const result = await upsertPracticePage(MODULE, "cesty", p, null)
    expect(result).toMatchObject({ created: false, changed: false, revision: 4 })
    expect(db.savePracticePageVersion).not.toHaveBeenCalled()
    expect(db.casUpdatePracticePageContent).not.toHaveBeenCalled()
  })

  it("keeps the previous content as a version and updates with a revision check", async () => {
    const old = { _id: "pg1", content_hash: "old", revision: 2, title: "Staré", lead_html: "x", examples: [] }
    db.getPracticePageBySlug.mockResolvedValue(old)
    db.casUpdatePracticePageContent.mockResolvedValue(true)
    db.getPracticePageById.mockResolvedValue({ ...old, revision: 3 })
    const result = await upsertPracticePage(MODULE, "cesty", prepared(), "owner@example.com")
    expect(result).toMatchObject({ changed: true, revision: 3 })
    expect(db.savePracticePageVersion).toHaveBeenCalledWith("pg1", 2, expect.objectContaining({ title: "Staré" }), "owner@example.com")
    expect(db.casUpdatePracticePageContent.mock.calls[0].slice(0, 2)).toEqual(["pg1", 2])
  })

  it("retries once after losing a race, then reports a conflict", async () => {
    db.getPracticePageBySlug
      .mockResolvedValueOnce({ _id: "pg1", content_hash: "a", revision: 2, examples: [] })
      .mockResolvedValueOnce({ _id: "pg1", content_hash: "b", revision: 3, examples: [] })
    db.casUpdatePracticePageContent.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    db.getPracticePageById.mockResolvedValue({ _id: "pg1", revision: 4 })
    expect((await upsertPracticePage(MODULE, "cesty", prepared(), null)).revision).toBe(4)
    expect(db.savePracticePageVersion.mock.calls.map((c) => c[1])).toEqual([2, 3])

    db.getPracticePageBySlug.mockResolvedValue({ _id: "pg1", content_hash: "a", revision: 2, examples: [] })
    db.casUpdatePracticePageContent.mockResolvedValue(false)
    await expect(upsertPracticePage(MODULE, "cesty", prepared(), null)).rejects.toBeInstanceOf(PracticeConflictError)
  })

  it("updates instead when the page was created concurrently", async () => {
    db.getPracticePageBySlug.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "pg1", content_hash: "x", revision: 1, examples: [] })
    db.insertPracticePage.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }))
    db.casUpdatePracticePageContent.mockResolvedValue(true)
    db.getPracticePageById.mockResolvedValue({ _id: "pg1", revision: 2 })
    expect(await upsertPracticePage(MODULE, "cesty", prepared(), null)).toMatchObject({ created: false, revision: 2 })
  })
})

describe("applyPracticeManifest", () => {
  it("keeps group ids by key, sanitizes HTML and never lists a page twice", async () => {
    const { warnings } = await applyPracticeManifest(MODULE, {
      intro_html: '<p onclick="x">Úvod</p>',
      groups: [
        { key: "p2", title: "Přednáška 2", pages: ["bfs", "dfs"] },
        { key: "p3", title: "Přednáška 3", description: "Blok 10. 10.", pages: ["dfs", "euler"] },
      ],
    })
    const [id, settings, content] = db.updatePracticeModule.mock.calls[0]
    expect(id).toBe("m1")
    expect(settings.groups[0]).toEqual({ id: "g-old", key: "p2", title: "Přednáška 2", description: null, pages: ["bfs", "dfs"] })
    expect(settings.groups[1]).toMatchObject({ key: "p3", description: "Blok 10. 10.", pages: ["euler"] })
    expect(settings.groups[1].id).not.toBe("g-old")
    expect(content.intro_html).toBe("<p>Úvod</p>")
    expect(warnings.some((w) => w.includes("dfs"))).toBe(true)
  })

  it("leaves groups alone when the manifest has none", async () => {
    await applyPracticeManifest(MODULE, { intro_html: "<p>x</p>" })
    expect(db.updatePracticeModule.mock.calls[0][1]).toEqual({})
  })
})
