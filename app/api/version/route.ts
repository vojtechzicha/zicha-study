// Reports the build id of the deployment currently serving requests. The id
// is the commit SHA inlined at build time (see next.config.mjs), so whatever
// build produced the running server code is the id this route returns. A
// browser tab whose own inlined SHA differs was loaded from an older deploy —
// the UpdateHint component polls this route and asks the user to refresh in
// that case.
//
// Deliberately unauthenticated: it exposes nothing but the deployed commit
// SHA (already shown in the public footer), and the hint must work on public
// study pages and on tabs that are not signed in.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json(
    { buildId: process.env.NEXT_PUBLIC_COMMIT_SHA ?? null },
    // Explicit no-store so no CDN in front of the app ever pins a stale id.
    { headers: { "cache-control": "no-store" } },
  )
}
