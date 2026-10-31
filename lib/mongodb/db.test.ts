import { describe, it, expect, vi, beforeEach } from "vitest"

// Records the calls each collection receives, so cascades can be checked without MongoDB.
const calls = vi.hoisted(() => [] as { collection: string; method: string; args: unknown[] }[])

vi.mock("./connection", () => {
  const collection = (name: string) =>
    new Proxy(
      {},
      {
        get: (_target, method: string) =>
          async (...args: unknown[]) => {
            calls.push({ collection: name, method, args })
            return method === "findOne" ? null : { acknowledged: true }
          },
      }
    )
  return { getDb: async () => ({ collection }) }
})

import { deleteFinalExam, deleteSubject } from "./db"

function callsOn(collection: string, method: string) {
  return calls.filter((c) => c.collection === collection && c.method === method)
}

beforeEach(() => {
  calls.length = 0
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
