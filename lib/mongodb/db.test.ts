import { describe, it, expect, vi, beforeEach } from "vitest"

// Records the calls each collection receives, so cascades can be checked without MongoDB.
// find() returns the documents seeded for that collection (filters are not evaluated).
const fake = vi.hoisted(() => ({
  calls: [] as { collection: string; method: string; args: unknown[] }[],
  seed: {} as Record<string, Record<string, unknown>[]>,
}))

vi.mock("./connection", () => {
  const collection = (name: string) =>
    new Proxy(
      {},
      {
        get: (_target, method: string) =>
          (...args: unknown[]) => {
            fake.calls.push({ collection: name, method, args })
            if (method === "find") return { toArray: async () => fake.seed[name] ?? [] }
            if (method === "findOne") return Promise.resolve(fake.seed[name]?.[0] ?? null)
            if (method === "countDocuments") return Promise.resolve((fake.seed[name] ?? []).length)
            return Promise.resolve({ acknowledged: true, matchedCount: 1 })
          },
      }
    )
  return { getDb: async () => ({ collection }) }
})

import {
  checkMaterialSlugAvailability,
  checkNoteSlugGlobalAvailability,
  checkStudyNoteSlugAvailability,
  checkSubjectMaterialSlugAvailability,
  deleteFinalExam,
  deleteStudy,
  deleteStudyNote,
  deleteSubject,
  revokeMcpGrant,
  updatePracticePageMeta,
} from "./db"

function callsOn(collection: string, method: string) {
  return fake.calls.filter((c) => c.collection === collection && c.method === method)
}

beforeEach(() => {
  fake.calls.length = 0
  fake.seed = {}
})

describe("deleteSubject", () => {
  it("removes the subject's links from notes", async () => {
    await deleteSubject("sub1")
    expect(callsOn("study_notes", "updateMany")).toEqual([
      {
        collection: "study_notes",
        method: "updateMany",
        args: [{ "linked_subjects.subject_id": "sub1" }, { $pull: { linked_subjects: { subject_id: "sub1" } } }],
      },
    ])
    expect(callsOn("subjects", "deleteOne")).toHaveLength(1)
  })

  it("deletes the subject's practice module with its pages, versions, progress and upload tokens", async () => {
    fake.seed.practice_modules = [{ _id: "m1" }]
    fake.seed.practice_pages = [{ _id: "pg1" }, { _id: "pg2" }]
    await deleteSubject("sub1")
    expect(callsOn("practice_modules", "find")[0].args[0]).toEqual({ subject_id: "sub1" })
    expect(callsOn("practice_page_versions", "deleteMany")[0].args[0]).toEqual({ page_id: { $in: ["pg1", "pg2"] } })
    expect(callsOn("practice_progress", "deleteMany")[0].args[0]).toEqual({ module_id: { $in: ["m1"] } })
    expect(callsOn("practice_upload_tokens", "deleteMany")[0].args[0]).toEqual({ module_id: { $in: ["m1"] } })
    expect(callsOn("practice_pages", "deleteMany")[0].args[0]).toEqual({ module_id: { $in: ["m1"] } })
    expect(callsOn("practice_modules", "deleteMany")[0].args[0]).toEqual({ _id: { $in: ["m1"] } })
  })

  it("leaves the practice collections alone when the subject has no module", async () => {
    await deleteSubject("sub1")
    expect(callsOn("practice_pages", "deleteMany")).toHaveLength(0)
  })
})

describe("deleteStudy", () => {
  it("deletes the study's practice data", async () => {
    fake.seed.practice_modules = [{ _id: "m1" }]
    await deleteStudy("s1")
    expect(callsOn("practice_modules", "find").some((c) => JSON.stringify(c.args[0]) === '{"study_id":"s1"}')).toBe(true)
    expect(callsOn("practice_pages", "deleteMany")[0].args[0]).toEqual({ module_id: { $in: ["m1"] } })
  })
})

describe("deleteStudyNote", () => {
  it("clears the note as a practice module's primary note", async () => {
    await deleteStudyNote("n1")
    expect(callsOn("practice_modules", "updateMany")[0].args).toEqual([
      { primary_note_id: "n1" },
      { $set: { primary_note_id: null } },
    ])
  })
})

describe("revokeMcpGrant", () => {
  it("revokes the practice upload tokens issued through the connection", async () => {
    await revokeMcpGrant("g1")
    const [filter, update] = callsOn("practice_upload_tokens", "updateMany")[0].args as any[]
    expect(filter).toEqual({ grant_id: "g1", revoked_at: null })
    expect(update.$set.revoked_at).toBeInstanceOf(Date)
  })
})

describe("deleteFinalExam", () => {
  it("removes the final exam's links from notes", async () => {
    await deleteFinalExam("fe1")
    expect(callsOn("study_notes", "updateMany")).toEqual([
      {
        collection: "study_notes",
        method: "updateMany",
        args: [
          { "linked_final_exams.final_exam_id": "fe1" },
          { $pull: { linked_final_exams: { final_exam_id: "fe1" } } },
        ],
      },
    ])
    expect(callsOn("final_exams", "deleteOne")).toHaveLength(1)
  })
})

describe("updatePracticePageMeta", () => {
  it("clears the content hash when the title changes, so the next upload restores it", async () => {
    await updatePracticePageMeta("pg1", { title: "Nový název" })
    const [filter, update] = callsOn("practice_pages", "updateOne")[0].args as any[]
    expect(filter).toEqual({ _id: "pg1" })
    expect(update.$set).toMatchObject({ title: "Nový název", content_hash: null })
  })

  it("keeps the hash for description and address changes", async () => {
    await updatePracticePageMeta("pg1", { desc: "Popis", slug: "bfs2" })
    const [, update] = callsOn("practice_pages", "updateOne")[0].args as any[]
    expect(update.$set).not.toHaveProperty("content_hash")
  })
})

describe("reserved addresses", () => {
  it("are never available for materials or notes", async () => {
    expect(await checkMaterialSlugAvailability("s1", "procvicovani")).toBe(false)
    expect(await checkSubjectMaterialSlugAvailability("s1", "Procvicovani")).toBe(false)
    expect(await checkStudyNoteSlugAvailability("procvicovani", "s1")).toBe(false)
    expect(await checkNoteSlugGlobalAvailability("procvicovani")).toBe(false)
    expect(fake.calls).toHaveLength(0)
  })

  it("don't affect other addresses", async () => {
    expect(await checkMaterialSlugAvailability("s1", "procvicovani-2")).toBe(true)
  })
})
