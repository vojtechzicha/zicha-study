import type { NextRequest } from "next/server"
import { OAuthError, registerClient } from "@/lib/mcp/oauth"
import { clientIp, jsonResponse, oauthErrorResponse, preflightResponse } from "@/lib/mcp/http"
import { checkRateLimit } from "@/lib/utils/rate-limit"

// Dynamic client registration (RFC 7591). Open by design: a registered client can do
// nothing until a signed-in user approves it on /oauth/authorize.
export async function POST(request: NextRequest) {
  try {
    const limit = checkRateLimit(`mcp-register:${clientIp(request)}`, { limit: 20, windowMs: 60 * 60 * 1000 })
    if (!limit.success) throw new OAuthError("temporarily_unavailable", "Too many registrations.", 429)

    let metadata: Record<string, unknown>
    try {
      metadata = await request.json()
    } catch {
      throw new OAuthError("invalid_client_metadata", "Body must be JSON.")
    }
    if (!metadata || typeof metadata !== "object") {
      throw new OAuthError("invalid_client_metadata", "Body must be a JSON object.")
    }

    return jsonResponse(await registerClient(metadata), 201)
  } catch (err) {
    return oauthErrorResponse(err)
  }
}

export function OPTIONS() {
  return preflightResponse()
}
