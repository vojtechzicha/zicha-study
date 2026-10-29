import type { NextRequest } from "next/server"
import { getProtectedResourceMetadata, getPublicOrigin } from "@/lib/mcp/oauth"
import { jsonResponse, preflightResponse } from "@/lib/mcp/http"

// RFC 9728 metadata for the MCP endpoint. Clients ask for both
// /.well-known/oauth-protected-resource and /.well-known/oauth-protected-resource/api/mcp.
export async function GET(request: NextRequest) {
  return jsonResponse(getProtectedResourceMetadata(getPublicOrigin(request.headers)))
}

export function OPTIONS() {
  return preflightResponse()
}
