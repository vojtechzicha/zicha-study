// Returns the commit SHA inlined at build time (see next.config.mjs) for the
// deployment serving this request. UpdateHint polls it and asks the user to refresh
// when the tab's own inlined SHA differs, i.e. the tab came from an older deploy.
//
// Deliberately unauthenticated: the SHA is already in the public footer, and the
// hint must work on public pages and signed-out tabs.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json(
    { buildId: process.env.NEXT_PUBLIC_COMMIT_SHA ?? null },
    // no-store so a CDN never pins a stale id
    { headers: { "cache-control": "no-store" } },
  )
}
