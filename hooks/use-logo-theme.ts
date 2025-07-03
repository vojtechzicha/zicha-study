"use client"

import { useState, useEffect } from "react"
import { extractDominantColor, generateColorTheme, type ExtractedColor } from "@/lib/color-extraction"

/**
 * Hook to extract colors from logo and apply theme
 */
export function useLogoTheme(logoUrl?: string | null) {
  const [extractedColor, setExtractedColor] = useState<ExtractedColor | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!logoUrl) {
      // Reset to default theme
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
          
          // Apply CSS custom properties to the document root
          const theme = generateColorTheme(color)
          const root = document.documentElement
          
          Object.entries(theme).forEach(([property, value]) => {
            root.style.setProperty(property, value)
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

  // Apply default theme when no logo
  useEffect(() => {
    if (!logoUrl) {
      // Reset to default blue theme immediately
      const root = document.documentElement
      const defaultTheme = {
        "--primary": "hsl(217, 91%, 60%)",
        "--primary-rgb": "59, 130, 246",
        "--primary-h": "217",
        "--primary-s": "91%",
        "--primary-l": "60%",
        "--primary-50": "hsl(217, 100%, 95%)",
        "--primary-100": "hsl(217, 100%, 90%)",
        "--primary-200": "hsl(217, 100%, 85%)",
        "--primary-300": "hsl(217, 100%, 80%)",
        "--primary-400": "hsl(217, 91%, 75%)",
        "--primary-500": "hsl(217, 91%, 60%)",
        "--primary-600": "hsl(217, 91%, 55%)",
        "--primary-700": "hsl(217, 91%, 50%)",
        "--primary-800": "hsl(217, 91%, 45%)",
        "--primary-900": "hsl(217, 91%, 40%)",
      }
      
      Object.entries(defaultTheme).forEach(([property, value]) => {
        root.style.setProperty(property, value)
      })
      
      setExtractedColor(null)
      setError(null)
    }
  }, [logoUrl])

  return {
    extractedColor,
    isLoading,
    error,
    hasLogo: !!logoUrl,
  }
}