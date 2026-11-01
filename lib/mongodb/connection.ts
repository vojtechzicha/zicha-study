import { attachDatabasePool } from "@vercel/functions"
import { MongoClient, type Db } from "mongodb"

// Cached on globalThis so warm Fluid instances and dev HMR reuse one client
// instead of opening new connections.
const globalWithMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>
}

function getClient(): Promise<MongoClient> {
  if (globalWithMongo._mongoClientPromise) {
    return globalWithMongo._mongoClientPromise
  }

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set")
  }

  const client = new MongoClient(uri, {
    // Fail fast on an unreachable cluster. The driver's default 30 s wait would
    // run into the function time limit and hide the config error.
    serverSelectionTimeoutMS: 8000,
    // Close idle sockets so a suspended instance doesn't hold Atlas
    // connection slots (M0 allows 500). attachDatabasePool reads this value.
    maxIdleTimeMS: 5000,
  })
  // On Vercel Fluid compute, keeps the instance alive just long enough for
  // idle connections to close before it is suspended. No-op elsewhere.
  attachDatabasePool(client)

  const promise = client.connect().catch((error: unknown) => {
    // Don't cache a failed connect, or a transient outage lasts until the next
    // cold start.
    if (globalWithMongo._mongoClientPromise === promise) {
      globalWithMongo._mongoClientPromise = undefined
    }
    void client.close().catch(() => {})
    throw error
  })
  globalWithMongo._mongoClientPromise = promise
  return promise
}

export async function getDb(): Promise<Db> {
  const client = await getClient()
  const dbName = process.env.MONGODB_DB || "zicha-study"
  return client.db(dbName)
}
