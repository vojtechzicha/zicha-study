"use client"

// Post-deploy refresh hint. A tab left open across a deploy keeps running the
// old bundle, and an old bundle drifts from the server: new Server Actions,
// changed schemas, renamed routes. This component compares the commit SHA
// inlined into this bundle (see next.config.mjs) against GET /api/version,
// and when they diverge shows a persistent toast asking the user to refresh.
//
// Checks run when the tab regains focus or becomes visible again — the exact
// moment someone returns to a long-lived tab — plus a slow background
// interval. A fresh page load is by definition current, so there is no check
// on mount. Dismissing hides the hint for that server build only; a later
// deploy brings it back.

import { useEffect, useState } from "react"
import { RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const CLIENT_BUILD_ID = process.env.NEXT_PUBLIC_COMMIT_SHA ?? null
const CHECK_INTERVAL_MS = 5 * 60 * 1000
/** Minimum gap between checks, so focus + visibilitychange firing together
 *  (or rapid tab switching) don't burst requests. */
const CHECK_DEBOUNCE_MS = 30 * 1000

export function UpdateHint() {
  const [serverBuildId, setServerBuildId] = useState<string | null>(null)
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  useEffect(() => {
    // "development" means the build had no commit SHA to derive an id from
    // (see next.config.mjs) — comparisons would be meaningless, so don't poll.
    if (!CLIENT_BUILD_ID || CLIENT_BUILD_ID === "development") return
    let cancelled = false
    let lastCheck = 0

    const check = async () => {
      if (document.visibilityState === "hidden") return
      const now = Date.now()
      if (now - lastCheck < CHECK_DEBOUNCE_MS) return
      lastCheck = now
      try {
        const res = await fetch("/api/version", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { buildId?: string | null }
        if (!cancelled && data.buildId) setServerBuildId(data.buildId)
      } catch {
        // Offline or transient failure — the next trigger tries again.
      }
    }

    const onFocusOrVisible = () => {
      if (document.visibilityState === "visible") void check()
    }
    const intervalId = setInterval(check, CHECK_INTERVAL_MS)
    window.addEventListener("focus", onFocusOrVisible)
    document.addEventListener("visibilitychange", onFocusOrVisible)
    return () => {
      cancelled = true
      clearInterval(intervalId)
      window.removeEventListener("focus", onFocusOrVisible)
      document.removeEventListener("visibilitychange", onFocusOrVisible)
    }
  }, [])

  const stale =
    serverBuildId !== null &&
    serverBuildId !== CLIENT_BUILD_ID &&
    serverBuildId !== dismissedId
  if (!stale) return null

  return (
    <div
      role="alert"
      className="fixed bottom-6 left-1/2 z-50 flex w-[min(92vw,560px)] -translate-x-1/2 items-center gap-3 rounded-lg border border-primary-200 bg-white px-4 py-3 shadow-lg"
    >
      <span className="text-sm leading-relaxed text-gray-700">
        Mezitím vyšla nová verze aplikace. Obnovte stránku, ať pracujete s tou
        aktuální.
      </span>
      <Button
        type="button"
        size="sm"
        className="shrink-0 bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800"
        onClick={() => window.location.reload()}
      >
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        Obnovit stránku
      </Button>
      <button
        type="button"
        aria-label="Zavřít"
        title="Zavřít"
        className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-gray-600"
        onClick={() => setDismissedId(serverBuildId)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
