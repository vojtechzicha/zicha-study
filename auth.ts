import NextAuth from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"

// Microsoft's well-known tenant GUID for personal accounts (outlook.com, hotmail.com, live.com).
// Using the GUID directly because:
//   - /consumers/ discovery returns this GUID as issuer, causing mismatch if we set issuer to ".../consumers/v2.0"
//   - /common/ endpoint rejects apps registered with "Personal Microsoft accounts only"
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
  session: {
    strategy: "jwt",
  },
  callbacks: {
    signIn({ profile }) {
      const allowedEmails = process.env.ALLOWED_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) || []
      if (allowedEmails.length === 0) return true
      const email = profile?.email?.toLowerCase()
      return !!email && allowedEmails.includes(email)
    },
    async jwt({ token, account }) {
      // On initial sign in, persist the OAuth tokens
      if (account) {
        token.accessToken = account.access_token!
        token.refreshToken = account.refresh_token!
        token.expiresAt = account.expires_at! * 1000 // Convert to ms
        return token
      }

      // If token hasn't expired, return it as-is
      if (Date.now() < (token.expiresAt as number) - 60_000) {
        return token
      }

      // Token is expired or about to expire, refresh it
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
