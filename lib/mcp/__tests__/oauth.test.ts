import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fakeCollection, fakeMcpDb, pkcePair, resetFakeDb } from "./fake-db"

vi.mock("@/lib/mongodb/db", () => fakeMcpDb)

import {
  MCP_SCOPES,
  OAuthError,
  authenticateClient,
  exchangeAuthorizationCode,
  isAllowedRedirectUri,
  issueAuthorizationCode,
  parseScopes,
  refreshAccessToken,
  registerClient,
  revokeToken,
  validateAuthorizeRequest,
  verifyAccessToken,
  verifyPkce,
} from "@/lib/mcp/oauth"

const ORIGIN = "https://www.zicha.study"
const REDIRECT = "https://claude.ai/api/mcp/auth_callback"
const USER = { email: "owner@example.com", name: "Owner" }

async function registerPublicClient() {
  return registerClient({ client_name: "Claude", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none" })
}

// Runs the whole flow up to the first token pair.
async function authorize(scope = "study:read study:write") {
  const client = await registerPublicClient()
  const { verifier, challenge } = pkcePair()
  const validation = await validateAuthorizeRequest(
    {
      client_id: client.client_id,
      redirect_uri: REDIRECT,
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "xyz",
      scope,
      resource: `${ORIGIN}/api/mcp`,
    },
    ORIGIN
  )
  if (!validation.ok) throw new Error(validation.error)
  const code = await issueAuthorizationCode(validation.request, USER, validation.request.scopes)
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: client.client_id,
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT,
  })
  const storedClient = await fakeMcpDb.getMcpClient(client.client_id)
  const tokens = await exchangeAuthorizationCode(params, storedClient!, ORIGIN)
  return { client, storedClient: storedClient!, tokens, code, verifier }
}

beforeEach(() => {
  resetFakeDb()
  vi.stubEnv("ALLOWED_EMAILS", "owner@example.com")
  vi.stubEnv("MCP_EXTRA_REDIRECT_URIS", "")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("primitives", () => {
  it("verifies S256 PKCE", () => {
    const { verifier, challenge } = pkcePair()
    expect(verifyPkce(verifier, challenge)).toBe(true)
    expect(verifyPkce(pkcePair().verifier, challenge)).toBe(false)
    expect(verifyPkce("short", challenge)).toBe(false)
  })

  it("allows Claude's callbacks and loopback redirects only", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true)
    expect(isAllowedRedirectUri("https://claude.com/api/mcp/auth_callback")).toBe(true)
    expect(isAllowedRedirectUri("http://localhost:53682/callback")).toBe(true)
    expect(isAllowedRedirectUri("http://127.0.0.1:8080/cb")).toBe(true)
    expect(isAllowedRedirectUri("https://evil.example/api/mcp/auth_callback")).toBe(false)
    expect(isAllowedRedirectUri("https://claude.ai/other")).toBe(false)
    expect(isAllowedRedirectUri("http://localhost.evil.example/cb")).toBe(false)
    expect(isAllowedRedirectUri("not a url")).toBe(false)
  })

  it("accepts extra redirect URIs from the environment", () => {
    vi.stubEnv("MCP_EXTRA_REDIRECT_URIS", "https://inspector.example/cb")
    expect(isAllowedRedirectUri("https://inspector.example/cb")).toBe(true)
  })

  it("parses scopes, adds read to write and rejects unknown ones", () => {
    expect(parseScopes("")).toEqual([MCP_SCOPES.READ, MCP_SCOPES.WRITE])
    expect(parseScopes("study:write")).toEqual([MCP_SCOPES.READ, MCP_SCOPES.WRITE])
    expect(parseScopes("study:read")).toEqual([MCP_SCOPES.READ])
    expect(() => parseScopes("admin")).toThrow(OAuthError)
  })
})

describe("client registration", () => {
  it("rejects redirect URIs outside the allowlist", async () => {
    await expect(registerClient({ redirect_uris: ["https://evil.example/cb"] })).rejects.toMatchObject({
      code: "invalid_redirect_uri",
    })
    await expect(registerClient({})).rejects.toMatchObject({ code: "invalid_redirect_uri" })
  })

  it("issues a secret to confidential clients and checks it", async () => {
    const client = await registerClient({ redirect_uris: [REDIRECT], token_endpoint_auth_method: "client_secret_post" })
    expect(client.client_secret).toMatch(/^zs_cs_/)
    const params = new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret! })
    await expect(authenticateClient(params, null)).resolves.toBeTruthy()

    const basic = `Basic ${Buffer.from(`${client.client_id}:${client.client_secret}`).toString("base64")}`
    await expect(authenticateClient(new URLSearchParams(), basic)).resolves.toBeTruthy()

    params.set("client_secret", "wrong")
    await expect(authenticateClient(params, null)).rejects.toMatchObject({ code: "invalid_client" })
  })

  it("never stores the client secret in plain text", async () => {
    const client = await registerClient({ redirect_uris: [REDIRECT], token_endpoint_auth_method: "client_secret_basic" })
    expect(JSON.stringify(fakeCollection("mcp_clients"))).not.toContain(client.client_secret)
  })
})

