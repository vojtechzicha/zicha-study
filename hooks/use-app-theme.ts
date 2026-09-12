"use client"

import { useCallback, useSyncExternalStore } from "react"
import { useTheme } from "next-themes"

export type AppTheme = "light" | "dark"

/**
 * localStorage key holding the user's explicit choice. Owned by next-themes
 * (see `storageKey` on the ThemeProvider in app/layout.tsx) and mirrored here
 * only so the name lives next to the hook that documents it.
 */
export const THEME_STORAGE_KEY = "zs_theme"

/** No-op subscription: the "store" (being hydrated) never changes again. */
const subscribeToNothing = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

/**
 * The app's only theme surface — components must not import `next-themes`
 * directly, so the underlying mechanism stays swappable.
 *
 * Semantics (mirroring zicha-travel):
 * - Exactly two visible states, `light` and `dark`.
 * - With nothing stored, next-themes keeps the theme at `system`: the default
 *   comes from `prefers-color-scheme` and follows OS changes live.
 * - `toggleTheme()` writes `light`/`dark` to localStorage (`zs_theme`), which
 *   pins the choice and stops following the OS.
 * - `mounted` is false during SSR and the first render, so callers can show a
 *   placeholder instead of guessing the theme and flashing the wrong icon.
 */
export function useAppTheme(): {
  theme: AppTheme
  toggleTheme: () => void
  mounted: boolean
} {
  const { resolvedTheme, setTheme } = useTheme()

  // `resolvedTheme` is only known on the client; gate on hydration without a
  // setState-in-effect (forbidden by the repo's react-hooks lint rules).
  const mounted = useSyncExternalStore(subscribeToNothing, clientSnapshot, serverSnapshot)

  const theme: AppTheme = resolvedTheme === "dark" ? "dark" : "light"

  const toggleTheme = useCallback(() => {
    // Read through next-themes' own resolution so a click always flips what
    // the user currently sees, including while the theme is still `system`.
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }, [resolvedTheme, setTheme])

  return { theme, toggleTheme, mounted }
}
