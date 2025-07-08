import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export interface OneDriveTokenResult {
  token: string | null
  error?: string
  needsReauth?: boolean
}

interface OAuthTokenData {
  access_token: string
  refresh_token?: string
  expires_at?: string
  scope?: string
}

export class OneDriveTokenManagerV2 {
  private static readonly TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
  private static readonly CLIENT_ID = process.env.NEXT_PUBLIC_SUPABASE_AZURE_CLIENT_ID
  private static readonly CLIENT_SECRET = process.env.SUPABASE_AZURE_CLIENT_SECRET
  private static readonly REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
  
  static isConfigured(): boolean {
    return !!(this.CLIENT_ID && this.CLIENT_SECRET)
  }

  private static async getSupabaseClient() {
    return await createServerClient()
  }

  static async getValidToken(): Promise<OneDriveTokenResult> {
    try {
      const supabase = await this.getSupabaseClient()
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('User error:', userError)
        return { token: null, error: 'User not authenticated', needsReauth: true }
      }
      
      // Check if OAuth is configured for refresh tokens
      if (!this.isConfigured()) {
        console.warn('OAuth credentials not configured. Refresh tokens will not work. See docs/ONEDRIVE_OAUTH_SETUP.md')
      }

      // First, try to get the token from Supabase session (for fresh logins)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      // Debug what's in the session
      if (session) {
        console.log('Session check - Has provider_token:', !!session.provider_token)
        console.log('Session check - Has provider_refresh_token:', !!session.provider_refresh_token)
      }
      
      if (session?.provider_token) {
        // Store tokens in our table if they're fresh from login
        const tokenData = {
          access_token: session.provider_token,
          refresh_token: session.provider_refresh_token || undefined,
          expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
        }
        
        if (session.provider_refresh_token) {
          await this.storeTokens(user.id, tokenData)
        }
      }

      // Get stored tokens from our table using service client
      const serviceClient = createServiceClient()
      const { data: tokenData, error: tokenError } = await serviceClient
        .from('user_oauth_tokens')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'microsoft')
        .single()

      if (tokenError || !tokenData) {
        // No stored tokens, check if we have a session token
        if (session?.provider_token) {
          return { token: session.provider_token }
        }
        return { token: null, error: 'No tokens found', needsReauth: true }
      }

      // Check if token is expired
      const now = new Date()
      const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at) : null
      const isExpired = expiresAt ? now >= expiresAt : false

      if (!isExpired && tokenData.access_token) {
        return { token: tokenData.access_token }
      }

      // Token is expired, try to refresh
      if (tokenData.refresh_token) {
        const refreshResult = await this.refreshAccessToken(user.id, tokenData.refresh_token)
        if (refreshResult.token) {
          return refreshResult
        }
      } else {
        console.warn('No refresh token available. User will need to re-authenticate when token expires.')
      }

      // Can't refresh, need to re-authenticate
      return { token: null, error: 'Access token expired and refresh failed', needsReauth: true }
    } catch (error) {
      console.error('Error getting OneDrive token:', error)
      return { token: null, error: 'Token retrieval failed', needsReauth: true }
    }
  }

  private static async refreshAccessToken(userId: string, refreshToken: string): Promise<OneDriveTokenResult> {
    try {
      if (!this.isConfigured()) {
        console.error('Missing OAuth client credentials. Set NEXT_PUBLIC_SUPABASE_AZURE_CLIENT_ID and SUPABASE_AZURE_CLIENT_SECRET environment variables.')
        return { token: null, error: 'OAuth configuration missing. See server logs for details.', needsReauth: true }
      }

      // Prepare the token refresh request
      const params = new URLSearchParams({
        client_id: this.CLIENT_ID,
        client_secret: this.CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        redirect_uri: this.REDIRECT_URI || ''
      })

      // Make the refresh request to Microsoft
      const response = await fetch(this.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('Token refresh failed:', response.status, errorData)
        return { token: null, error: 'Token refresh failed', needsReauth: true }
      }

      const data = await response.json()

      // Calculate expiration time (usually 1 hour for Microsoft tokens)
      const expiresIn = data.expires_in || 3600 // Default to 1 hour
      const expiresAt = new Date(Date.now() + (expiresIn * 1000))

      // Store the new tokens
      await this.storeTokens(userId, {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken, // Use new refresh token if provided
        expires_at: expiresAt.toISOString(),
        scope: data.scope
      })

      return { token: data.access_token }
    } catch (error) {
      console.error('Error refreshing access token:', error)
      return { token: null, error: 'Token refresh failed', needsReauth: true }
    }
  }

  private static async storeTokens(userId: string, tokenData: OAuthTokenData) {
    try {
      // Use service client to bypass RLS
      const serviceClient = createServiceClient()
      
      const { error } = await serviceClient
        .from('user_oauth_tokens')
        .upsert({
          user_id: userId,
          provider: 'microsoft',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: tokenData.expires_at,
          scope: tokenData.scope,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,provider'
        })

      if (error) {
        console.error('Error storing tokens:', error)
      } else {
        console.log('Tokens stored/updated in database')
      }
    } catch (error) {
      console.error('Error in storeTokens:', error)
    }
  }

  static async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const tokenResult = await this.getValidToken()
    
    if (!tokenResult.token) {
      throw new Error(tokenResult.error || 'No valid token available')
    }
    
    const headers = {
      'Authorization': `Bearer ${tokenResult.token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
    
    const response = await fetch(url, {
      ...options,
      headers
    })
    
    // If we get a 401, the token might have just expired
    if (response.status === 401) {
      // Force a token refresh and retry once
      const supabase = await this.getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Clear the cached token to force refresh on next call
        const serviceClient = createServiceClient()
        await serviceClient
          .from('user_oauth_tokens')
          .update({ expires_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('provider', 'microsoft')
        
        // Get a fresh token
        const refreshResult = await this.getValidToken()
        
        if (refreshResult.token) {
          const retryHeaders = {
            'Authorization': `Bearer ${refreshResult.token}`,
            'Content-Type': 'application/json',
            ...options.headers
          }
          
          return await fetch(url, {
            ...options,
            headers: retryHeaders
          })
        }
      }
      
      throw new Error('Access token expired and refresh failed')
    }
    
    return response
  }
  
  static createErrorResponse(tokenResult: OneDriveTokenResult): NextResponse {
    const status = tokenResult.needsReauth ? 401 : 500
    return NextResponse.json(
      { 
        error: tokenResult.error,
        needsReauth: tokenResult.needsReauth
      },
      { status }
    )
  }
}