describe("authorization request", () => {
  it("does not redirect to an unregistered redirect URI", async () => {
    const client = await registerPublicClient()
    const result = await validateAuthorizeRequest(
      { client_id: client.client_id, redirect_uri: "http://localhost:1/cb", response_type: "code" },
      ORIGIN
    )
    expect(result).toMatchObject({ ok: false, redirectTo: null })
  })

  it("redirects protocol errors back to the client with state", async () => {
    const client = await registerPublicClient()
    const result = await validateAuthorizeRequest(
      { client_id: client.client_id, redirect_uri: REDIRECT, response_type: "code", state: "abc" },
      ORIGIN
    )
    expect(result.ok).toBe(false)
    const url = new URL((result as { redirectTo: string }).redirectTo)
    expect(url.searchParams.get("error")).toBe("invalid_request")
    expect(url.searchParams.get("state")).toBe("abc")
  })

  it("rejects a token for another resource", async () => {
    const client = await registerPublicClient()
    const result = await validateAuthorizeRequest(
      {
        client_id: client.client_id,
        redirect_uri: REDIRECT,
        response_type: "code",
        code_challenge: pkcePair().challenge,
        code_challenge_method: "S256",
        resource: "https://elsewhere.example/mcp",
      },
      ORIGIN
    )
    expect(new URL((result as { redirectTo: string }).redirectTo).searchParams.get("error")).toBe("invalid_target")
  })
})

describe("tokens", () => {
  it("exchanges a code once and verifies the access token", async () => {
    const { tokens, code, verifier, client, storedClient } = await authorize()
    expect(tokens.token_type).toBe("Bearer")
    expect(tokens.scope).toBe("study:read study:write")

    const auth = await verifyAccessToken(tokens.access_token, ORIGIN)
    expect(auth).toMatchObject({ email: USER.email, clientName: "Claude", scopes: ["study:read", "study:write"] })

    const replay = new URLSearchParams({ grant_type: "authorization_code", client_id: client.client_id, code, code_verifier: verifier })
    await expect(exchangeAuthorizationCode(replay, storedClient, ORIGIN)).rejects.toMatchObject({ code: "invalid_grant" })
  })

  it("stores only token hashes", async () => {
    const { tokens } = await authorize()
    const stored = JSON.stringify(fakeCollection("mcp_tokens"))
    expect(stored).not.toContain(tokens.access_token)
    expect(stored).not.toContain(tokens.refresh_token)
  })

  it("rejects a wrong PKCE verifier", async () => {
    const client = await registerPublicClient()
    const { challenge } = pkcePair()
    const validation = await validateAuthorizeRequest(
      { client_id: client.client_id, redirect_uri: REDIRECT, response_type: "code", code_challenge: challenge, code_challenge_method: "S256" },
      ORIGIN
    )
    if (!validation.ok) throw new Error(validation.error)
    const code = await issueAuthorizationCode(validation.request, USER, validation.request.scopes)
    const params = new URLSearchParams({ code, code_verifier: pkcePair().verifier })
    await expect(
      exchangeAuthorizationCode(params, (await fakeMcpDb.getMcpClient(client.client_id))!, ORIGIN)
    ).rejects.toMatchObject({ code: "invalid_grant" })
  })

  it("rotates refresh tokens and revokes the grant when one is reused", async () => {
    const { tokens, storedClient } = await authorize()
    const first = new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token })
    const rotated = await refreshAccessToken(first, storedClient)
    expect(rotated.refresh_token).not.toBe(tokens.refresh_token)
    expect(await verifyAccessToken(rotated.access_token, ORIGIN)).not.toBeNull()

    await expect(refreshAccessToken(first, storedClient)).rejects.toMatchObject({ code: "invalid_grant" })
    expect(await verifyAccessToken(rotated.access_token, ORIGIN)).toBeNull()
    const second = new URLSearchParams({ grant_type: "refresh_token", refresh_token: rotated.refresh_token })
    await expect(refreshAccessToken(second, storedClient)).rejects.toMatchObject({ code: "invalid_grant" })
  })

  it("lets a refresh narrow but not widen scopes", async () => {
    const { tokens, storedClient } = await authorize("study:read")
    const widen = new URLSearchParams({ refresh_token: tokens.refresh_token, scope: "study:write" })
    await expect(refreshAccessToken(widen, storedClient)).rejects.toMatchObject({ code: "invalid_scope" })
  })

  it("stops accepting tokens after the grant is revoked or the email is no longer allowed", async () => {
    const { tokens, storedClient } = await authorize()
    vi.stubEnv("ALLOWED_EMAILS", "someone-else@example.com")
    expect(await verifyAccessToken(tokens.access_token, ORIGIN)).toBeNull()
    vi.stubEnv("ALLOWED_EMAILS", "owner@example.com")
    expect(await verifyAccessToken(tokens.access_token, ORIGIN)).not.toBeNull()

    await revokeToken(new URLSearchParams({ token: tokens.refresh_token }), storedClient)
    expect(await verifyAccessToken(tokens.access_token, ORIGIN)).toBeNull()
  })

  it("rejects tokens issued for another origin", async () => {
    const { tokens } = await authorize()
    expect(await verifyAccessToken(tokens.access_token, "https://preview.vercel.app")).toBeNull()
  })

  it("rejects expired access tokens", async () => {
    const { tokens } = await authorize()
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000)
    try {
      expect(await verifyAccessToken(tokens.access_token, ORIGIN)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
