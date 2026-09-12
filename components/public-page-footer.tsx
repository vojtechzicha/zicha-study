"use client"

import Image from "next/image"
import Link from "next/link"
import { GraduationCap } from "lucide-react"
import { SITE_CONFIG } from "@/lib/site-config"
import { ThemeToggle } from "@/components/theme-toggle"

interface PublicPageFooterProps {
  studyName?: string
  studySlug?: string | null
}

export function PublicPageFooter({ studyName, studySlug }: PublicPageFooterProps) {
  const currentYear = new Date().getFullYear()
  const { footerAttribution } = SITE_CONFIG

  return (
    <footer className="mt-16 pt-8 pb-6">
      {/* Thin gradient divider */}
      <div className="mx-auto mb-8 h-px max-w-xs bg-gradient-to-r from-transparent via-primary-300 dark:via-primary-700 to-transparent" />

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
        {/* Author attribution */}
        <div className="flex items-center gap-3.5">
          <div className="relative h-9 w-9 overflow-hidden rounded-full ring-1 ring-primary-200/60 dark:ring-primary-800/60 shadow-sm">
            <Image
              src={footerAttribution.imageSrc}
              alt={footerAttribution.imageAlt}
              fill
              className="object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {footerAttribution.name}
            </span>
            <span className="text-xs text-muted-foreground/70">
              {footerAttribution.description} · &copy; {currentYear}
            </span>
          </div>
        </div>

        {/* Navigation links */}
        <div className="flex items-center gap-4 text-sm">
          {studySlug && studyName && (
            <Link
              href={`/${studySlug}`}
              className="text-muted-foreground transition-colors hover:text-primary-600 dark:hover:text-primary-400"
            >
              {studyName}
            </Link>
          )}
          {studySlug && studyName && (
            <span className="text-muted-foreground/50">·</span>
          )}
          <Link
            href={SITE_CONFIG.homeHref}
            className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary-600 dark:hover:text-primary-400"
          >
            <GraduationCap className="h-3.5 w-3.5" />
            <span>{SITE_CONFIG.publicFooterHomeLabel}</span>
          </Link>
          <ThemeToggle size="sm" />
        </div>
      </div>
    </footer>
  )
}
