import type { NextRequest } from "next/server"
import {
  OAuthError,
  authenticateClient,
  exchangeAuthorizationCode,
  getPublicOrigin,
  refreshAccessToken,
} from "@/lib/mcp/oauth"
import { clientIp, jsonResponse, oauthErrorResponse, preflightResponse, readFormParams } from "@/lib/mcp/http"
import { checkRateLimit } from "@/lib/utils/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const limit = checkRateLimit(`mcp-token:${clientIp(request)}`, { limit: 60, windowMs: 60 * 1000 })
    if (!limit.success) throw new OAuthError("temporarily_unavailable", "Too many requests.", 429)

    const params = await readFormParams(request)
    const client = await authenticateClient(params, request.headers.get("authorization"))

    switch (params.get("grant_type")) {
      case "authorization_code":
        return jsonResponse(await exchangeAuthorizationCode(params, client, getPublicOrigin(request.headers)))
      case "refresh_token":
        return jsonResponse(await refreshAccessToken(params, client))
      default:
        throw new OAuthError("unsupported_grant_type", "Use authorization_code or refresh_token.")
    }
  } catch (err) {
    return oauthErrorResponse(err)
  }
}

export function OPTIONS() {
  return preflightResponse()
}
