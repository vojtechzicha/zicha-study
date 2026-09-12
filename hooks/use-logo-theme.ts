"use client"
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from "react"
import { extractDominantColor, generateColorTheme, type ExtractedColor } from "@/lib/color-extraction"

/**
 * Fallback palette used when a page has no logo to theme from.
 *
 * KEEP IN SYNC with the `:root` `--primary-*` fallbacks in app/globals.css —
 * those cover pages that never mount this hook (login, tasks, exam scheduler),
 * this object covers pages that mount it without a logo.
 *
 * Values are bare, SPACE-separated HSL components so that Tailwind can emit both
 * `hsl(var(--primary-900))` and `hsl(var(--primary-900) / 0.5)`; the legacy
 * comma form is invalid inside the alpha syntax the dark-mode utilities use.
 */
const DEFAULT_THEME: Record<string, string> = {
  "--primary": "217 91% 60%",
  "--primary-foreground": "0 0% 100%",
  "--primary-rgb": "59, 130, 246",
  "--primary-h": "217",
  "--primary-s": "91%",
  "--primary-l": "60%",
  "--primary-50": "217 50% 96%",
  "--primary-100": "217 55% 94%",
  "--primary-200": "217 60% 88%",
  "--primary-300": "217 65% 82%",
  "--primary-400": "217 70% 76%",
  "--primary-500": "217 91% 60%",
  "--primary-600": "217 91% 55%",
  "--primary-700": "217 91% 50%",
  "--primary-800": "217 91% 30%",
  "--primary-900": "217 91% 22%",
  "--primary-950": "217 45% 12%",
}

/**
 * `--primary` is set inline on <html>, which beats the `.dark {}` rule, so the
 * matching foreground has to be derived from the logo colour as well — a dark
 * logo colour needs white text on it, a light one needs near-black.
 *
 * Decided on relative luminance (`ExtractedColor.isLight`, computed from RGB),
 * not HSL lightness: a saturated yellow or lime has L ≈ 50 % yet is very
 * bright, and white text on it would be unreadable.
 */
function primaryForegroundFor(isLight: boolean): string {
  return isLight ? "0 0% 9%" : "0 0% 100%"
}

function applyTheme(theme: Record<string, string>) {
  const root = document.documentElement
  Object.entries(theme).forEach(([property, value]) => {
    root.style.setProperty(property, value)
  })
}

/**
 * Hook to extract colors from logo and apply theme
 */
export function useLogoTheme(logoUrl?: string | null) {
  const [extractedColor, setExtractedColor] = useState<ExtractedColor | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // NOTE: no "skip if the url did not change" ref guard here. The dependency
  // array already de-duplicates runs for an unchanged `logoUrl`, and such a
  // guard is actively wrong under React Strict Mode: the dev-only
  // mount → cleanup → mount cycle cancels the first extraction and then makes
  // the second run bail out on the ref, so the palette is never applied.
  useEffect(() => {
    if (!logoUrl) {
      // Reset to default theme
      applyTheme(DEFAULT_THEME)
      setExtractedColor(null)
      setError(null)
      return
    }

    let isCancelled = false
    setIsLoading(true)
    setError(null)

    extractDominantColor(logoUrl)
      .then((color) => {
        if (!isCancelled) {
          setExtractedColor(color)
          applyTheme({
            ...generateColorTheme(color),
            "--primary-foreground": primaryForegroundFor(color.isLight),
          })
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn("Failed to extract color from logo:", err)
          setError("Failed to extract color from logo")
          setExtractedColor(null)
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [logoUrl])

  return {
    extractedColor,
    isLoading,
    error,
    hasLogo: !!logoUrl,
  }
}
