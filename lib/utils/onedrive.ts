import { auth } from "@/auth"

/**
 * Get the current OneDrive access token from the NextAuth session.
 * For use in server-side contexts (API routes, server components).
 */
export async function getOneDriveToken(): Promise<string> {
  const session = await auth()
  if (!session?.accessToken) {
    throw new Error("No valid OneDrive access token available")
  }
  if (session.error === "RefreshAccessTokenError") {
    throw new Error("Access token expired and refresh failed")
  }
  return session.accessToken
}

/**
 * Make an authenticated request to the Microsoft Graph API.
 * Throws on missing token.
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
