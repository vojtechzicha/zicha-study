import { describe, it, expect, vi, beforeEach } from "vitest"
import { UNAUTHORIZED_MESSAGE } from "@/lib/auth-guard"
import * as dbModule from "@/lib/mongodb/db"
import * as onedriveCacheModule from "@/lib/utils/onedrive-cache"
import * as diplomas from "./diplomas"
import * as examOptions from "./exam-options"
import * as examScheduler from "./exam-scheduler"
import * as finalExams from "./final-exams"
import * as logos from "./logos"
import * as markdownNotes from "./markdown-notes"
import * as materials from "./materials"
import * as onedriveCacheActions from "./onedrive-cache"
import * as studies from "./studies"
import * as studyNotes from "./study-notes"
import * as subjects from "./subjects"
import * as tasks from "./tasks"

// Server Actions are reachable without a session (POST + Next-Action header to
// any page), so every action has to check the session itself. These tests call
// every exported action signed out and assert it neither touches the database
// nor OneDrive, except for the few public-page reads, which must only return
// data of published studies.

const authMock = vi.fn()
vi.mock("@/auth", () => ({ auth: () => authMock() }))

async function autoMock(importOriginal: () => Promise<Record<string, unknown>>) {
  const actual = await importOriginal()
  return Object.fromEntries(
    Object.keys(actual).map((key) => [key, typeof actual[key] === "function" ? vi.fn() : actual[key]])
  )
}
vi.mock("@/lib/mongodb/db", async (importOriginal) => autoMock(importOriginal as any))
vi.mock("@/lib/utils/onedrive-cache", async (importOriginal) => autoMock(importOriginal as any))

const db = dbModule as unknown as Record<string, ReturnType<typeof vi.fn>>
const onedriveCache = onedriveCacheModule as unknown as Record<string, ReturnType<typeof vi.fn>>

const ACTION_MODULES: Record<string, Record<string, unknown>> = {
  diplomas,
  "exam-options": examOptions,
  "exam-scheduler": examScheduler,
  "final-exams": finalExams,
  logos,
  "markdown-notes": markdownNotes,
  materials,
  "onedrive-cache": onedriveCacheActions,
  studies,
  "study-notes": studyNotes,
  subjects,
  tasks,
}

// Actions the public study page (app/[slug]) calls signed out.
const PUBLIC_ACTIONS = new Set([
  "materials.fetchPublicMaterials",
  "study-notes.fetchStudyNotes",
  "subjects.fetchSubjectsByIds",
  "final-exams.fetchFinalExams",
  "final-exams.fetchFinalExamsByIds",
  "final-exams.fetchFinalExamIdsWithNotes",
])

const ALL_ACTIONS = Object.entries(ACTION_MODULES).flatMap(([moduleName, mod]) =>
  Object.entries(mod)
    .filter(([, value]) => typeof value === "function")
    .map(([name, fn]) => ({ id: `${moduleName}.${name}`, fn: fn as (..._args: unknown[]) => Promise<unknown> }))
)

const DUMMY_ARGS = ["some-id", { field: "value" }, "image/png", "name"]

function expectNoBackendCalls() {
  for (const mock of [...Object.values(db), ...Object.values(onedriveCache)]) {
    if (typeof mock === "function" && "mock" in mock) {
      expect(mock).not.toHaveBeenCalled()
    }
  }
}

