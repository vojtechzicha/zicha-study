import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export interface OneDriveTokenResult {
  token: string | null
  error?: string
  needsReauth?: boolean
}

export class OneDriveTokenManager {
  private static async getSupabaseClient() {
    return await createServerClient()
  }

  static async getValidToken(): Promise<OneDriveTokenResult> {
    try {
      const supabase = await this.getSupabaseClient()
      
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('Session error:', sessionError)
        return { token: null, error: 'Session error', needsReauth: true }
      }
      
      if (!session) {
        return { token: null, error: 'No session found', needsReauth: true }
      }
      
      // Check if we have a provider token or if it's expired
      const tokenAge = session.expires_at ? Date.now() - (session.expires_at * 1000) : 0
      const isExpired = tokenAge > 3600000 // 1 hour in milliseconds
      
      if (!session.provider_token || isExpired) {
        // Try to refresh the session first
        const refreshResult = await this.refreshSession()
        if (refreshResult.token) {
          return refreshResult
        }
        // If refresh failed, return error with needsReauth
        return { token: null, error: 'Access token expired and refresh failed', needsReauth: true }
      }
      
      return { token: session.provider_token }
    } catch (error) {
      console.error('Error getting OneDrive token:', error)
      return { token: null, error: 'Token retrieval failed', needsReauth: true }
    }
  }
  
  private static async refreshSession(): Promise<OneDriveTokenResult> {
    try {
      const supabase = await this.getSupabaseClient()
      
      // Refresh the session
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError) {
        console.error('Token refresh error:', refreshError)
        return { token: null, error: 'Token refresh failed', needsReauth: true }
      }
      
      if (!session?.provider_token) {
        return { token: null, error: 'No token after refresh', needsReauth: true }
      }
      
      return { token: session.provider_token }
    } catch (error) {
      console.error('Error refreshing session:', error)
      return { token: null, error: 'Session refresh failed', needsReauth: true }
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
    
    // If we get a 401, try to refresh the token once
    if (response.status === 401) {
      const refreshResult = await this.refreshSession()
      
      if (refreshResult.token) {
        const retryHeaders = {
          'Authorization': `Bearer ${refreshResult.token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
        
        const retryResponse = await fetch(url, {
          ...options,
          headers: retryHeaders
        })
        
        // Check if retry was successful
        if (!retryResponse.ok) {
          console.error(`OneDrive API error after retry: ${retryResponse.status} ${retryResponse.statusText}`)
        }
        
        return retryResponse
      }
      
      throw new Error('Access token expired and refresh failed')
    }
    
    // Log non-OK responses for debugging
    if (!response.ok) {
      console.error(`OneDrive API error: ${response.status} ${response.statusText}`)
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