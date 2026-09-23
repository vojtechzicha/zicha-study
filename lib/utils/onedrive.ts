import { auth } from "@/auth"

/**
 * Get the current OneDrive access token from the NextAuth session.
 * For use in server-side contexts (API routes, server components).
 */
export async function getOneDriveToken(): Promise<string> {
  const session = await auth()
  if (!session?.accessToken) {
    throw new Error("Chybí platný přístupový token k OneDrive.")
  }
  if (session.error === "RefreshAccessTokenError") {
    throw new Error("Přístupový token k OneDrive vypršel a nepodařilo se ho obnovit.")
  }
  return session.accessToken
}

/**
 * Make an authenticated request to the Microsoft Graph API.
 * Throws when there is no usable token (missing or failed refresh).
 */
export async function makeGraphRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getOneDriveToken()

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  return response
}
