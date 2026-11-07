import { describe, it, expect, vi, beforeEach } from "vitest"
import { z } from "zod"

const db = vi.hoisted(() => ({
  getStudyById: vi.fn(),
  getSubjectById: vi.fn(),
  getRepeatRootId: vi.fn(),
  getMaterialById: vi.fn(),
  getSubjectMaterialById: vi.fn(),
  getMaterialsByStudyId: vi.fn(),
  getSubjectMaterialsByStudyId: vi.fn(),
  getSubjectMaterialsBySubjectId: vi.fn(),
  createMaterial: vi.fn(),
  createSubjectMaterial: vi.fn(),
  updateMaterial: vi.fn(),
  updateSubjectMaterial: vi.fn(),
  deleteMaterial: vi.fn(),
  deleteSubjectMaterial: vi.fn(),
  checkMaterialSlugAvailability: vi.fn(),
  checkSubjectMaterialSlugAvailability: vi.fn(),
  insertMcpAuditEntry: vi.fn(),
  normalizeId: (doc: Record<string, any> | null) => {
    if (!doc) return null
    const { _id, ...rest } = doc
    return { id: _id, ...rest }
  },
}))
vi.mock("@/lib/mongodb/db", () => db)

import { materialTools } from "../tools/materials"
import { runTool, type ToolContext } from "../tool-kit"

const ctx: ToolContext = {
  auth: { token: "t", clientId: "c", scopes: ["study:read", "study:write"], expiresAt: 0, grantId: "g1", clientName: "Claude", email: "owner@example.com", name: "Owner" },
  origin: "https://www.zicha.study",
}

function tool(name: string) {
  return materialTools.find((t) => t.name === name)!
}

async function call(name: string, args: Record<string, unknown>) {
  const result = await runTool(tool(name), args, ctx)
  const text = (result.content[0] as { text: string }).text
  let data: any = text
  try {
    data = JSON.parse(text)
  } catch {
    // error text
  }
  return { isError: !!result.isError, data }
}

const STUDY = { _id: "s1", name: "Informatika", is_public: true, public_slug: "informatika" }
const SUBJECT = { _id: "sub2", study_id: "s1", name: "Softwarové inženýrství", repeats_subject_id: "sub1" }
const FILE = {
  _id: "m1",
  study_id: "s1",
  name: "Sylabus",
  file_name: "sylabus.pdf",
  onedrive_id: "od1",
  onedrive_web_url: "https://onedrive.live.com/x",
  cache_onedrive_id: "c1",
  is_public: true,
  public_slug: "sylabus",
  public_share_url: "https://1drv.ms/x",
}
const LINK = {
  _id: "m2",
  study_id: "s1",
  subject_id: "sub1",
  material_type: "link",
  link_url: "https://www.figma.com/file/abc",
  name: "Projekt",
  is_public: false,
  public_slug: null,
}

beforeEach(() => {
  vi.resetAllMocks()
  db.getStudyById.mockImplementation(async (id: string) => (id === "s1" ? { ...STUDY } : null))
  db.getSubjectById.mockImplementation(async (id: string) => (id === "sub2" ? SUBJECT : null))
  db.getRepeatRootId.mockResolvedValue("sub1")
  db.getMaterialById.mockImplementation(async (id: string) => (id === "m1" ? { ...FILE } : null))
  db.getSubjectMaterialById.mockImplementation(async (id: string) => (id === "m2" ? { ...LINK } : null))
  db.createMaterial.mockImplementation(async (data: Record<string, any>) => ({ _id: "new", ...data }))
  db.createSubjectMaterial.mockImplementation(async (data: Record<string, any>) => ({ _id: "new", ...data }))
  db.checkMaterialSlugAvailability.mockResolvedValue(true)
  db.checkSubjectMaterialSlugAvailability.mockResolvedValue(true)
})

describe("list_materials", () => {
  it("lists a repeated subject's materials from its first attempt, typing legacy ones as files", async () => {
    db.getSubjectMaterialsBySubjectId.mockResolvedValue([LINK, { ...FILE, subject_id: "sub1" }])
    const { data } = await call("list_materials", { study_id: "s1", subject_id: "sub2" })
    expect(db.getSubjectMaterialsBySubjectId).toHaveBeenCalledWith("sub1")
    expect(data).toEqual([
      expect.objectContaining({ id: "m2", material_type: "link", link_url: "https://www.figma.com/file/abc" }),
      expect.objectContaining({ id: "m1", material_type: "file", file_name: "sylabus.pdf" }),
    ])
    expect(data[1]).not.toHaveProperty("cache_onedrive_id")
  })
})

