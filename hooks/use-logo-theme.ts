"use client"
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from "react"
import { extractDominantColor, generateColorTheme, type ExtractedColor } from "@/lib/color-extraction"

/**
 * Palette for pages that mount this hook without a logo.
 *
 * KEEP IN SYNC with the `:root` `--primary-*` fallbacks in app/globals.css, which
 * cover pages that never mount the hook (login, tasks, exam scheduler).
 *
 * Values are bare, space-separated HSL so `hsl(var(--primary-900) / 0.5)` (Tailwind
 * opacity modifiers) stays valid; the comma form breaks it.
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
 * `--primary` is set inline on <html>, which beats the `.dark {}` rule, so its
 * foreground must be derived from the logo colour too.
 *
 * Uses relative luminance (`ExtractedColor.isLight`), not HSL lightness: a
 * saturated yellow or lime has L ≈ 50 % yet is too bright for white text.
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
 * Extracts the logo's dominant colour and writes the `--primary-*` palette inline
 * on <html>. Without a logo, applies DEFAULT_THEME.
 */
export function useLogoTheme(logoUrl?: string | null) {
  const [extractedColor, setExtractedColor] = useState<ExtractedColor | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // No "skip if the url did not change" ref guard: the dependency array already
  // de-duplicates, and under Strict Mode the dev-only mount → cleanup → mount cycle
  // would cancel the first extraction and skip the second, so the palette would
  // never be applied.
  useEffect(() => {
    if (!logoUrl) {
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
