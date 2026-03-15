import { NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting
// Note: In a serverless environment, this will be reset on cold starts
// For production, consider using Upstash Redis or Vercel KV
const rateLimitStore = new Map<string, RateLimitEntry>()

interface RateLimitOptions {
  limit: number // Maximum requests allowed in the window
  windowMs: number // Time window in milliseconds
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier for the client (e.g., user ID, IP address)
 * @param options - Rate limit configuration
 * @returns RateLimitResult with success status and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  // Clean up expired entries periodically (every 100 checks)
  if (Math.random() < 0.01) {
    cleanupExpiredEntries()
  }

  // If no entry exists or window has expired, create new entry
  if (!entry || now >= entry.resetTime) {
    const resetTime = now + options.windowMs
    rateLimitStore.set(identifier, { count: 1, resetTime })
    return {
      success: true,
      remaining: options.limit - 1,
      resetTime,
    }
  }

  // Check if limit is exceeded
  if (entry.count >= options.limit) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  // Increment counter
  entry.count++
  return {
    success: true,
    remaining: options.limit - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Create a rate limit error response
 */
export function rateLimitResponse(resetTime: number): NextResponse {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': String(resetTime),
      },
    }
  )
}

// Default rate limit configurations for different endpoint types
export const RATE_LIMITS = {
  // OneDrive file operations - 60 requests per minute per user
  ONEDRIVE_FILES: { limit: 60, windowMs: 60 * 1000 },
  // Document conversion - more expensive, 10 per minute per user
  DOCUMENT_CONVERSION: { limit: 10, windowMs: 60 * 1000 },
  // General API endpoints - 100 requests per minute per user
  GENERAL: { limit: 100, windowMs: 60 * 1000 },
} as const
