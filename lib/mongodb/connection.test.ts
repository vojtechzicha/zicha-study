import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const connect = vi.fn()
const close = vi.fn(() => Promise.resolve())
const db = vi.fn((name: string) => ({ databaseName: name }))
const constructed: unknown[] = []

vi.mock("mongodb", () => ({
  MongoClient: class {
    constructor(_uri: string, options: unknown) {
      constructed.push(options)
    }
    connect = () => connect().then(() => this)
    close = close
    db = db
  },
}))

const attachDatabasePool = vi.fn()
vi.mock("@vercel/functions", () => ({ attachDatabasePool }))

const globalWithMongo = globalThis as typeof globalThis & { _mongoClientPromise?: unknown }

describe("getDb", () => {
  beforeEach(() => {
    vi.resetModules()
    connect.mockReset()
    close.mockClear()
    attachDatabasePool.mockClear()
    constructed.length = 0
    delete globalWithMongo._mongoClientPromise
    process.env.MONGODB_URI = "mongodb://example.test"
    delete process.env.MONGODB_DB
  })

  afterEach(() => {
    delete globalWithMongo._mongoClientPromise
  })

  it("reuses one client and attaches its pool", async () => {
    connect.mockResolvedValue(undefined)
    const { getDb } = await import("./connection")

    await getDb()
    await getDb()

    expect(constructed).toHaveLength(1)
    expect(constructed[0]).toMatchObject({ serverSelectionTimeoutMS: 8000, maxIdleTimeMS: 5000 })
    expect(attachDatabasePool).toHaveBeenCalledTimes(1)
    expect(db).toHaveBeenLastCalledWith("zicha-study")
  })

  it("does not cache a failed connect", async () => {
    connect.mockRejectedValueOnce(new Error("unreachable")).mockResolvedValue(undefined)
    const { getDb } = await import("./connection")

    await expect(getDb()).rejects.toThrow("unreachable")
    expect(close).toHaveBeenCalledTimes(1)

    await expect(getDb()).resolves.toBeDefined()
    expect(constructed).toHaveLength(2)
  })

  it("uses MONGODB_DB when set", async () => {
    connect.mockResolvedValue(undefined)
    process.env.MONGODB_DB = "zicha-study-preview"
    const { getDb } = await import("./connection")

    await getDb()

    expect(db).toHaveBeenLastCalledWith("zicha-study-preview")
  })
})
