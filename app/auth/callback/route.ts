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
      // Debug: Log what's available in the session
      console.log('OAuth callback - Session keys:', Object.keys(data.session))
      console.log('OAuth callback - Has provider_token:', !!data.session.provider_token)
      console.log('OAuth callback - Has provider_refresh_token:', !!data.session.provider_refresh_token)
      
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
          
          console.log('OAuth callback - Storing tokens:', {
            hasAccessToken: !!tokenData.access_token,
            hasRefreshToken: !!tokenData.refresh_token
          })
          
          // Use service client to bypass RLS
          const serviceClient = createServiceClient()
          const { data: upsertData, error: upsertError } = await serviceClient
            .from('user_oauth_tokens')
            .upsert(tokenData, {
              onConflict: 'user_id,provider'
            })
            .select()
          
          if (upsertError) {
            console.error('OAuth token upsert error:', upsertError)
            console.error('Token data that failed:', tokenData)
          } else {
            console.log('OAuth tokens stored successfully:', upsertData)
          }
        } catch (tokenError) {
          console.error('Error storing OAuth tokens:', tokenError)
          // Don't fail the login if token storage fails
        }
      } else {
        console.warn('OAuth callback - No provider_token found in session')
      }
      
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}