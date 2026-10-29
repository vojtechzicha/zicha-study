import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { McpConsent } from "@/components/mcp-consent"
import { MCP_SCOPES, getPublicOrigin, validateAuthorizeRequest } from "@/lib/mcp/oauth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Připojit Claude – Sledování studií",
  robots: { index: false },
}

// OAuth authorization endpoint for the MCP connector (see lib/mcp/oauth.ts).
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const params = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]))

  const origin = getPublicOrigin(await headers())
  const validation = await validateAuthorizeRequest(params, origin)
  if (!validation.ok) {
    if (validation.redirectTo) redirect(validation.redirectTo)
    return <McpConsent view="error" error={validation.error} />
  }

  const session = await auth()
  if (!session?.user) return <McpConsent view="sign-in" />

  const { request } = validation
  return (
    <McpConsent
      view="consent"
      params={params}
      clientName={request.clientName}
      redirectHost={new URL(request.redirectUri).host}
      email={session.user.email ?? null}
      writeRequested={request.scopes.includes(MCP_SCOPES.WRITE)}
    />
  )
}
