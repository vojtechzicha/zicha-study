import type { NextRequest } from "next/server"
import { getAuthorizationServerMetadata, getPublicOrigin } from "@/lib/mcp/oauth"
import { jsonResponse, preflightResponse } from "@/lib/mcp/http"

// RFC 8414 metadata of the authorization server behind the MCP endpoint.
export async function GET(request: NextRequest) {
  return jsonResponse(getAuthorizationServerMetadata(getPublicOrigin(request.headers)))
}

export function OPTIONS() {
  return preflightResponse()
}
