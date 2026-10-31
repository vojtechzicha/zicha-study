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
}))
vi.mock("@/lib/mongodb/db", () => db)

import { setPracticeProgressAction } from "./practice"

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