function isUnauthorizedResult(result: unknown): boolean {
  if (!result || typeof result !== "object") return false
  const error = (result as { error?: unknown }).error
  if (error === UNAUTHORIZED_MESSAGE) return true
  return !!error && typeof error === "object" && (error as { message?: unknown }).message === UNAUTHORIZED_MESSAGE
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(null)
  // Some actions log the rejection before returning their `{ error }` shape.
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("private actions reject anonymous callers", () => {
  const privateActions = ALL_ACTIONS.filter((a) => !PUBLIC_ACTIONS.has(a.id))

  it("covers the action modules", () => {
    expect(privateActions.length).toBeGreaterThan(80)
  })

  it.each(privateActions.map((a) => [a.id, a.fn] as const))("%s", async (_id, fn) => {
    let result: unknown
    let thrown: unknown
    try {
      result = await fn(...DUMMY_ARGS)
    } catch (err) {
      thrown = err
    }

    if (thrown) {
      expect((thrown as Error).message).toBe(UNAUTHORIZED_MESSAGE)
    } else {
      expect(isUnauthorizedResult(result)).toBe(true)
    }
    expectNoBackendCalls()
  })

  it("lets a signed-in user through", async () => {
    authMock.mockResolvedValue({ user: { email: "owner@example.com", name: "Owner" } })
    db.getStudies.mockResolvedValue([])
    db.normalizeIds.mockReturnValue([])
    const { fetchStudies } = ACTION_MODULES.studies as { fetchStudies: () => Promise<unknown> }
    await expect(fetchStudies()).resolves.toEqual([])
    expect(db.getStudies).toHaveBeenCalled()
  })
})

describe("public actions only expose published data to anonymous callers", () => {
  const actions = Object.fromEntries(ALL_ACTIONS.map((a) => [a.id, a.fn]))

  beforeEach(() => {
    db.normalizeIds.mockImplementation((docs: Array<Record<string, unknown>>) =>
      docs.map(({ _id, ...rest }) => ({ id: _id, ...rest }))
    )
    db.getPublicStudyIds.mockImplementation(async (ids: string[]) => new Set(ids.filter((id) => id === "public")))
  })

  it("fetchPublicMaterials returns nothing for an unpublished study", async () => {
    db.getPublicMaterialsByStudyId.mockResolvedValue([{ _id: "m1", study_id: "private" }])
    await expect(actions["materials.fetchPublicMaterials"]("private")).resolves.toEqual([])
    expect(db.getPublicMaterialsByStudyId).not.toHaveBeenCalled()
  })

  it("fetchPublicMaterials returns public materials of a published study", async () => {
    db.getPublicMaterialsByStudyId.mockResolvedValue([{ _id: "m1", study_id: "public" }])
    await expect(actions["materials.fetchPublicMaterials"]("public")).resolves.toEqual([
      { id: "m1", study_id: "public" },
    ])
  })

  it("fetchStudyNotes forces publicOnly for anonymous callers", async () => {
    db.getStudyNotesByStudyId.mockResolvedValue([])
    await actions["study-notes.fetchStudyNotes"]("public", false)
    expect(db.getStudyNotesByStudyId).toHaveBeenCalledWith("public", true)
  })

  it("fetchStudyNotes returns nothing for an unpublished study", async () => {
    await expect(actions["study-notes.fetchStudyNotes"]("private", true)).resolves.toEqual([])
    expect(db.getStudyNotesByStudyId).not.toHaveBeenCalled()
  })

  it("fetchSubjectsByIds drops subjects of unpublished studies", async () => {
    db.getSubjectsByIds.mockResolvedValue([
      { _id: "s1", study_id: "public" },
      { _id: "s2", study_id: "private" },
    ])
    await expect(actions["subjects.fetchSubjectsByIds"](["s1", "s2"])).resolves.toEqual([
      { id: "s1", study_id: "public" },
    ])
  })

  it("fetchFinalExams returns nothing for an unpublished study", async () => {
    await expect(actions["final-exams.fetchFinalExams"]("private")).resolves.toEqual([])
    expect(db.getFinalExamsByStudyId).not.toHaveBeenCalled()
  })

  it("fetchFinalExamsByIds drops exams of unpublished studies", async () => {
    db.getFinalExamsByIds.mockResolvedValue([
      { _id: "e1", study_id: "public" },
      { _id: "e2", study_id: "private" },
    ])
    await expect(actions["final-exams.fetchFinalExamsByIds"](["e1", "e2"])).resolves.toEqual([
      { id: "e1", study_id: "public" },
    ])
  })

  it("fetchFinalExamIdsWithNotes only counts public notes for anonymous callers", async () => {
    db.getFinalExamIdsWithNotes.mockResolvedValue(new Set(["e1"]))
    await expect(actions["final-exams.fetchFinalExamIdsWithNotes"](["e1"])).resolves.toEqual(["e1"])
    expect(db.getFinalExamIdsWithNotes).toHaveBeenCalledWith(["e1"], true)
  })
})