describe("create_link_material", () => {
  it("normalizes the address and attaches it to the subject's first attempt", async () => {
    const { isError, data } = await call("create_link_material", {
      study_id: "s1",
      subject_id: "sub2",
      fields: { name: "Skupinový projekt", link_url: "github.com/tym/projekt", category: "Skupinová práce" },
    })
    expect(isError).toBe(false)
    expect(db.createSubjectMaterial).toHaveBeenCalledWith(
      expect.objectContaining({
        study_id: "s1",
        subject_id: "sub1",
        material_type: "link",
        link_url: "https://github.com/tym/projekt",
        category: "Skupinová práce",
        is_public: false,
      })
    )
    expect(data.created).toMatchObject({ id: "new", material_type: "link", subject_id: "sub1" })
    expect(db.insertMcpAuditEntry).toHaveBeenCalledWith(expect.objectContaining({ tool: "create_link_material", collection: "subject_materials" }))
  })

  it("creates a study material without subject_id", async () => {
    await call("create_link_material", { study_id: "s1", fields: { name: "Wiki", link_url: "https://wiki.example.com" } })
    expect(db.createMaterial).toHaveBeenCalledWith(expect.not.objectContaining({ subject_id: expect.anything() }))
  })

  it("refuses non-http addresses and missing fields", async () => {
    const bad = await call("create_link_material", { study_id: "s1", fields: { name: "X", link_url: "javascript:alert(1)" } })
    expect(bad.isError).toBe(true)
    const missing = await call("create_link_material", { study_id: "s1", fields: { name: "X" } })
    expect(missing.isError).toBe(true)
    expect(db.createMaterial).not.toHaveBeenCalled()
  })

  it("accepts only the app's categories", () => {
    const schema = z.object(tool("create_link_material").input)
    const args = { study_id: "s1", fields: { name: "X", link_url: "https://a.cz" } }
    expect(schema.safeParse({ ...args, fields: { ...args.fields, category: "Skupinová práce" } }).success).toBe(true)
    expect(schema.safeParse({ ...args, fields: { ...args.fields, category: "Projekt" } }).success).toBe(false)
  })
})

describe("update_material", () => {
  it("publishes a link at a free address", async () => {
    const { isError } = await call("update_material", { material_id: "m2", fields: { is_public: true, public_slug: "projekt" } })
    expect(isError).toBe(false)
    expect(db.checkSubjectMaterialSlugAvailability).toHaveBeenCalledWith("s1", "projekt", "m2")
    expect(db.updateSubjectMaterial).toHaveBeenCalledWith("m2", expect.objectContaining({ is_public: true, public_slug: "projekt" }))
  })

  it("refuses publishing in a private study or at a taken address", async () => {
    db.getStudyById.mockResolvedValue({ ...STUDY, is_public: false })
    const privateStudy = await call("update_material", { material_id: "m2", fields: { is_public: true, public_slug: "projekt" } })
    expect(privateStudy.isError).toBe(true)

    db.getStudyById.mockResolvedValue({ ...STUDY })
    db.checkSubjectMaterialSlugAvailability.mockResolvedValue(false)
    const taken = await call("update_material", { material_id: "m2", fields: { is_public: true, public_slug: "projekt" } })
    expect(taken.isError).toBe(true)
    expect(db.updateSubjectMaterial).not.toHaveBeenCalled()
  })

  it("dry runs a link change", async () => {
    const { data } = await call("update_material", { material_id: "m2", fields: { link_url: "miro.com/board" }, dry_run: true })
    expect(data).toEqual({
      dry_run: true,
      changes: { link_url: { from: "https://www.figma.com/file/abc", to: "https://miro.com/board" } },
    })
    expect(db.updateSubjectMaterial).not.toHaveBeenCalled()
  })

  it("edits a file's metadata and unpublishes it, but doesn't give it a link or publish it", async () => {
    await call("update_material", { material_id: "m1", fields: { name: "Sylabus 2026", is_public: false } })
    expect(db.updateMaterial).toHaveBeenCalledWith("m1", {
      name: "Sylabus 2026",
      is_public: false,
      public_slug: null,
      public_share_url: null,
    })

    db.getMaterialById.mockResolvedValue({ ...FILE, is_public: false, public_slug: null })
    const publish = await call("update_material", { material_id: "m1", fields: { is_public: true, public_slug: "sylabus" } })
    expect(publish.isError).toBe(true)
    const link = await call("update_material", { material_id: "m1", fields: { link_url: "https://a.cz" } })
    expect(link.isError).toBe(true)
    expect(db.updateMaterial).toHaveBeenCalledTimes(1)
  })
})

describe("delete_material", () => {
  it("deletes a link material", async () => {
    const { isError } = await call("delete_material", { material_id: "m2" })
    expect(isError).toBe(false)
    expect(db.deleteSubjectMaterial).toHaveBeenCalledWith("m2")
  })

  it("leaves OneDrive files to the app", async () => {
    const { isError, data } = await call("delete_material", { material_id: "m1" })
    expect(isError).toBe(true)
    expect(data).toContain("OneDrive")
    expect(db.deleteMaterial).not.toHaveBeenCalled()
  })

  it("reports an unknown material", async () => {
    const { isError, data } = await call("delete_material", { material_id: "nope" })
    expect(isError).toBe(true)
    expect(data).toContain("not found")
  })
})
