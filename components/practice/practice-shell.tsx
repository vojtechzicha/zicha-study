"use client"

import type { ReactNode } from "react"
import { useLogoTheme } from "@/hooks/use-logo-theme"
import { useFavicon } from "@/hooks/use-favicon"
import { TitlePageFooter } from "@/components/title-page-footer"
import type { PracticeFlavour } from "@/lib/constants"

// Page frame for the private Procvičování pages: the study's logo palette and favicon, the
// standard private-screen footer (with the theme switch), and the scoped content root that
// app/practice-content.css styles.
export function PracticeShell({
  logoUrl,
  flavour,
  children,
}: {
  logoUrl: string | null
  flavour: PracticeFlavour
  children: ReactNode
}) {
  useLogoTheme(logoUrl)
  useFavicon(logoUrl)

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-950 dark:to-background">
      <main className="flex-1">
        <div className="practice-content mx-auto w-full max-w-[1000px] px-4 pb-20 pt-6" data-flavour={flavour}>
          {children}
        </div>
      </main>
      <TitlePageFooter />
    </div>
  )
}
