import { NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory and per instance: resets on serverless cold starts and is not
// shared between instances. A shared store (Upstash Redis, Vercel KV) would fix that.
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
 * Fixed-window rate limit keyed by `identifier` (e.g. user ID or IP address).
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  // Prune expired entries on roughly 1 in 100 calls (random, not a counter)
  if (Math.random() < 0.01) {
    cleanupExpiredEntries()
  }

  if (!entry || now >= entry.resetTime) {
    const resetTime = now + options.windowMs
    rateLimitStore.set(identifier, { count: 1, resetTime })
    return {
      success: true,
      remaining: options.limit - 1,
      resetTime,
    }
  }

  if (entry.count >= options.limit) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  entry.count++
  return {
    success: true,
    remaining: options.limit - entry.count,
    resetTime: entry.resetTime,
  }
}

function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

export function rateLimitResponse(resetTime: number): NextResponse {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
  return NextResponse.json(
    { error: 'Příliš mnoho požadavků. Chvíli počkejte.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': String(resetTime),
      },
    }
  )
}

export const RATE_LIMITS = {
  ONEDRIVE_FILES: { limit: 60, windowMs: 60 * 1000 },
  // Conversion is expensive, hence the lower limit
  DOCUMENT_CONVERSION: { limit: 10, windowMs: 60 * 1000 },
  GENERAL: { limit: 100, windowMs: 60 * 1000 },
} as const
