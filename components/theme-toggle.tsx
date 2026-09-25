"use client"

import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAppTheme } from "@/hooks/use-app-theme"
import { cn } from "@/lib/utils"

export interface ThemeToggleProps {
  /** `sm` renders a tighter 8x8 button, for the footers. */
  size?: "sm" | "default"
  className?: string
}

/**
  * One-click light/dark switch. Rendered only in the two page footers
  * (`TitlePageFooter`, `PublicPageFooter`), so every full-page screen gets one.
 *
 * Shows the theme it switches *to*: a moon while light is active, a sun while
 * dark is active.
 */
export function ThemeToggle({ size = "default", className }: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useAppTheme()

  const isDark = theme === "dark"
  const label = isDark ? "Přepnout na světlý motiv" : "Přepnout na tmavý motiv"
  const iconClassName = size === "sm" ? "h-4 w-4" : "h-[1.15rem] w-[1.15rem]"

  const buttonClassName = cn(
    "rounded-full text-muted-foreground hover:text-foreground",
    size === "sm" ? "h-8 w-8" : "h-9 w-9",
    className
  )

  // Until hydration finishes the active theme is unknown; reserve the exact
  // same box so the footer does not shift once the real icon appears.
  if (!mounted) {
    return <span aria-hidden="true" className={cn("inline-block shrink-0", buttonClassName)} />
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={buttonClassName}
      onClick={toggleTheme}
      title={label}
      aria-label={label}
    >
      {isDark ? (
        <Sun className={iconClassName} aria-hidden="true" />
      ) : (
        <Moon className={iconClassName} aria-hidden="true" />
      )}
    </Button>
  )
}
