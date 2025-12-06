import { createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data?.session) {
      // Store OAuth tokens if available
      if (data.session.provider_token) {
        try {
          // Calculate token expiration (Microsoft tokens typically expire in 1 hour)
          const expiresAt = new Date(Date.now() + 3600000) // 1 hour from now

          const tokenData = {
            user_id: data.session.user.id,
            provider: 'microsoft',
            access_token: data.session.provider_token,
            refresh_token: data.session.provider_refresh_token || null,
            expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString()
          }

          // Use service client to bypass RLS
          const serviceClient = createServiceClient()
          const { error: upsertError } = await serviceClient
            .from('user_oauth_tokens')
            .upsert(tokenData, {
              onConflict: 'user_id,provider'
            })
            .select()

          if (upsertError) {
            // Log error without sensitive data - only log in development
            if (process.env.NODE_ENV === 'development') {
              console.error('OAuth token upsert error:', upsertError.message)
            }
          }
        } catch {
          // Don't fail the login if token storage fails
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}