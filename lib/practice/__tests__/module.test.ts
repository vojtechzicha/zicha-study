import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({
  getPracticeModuleBySubjectId: vi.fn(),
  getStudyById: vi.fn(),
  getStudyNotesBySubjectId: vi.fn(),
  isPracticeAddressAvailable: vi.fn(),
  createPracticeModule: vi.fn(),
}))
vi.mock("@/lib/mongodb/db", () => db)

import { defaultModuleAddress, ensurePracticeModule, findPrimaryNote } from "../module"

const SUBJECT = { _id: "sub1", study_id: "s1", name: "Diskrétní metody a optimalizace", abbreviation: "KDMO" }
const NOTE = { _id: "n1", public_slug: "dmo", linked_subjects: [{ subject_id: "sub1", is_primary: true }] }

beforeEach(() => {
  vi.resetAllMocks()
  db.isPracticeAddressAvailable.mockResolvedValue(true)
  db.createPracticeModule.mockImplementation(async (doc) => ({ _id: "m1", ...doc }))
})

describe("defaultModuleAddress", () => {
  it("uses the study's address and the primary note's address", () => {
    expect(defaultModuleAddress({ public_slug: "fim" }, SUBJECT, NOTE)).toEqual({ addressPrefix: "fim", slug: "dmo" })
  })

  it("falls back to the abbreviation, then the names", () => {
    expect(defaultModuleAddress({ public_slug: "czu" }, SUBJECT, null).slug).toBe("kdmo")
    expect(defaultModuleAddress({ public_slug: null, name: "Ing. na FIM" }, { name: "Právo III" }, null)).toEqual({
      addressPrefix: "ing-na-fim",
      slug: "pravo-iii",
    })
  })
})

describe("findPrimaryNote", () => {
  it("only takes a note linked to this subject as primary", () => {
    const secondary = { _id: "n2", linked_subjects: [{ subject_id: "sub1", is_primary: false }] }
    const other = { _id: "n3", linked_subjects: [{ subject_id: "sub2", is_primary: true }] }
    expect(findPrimaryNote([secondary, other, NOTE], "sub1")).toBe(NOTE)
    expect(findPrimaryNote([secondary, other], "sub1")).toBeNull()
  })
})

describe("ensurePracticeModule", () => {
  it("returns the existing module", async () => {
    db.getPracticeModuleBySubjectId.mockResolvedValue({ _id: "m0" })
    expect(await ensurePracticeModule(SUBJECT)).toEqual({ _id: "m0" })
    expect(db.createPracticeModule).not.toHaveBeenCalled()
  })

  it("creates one with the default address, title and primary note", async () => {
    db.getPracticeModuleBySubjectId.mockResolvedValue(null)
    db.getStudyById.mockResolvedValue({ _id: "s1", public_slug: "fim", name: "Ing." })
    db.getStudyNotesBySubjectId.mockResolvedValue([NOTE])
    await ensurePracticeModule(SUBJECT)
    expect(db.createPracticeModule).toHaveBeenCalledWith({
      subject_id: "sub1",
      study_id: "s1",
      address_prefix: "fim",
      slug: "dmo",
      title: "Diskrétní metody a optimalizace",
      flavour: "calc",
      primary_note_id: "n1",
    })
  })

  it("picks a free address when the default is taken", async () => {
    db.getPracticeModuleBySubjectId.mockResolvedValue(null)
    db.getStudyById.mockResolvedValue({ _id: "s1", public_slug: "fim" })
    db.getStudyNotesBySubjectId.mockResolvedValue([NOTE])
    db.isPracticeAddressAvailable.mockResolvedValueOnce(false).mockResolvedValue(true)
    await ensurePracticeModule(SUBJECT)
    expect(db.createPracticeModule.mock.calls[0][0].slug).toBe("dmo-2")
  })
})
