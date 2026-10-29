import crypto from "crypto"

// In-memory stand-in for the MCP part of lib/mongodb/db.ts, so the OAuth flow and the
// MCP endpoint can be tested end to end without MongoDB.

type Doc = Record<string, any>

const collections = new Map<string, Map<string, Doc>>()

function col(name: string) {
  if (!collections.has(name)) collections.set(name, new Map())
  return collections.get(name)!
}

export function resetFakeDb() {
  collections.clear()
}

export function fakeCollection(name: string) {
  return [...col(name).values()]
}

export const fakeMcpDb = {
  createMcpClient: async (data: Doc) => {
    const doc = { _id: crypto.randomUUID(), ...data }
    col("mcp_clients").set(doc._id, doc)
    return doc
  },
  getMcpClient: async (id: string) => col("mcp_clients").get(id) ?? null,
  createMcpAuthCode: async (hash: string, data: Doc) => {
    col("mcp_auth_codes").set(hash, { _id: hash, ...data })
  },
  consumeMcpAuthCode: async (hash: string) => {
    const doc = col("mcp_auth_codes").get(hash) ?? null
    col("mcp_auth_codes").delete(hash)
    return doc
  },
  createMcpGrant: async (data: Doc) => {
    const doc = { _id: crypto.randomUUID(), ...data, revoked_at: null, last_used_at: null, created_at: new Date().toISOString() }
    col("mcp_grants").set(doc._id, doc)
    return doc
  },
  getMcpGrant: async (id: string) => col("mcp_grants").get(id) ?? null,
  getActiveMcpGrants: async () => fakeCollection("mcp_grants").filter((g) => !g.revoked_at),
  touchMcpGrant: async (id: string) => {
    const grant = col("mcp_grants").get(id)
    if (grant) grant.last_used_at = new Date().toISOString()
  },
  revokeMcpGrant: async (id: string) => {
    const grant = col("mcp_grants").get(id)
    if (grant && !grant.revoked_at) grant.revoked_at = new Date().toISOString()
    for (const [hash, token] of col("mcp_tokens")) {
      if (token.grant_id === id) col("mcp_tokens").delete(hash)
    }
  },
  insertMcpToken: async (hash: string, data: Doc) => {
    col("mcp_tokens").set(hash, { _id: hash, ...data, used_at: null })
  },
  getMcpToken: async (hash: string) => col("mcp_tokens").get(hash) ?? null,
  claimMcpRefreshToken: async (hash: string) => {
    const token = col("mcp_tokens").get(hash)
    if (!token || token.kind !== "refresh" || token.used_at) return null
    token.used_at = new Date().toISOString()
    return { ...token }
  },
  deleteMcpToken: async (hash: string) => {
    col("mcp_tokens").delete(hash)
  },
  insertMcpAuditEntry: async (data: Doc) => {
    const doc = { _id: crypto.randomUUID(), ...data, at: new Date().toISOString() }
    col("mcp_audit").set(doc._id, doc)
  },
  getMcpAuditEntries: async (limit: number) => fakeCollection("mcp_audit").reverse().slice(0, limit),
}

export function pkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url")
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url")
  return { verifier, challenge }
}
