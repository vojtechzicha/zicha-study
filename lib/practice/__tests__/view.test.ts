import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({
  getPracticeModuleByAddress: vi.fn(),
  getSubjectById: vi.fn(),
  getStudyById: vi.fn(),
  getPracticePageSummaries: vi.fn(),
  getPracticeProgressByModuleId: vi.fn(),
  getStudyNoteById: vi.fn(),
  getPracticePageBySlug: vi.fn(),
  getPracticeProgressByPageId: vi.fn(),
}))
vi.mock("@/lib/mongodb/db", () => db)

import { loadPracticeModuleView, loadPracticePageView } from "../view"

const MODULE = {
  _id: "m1",
  subject_id: "sub1",
  study_id: "s1",
  address_prefix: "fim",
  slug: "dmo",
  title: "Diskrétní metody a optimalizace",
  flavour: "graph",
  primary_note_id: "n1",
  groups: [{ id: "g1", key: "p2", title: "Přednáška 2", pages: ["dfs", "bfs", "missing"] }],
}
const STUDY = { _id: "s1", name: "Ing. na FIM", logo_url: "/api/logos/s1", is_public: true, public_slug: "fim" }

beforeEach(() => {
  vi.resetAllMocks()
  db.getPracticeModuleByAddress.mockResolvedValue(MODULE)
  db.getSubjectById.mockResolvedValue({ _id: "sub1", name: "DMO", abbreviation: "KDMO", practice_enabled: true })
  db.getStudyById.mockResolvedValue(STUDY)
  db.getPracticePageSummaries.mockResolvedValue([
    { _id: "pg-bfs", slug: "bfs", title: "BFS", examples: [{ key: "a" }, { key: "b" }] },
    { _id: "pg-dfs", slug: "dfs", title: "DFS", examples: [{ key: "c" }] },
    { _id: "pg-euler", slug: "euler", title: "Euler", examples: [{ key: "d" }] },
  ])
  db.getPracticeProgressByModuleId.mockResolvedValue([
    { page_id: "pg-bfs", example_key: "a" },
    { page_id: "pg-bfs", example_key: "removed-example" },
  ])
  db.getStudyNoteById.mockResolvedValue({ _id: "n1", name: "DMO", note_type: "word", is_public: true, public_slug: "dmo" })
})

describe("loadPracticeModuleView", () => {
  it("lists pages in manifest order, then the unlisted ones under Nezařazené", async () => {
    const view = await loadPracticeModuleView("fim", "dmo")
    expect(view?.groups.map((g) => [g.title, g.pages.map((p) => p.slug)])).toEqual([
      ["Přednáška 2", ["dfs", "bfs"]],
      ["Nezařazené", ["euler"]],
    ])
    expect(view?.module.flavour).toBe("graph")
  })

  it("counts progress only for examples the page still has", async () => {
    const view = await loadPracticeModuleView("fim", "dmo")
    const bfs = view?.groups[0].pages.find((p) => p.slug === "bfs")
    expect(bfs).toMatchObject({ examples: 2, done: 1 })
    expect(view?.totals).toEqual({ examples: 4, done: 1 })
  })

  it("links the primary note: public address, else OneDrive, Markdown to its editor page", async () => {
    expect((await loadPracticeModuleView("fim", "dmo"))?.primaryNote).toEqual({ name: "DMO", href: "/fim/dmo", external: false })

    db.getStudyNoteById.mockResolvedValue({ _id: "n1", name: "DMO", note_type: "word", is_public: false, onedrive_web_url: "https://onedrive.live.com/x" })
    expect((await loadPracticeModuleView("fim", "dmo"))?.primaryNote).toEqual({ name: "DMO", href: "https://onedrive.live.com/x", external: true })

    db.getStudyNoteById.mockResolvedValue({ _id: "n1", name: "DMO", note_type: "markdown" })
    expect((await loadPracticeModuleView("fim", "dmo"))?.primaryNote?.href).toBe("/studies/s1/notes/n1")
  })

  it("returns nothing when practice is turned off for the subject", async () => {
    db.getSubjectById.mockResolvedValue({ _id: "sub1", practice_enabled: false })
    expect(await loadPracticeModuleView("fim", "dmo")).toBeNull()
  })

  it("returns nothing for an unknown address", async () => {
    db.getPracticeModuleByAddress.mockResolvedValue(null)
    expect(await loadPracticeModuleView("fim", "nic")).toBeNull()
  })
})

describe("loadPracticePageView", () => {
  it("returns the page with its done keys (without orphans)", async () => {
    db.getPracticePageBySlug.mockResolvedValue({
      _id: "pg-bfs",
      slug: "bfs",
      title: "BFS",
      lead_html: "Úvod",
      intro_blocks: [],
      footer_html: "Ověřeno.",
      examples: [{ key: "a" }, { key: "b" }],
    })
    db.getPracticeProgressByPageId.mockResolvedValue([{ example_key: "a" }, { example_key: "old" }])
    const view = await loadPracticePageView("fim", "dmo", "bfs")
    expect(view?.done).toEqual(["a"])
    expect(view?.page).toMatchObject({ slug: "bfs", footerHtml: "Ověřeno." })
    expect(db.getPracticePageBySlug).toHaveBeenCalledWith("m1", "bfs")
  })

  it("returns nothing when the subject has practice off", async () => {
    db.getSubjectById.mockResolvedValue({ _id: "sub1", practice_enabled: false })
    expect(await loadPracticePageView("fim", "dmo", "bfs")).toBeNull()
    expect(db.getPracticePageBySlug).not.toHaveBeenCalled()
  })
})
