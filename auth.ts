import NextAuth from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"

// Tenant GUID for personal Microsoft accounts. /consumers/ discovery reports this GUID as the
// issuer (so ".../consumers/v2.0" would mismatch), and /common/ rejects apps registered for
// personal accounts only.
const MS_CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: `https://login.microsoftonline.com/${MS_CONSUMER_TENANT}/v2.0`,
      authorization: {
        params: {
          scope: "openid email profile offline_access User.Read Files.Read.All Files.ReadWrite.All",
          prompt: "consent",
        },
      },
    }),
  ],
  // Preview deployments have hostnames Entra can't pre-register. With this set, Auth.js sends
  // the OAuth callback to production and forwards the session back to the preview. Use
  // "https://www.zicha.study/api/auth" (the www origin: the apex redirects, and the proxy needs
  // an exact origin match) on both Production and Preview, with a shared AUTH_SECRET. Leave it
  // unset locally. See docs/VERCEL_DEPLOYMENT.md.
  redirectProxyUrl: process.env.AUTH_REDIRECT_PROXY_URL,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    signIn({ profile }) {
      // Data isn't scoped per user, so an empty list lets any personal account read and edit everything.
      const allowedEmails = process.env.ALLOWED_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) || []
      if (allowedEmails.length === 0) return true
      const email = profile?.email?.toLowerCase()
      return !!email && allowedEmails.includes(email)
    },
    async jwt({ token, account }) {
      // First sign-in: keep the Microsoft tokens for OneDrive calls.
      if (account) {
        token.accessToken = account.access_token!
        token.refreshToken = account.refresh_token!
        token.expiresAt = account.expires_at! * 1000
        return token
      }

      // Refresh 60 s before expiry.
      if (Date.now() < (token.expiresAt as number) - 60_000) {
        return token
      }

      try {
        const params = new URLSearchParams({
          client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
          client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
          grant_type: "refresh_token",
          refresh_token: token.refreshToken as string,
          scope: "openid email profile offline_access User.Read Files.Read.All Files.ReadWrite.All",
        })

        const response = await fetch(
          `https://login.microsoftonline.com/${MS_CONSUMER_TENANT}/oauth2/v2.0/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params,
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error_description || "Token refresh failed")
        }

        token.accessToken = data.access_token
        token.refreshToken = data.refresh_token ?? token.refreshToken
        token.expiresAt = Date.now() + data.expires_in * 1000
      } catch (error) {
        console.error("Error refreshing access token:", error)
        token.error = "RefreshAccessTokenError"
      }

      return token
    },
    session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.error = token.error as string | undefined
      return session
    },
  },
})
