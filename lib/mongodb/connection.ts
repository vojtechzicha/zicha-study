import { MongoClient, type Db } from "mongodb"

interface MongoClientCache {
  client: MongoClient | null
  promise: Promise<MongoClient> | null
}

// Use globalThis to persist across HMR in development
const globalWithMongo = globalThis as typeof globalThis & {
  _mongoClientCache?: MongoClientCache
}

if (!globalWithMongo._mongoClientCache) {
  globalWithMongo._mongoClientCache = { client: null, promise: null }
}

const cache = globalWithMongo._mongoClientCache

async function getClient(): Promise<MongoClient> {
  if (cache.client) {
    return cache.client
  }

  if (!cache.promise) {
    const uri = process.env.MONGODB_URI
    if (!uri) {
      throw new Error("MONGODB_URI environment variable is not set")
    }
    cache.promise = MongoClient.connect(uri).then((client) => {
      cache.client = client
      return client
    })
  }

  return cache.promise
}

export async function getDb(): Promise<Db> {
  const client = await getClient()
  const dbName = process.env.MONGODB_DB || "zicha-study"
  return client.db(dbName)
}
