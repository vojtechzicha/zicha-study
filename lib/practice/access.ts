import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth-guard"

// Procvičování is private: every page and its metadata require a session. Signed-out visitors
// go to the sign-in page, which returns them here afterwards (?callbackUrl).

export const PRACTICE_ROBOTS: Metadata["robots"] = { index: false, follow: false }

export function practicePath(...segments: string[]): string {
  return `/${segments.map(encodeURIComponent).join("/")}`
}

function withQuery(path: string, searchParams: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, v)
  }
  const qs = query.toString()
  return qs ? `${path}?${qs}` : path
}

/** Redirects to sign-in unless there is a session. */
export async function requirePracticeSession(path: string, searchParams: Record<string, string | string[] | undefined> = {}) {
  const user = await getSessionUser()
  if (!user) redirect(`/?callbackUrl=${encodeURIComponent(withQuery(path, searchParams))}`)
  return user
}

/** For generateMetadata: true when the request has a session (never leak titles otherwise). */
export async function hasPracticeSession() {
  return (await getSessionUser()) !== null
}
