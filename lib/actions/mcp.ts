"use server"

import { headers } from "next/headers"
import * as db from "@/lib/mongodb/db"
import { requireUser } from "@/lib/auth-guard"
import {
  MCP_SCOPES,
  buildRedirect,
  getMcpResourceUrl,
  getPublicOrigin,
  issueAuthorizationCode,
  validateAuthorizeRequest,
} from "@/lib/mcp/oauth"

type AuthorizeParams = Record<string, string | undefined>

// The consent screen (app/oauth/authorize) posts the original query back here, so the
// request is validated again on the server rather than trusted from the page.
export async function approveMcpAuthorization(params: AuthorizeParams, allowWrite: boolean) {
  try {
    const user = await requireUser()
    const origin = getPublicOrigin(await headers())
    const validation = await validateAuthorizeRequest(params, origin)
    if (!validation.ok) return { redirectTo: validation.redirectTo, error: { message: validation.error } }

    const { request } = validation
    const scopes = allowWrite ? request.scopes : request.scopes.filter((s) => s === MCP_SCOPES.READ)
    const code = await issueAuthorizationCode(request, user, scopes)
    return {
      redirectTo: buildRedirect(request.redirectUri, { code, state: request.state, iss: origin }),
      error: null,
    }
  } catch (err: any) {
    return { redirectTo: null, error: { message: err?.message || "Nepodařilo se povolit přístup." } }
  }
}

export async function denyMcpAuthorization(params: AuthorizeParams) {
  try {
    await requireUser()
    const origin = getPublicOrigin(await headers())
    const validation = await validateAuthorizeRequest(params, origin)
    if (!validation.ok) return { redirectTo: validation.redirectTo, error: { message: validation.error } }

    const { request } = validation
    return {
      redirectTo: buildRedirect(request.redirectUri, { error: "access_denied", state: request.state, iss: origin }),
      error: null,
    }
  } catch (err: any) {
    return { redirectTo: null, error: { message: err?.message || "Neznámá chyba." } }
  }
}

export async function fetchMcpConnections() {
  try {
    await requireUser()
    const grants = await db.getActiveMcpGrants()
    return {
      mcpUrl: getMcpResourceUrl(getPublicOrigin(await headers())),
      connections: grants.map((g) => ({
        id: String(g._id),
        client_name: (g.client_name as string) || "MCP klient",
        email: (g.email as string | null) ?? null,
        can_write: ((g.scopes as string[]) || []).includes(MCP_SCOPES.WRITE),
        created_at: g.created_at as string,
        last_used_at: (g.last_used_at as string | null) ?? null,
      })),
      error: null,
    }
  } catch (err: any) {
    return { mcpUrl: null, connections: [], error: { message: err?.message || "Nepodařilo se načíst připojení." } }
  }
}

export async function revokeMcpConnection(id: string) {
  try {
    await requireUser()
    await db.revokeMcpGrant(id)
    return { error: null }
  } catch (err: any) {
    return { error: { message: err?.message || "Nepodařilo se odpojit aplikaci." } }
  }
}
