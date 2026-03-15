import { OneDriveTokenManagerV2 } from './onedrive-token-manager-v2'
import { OneDriveTokenManager } from './onedrive-token-manager'

/**
 * Hybrid token manager that tries multiple strategies:
 * 1. First tries the V2 manager with refresh token support
 * 2. Falls back to V1 manager that uses Supabase session tokens
 * 3. This provides the best compatibility while we debug refresh token issues
 */
export class OneDriveTokenHybridManager {
  static async getValidToken() {
    // First try V2 with refresh tokens
    const v2Result = await OneDriveTokenManagerV2.getValidToken()

    // If V2 succeeds, use it
    if (v2Result.token) {
      return v2Result
    }

    // If V2 fails but it's not because we need reauth, try V1
    if (!v2Result.needsReauth) {
      const v1Result = await OneDriveTokenManager.getValidToken()
      if (v1Result.token) {
        return v1Result
      }
    }

    // Return the V2 error (it has better error messages)
    return v2Result
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
      // Try one more time with a fresh token
      const refreshResult = await this.getValidToken()
      
      if (refreshResult.token && refreshResult.token !== tokenResult.token) {
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
      
      throw new Error('Access token expired and refresh failed')
    }
    
    return response
  }
  
  static createErrorResponse = OneDriveTokenManagerV2.createErrorResponse
}