"use client"

import Image from "next/image"
import Link from "next/link"
import { GitCommitHorizontal, GraduationCap } from "lucide-react"
import { SITE_CONFIG } from "@/lib/site-config"

const fullCommitSha = process.env.NEXT_PUBLIC_COMMIT_SHA || "development"
const commitLabel = fullCommitSha === "development"
  ? "dev"
  : fullCommitSha.slice(0, 7)
const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || ""
const buildTimeLabel = process.env.NEXT_PUBLIC_BUILD_TIME_LABEL || ""
const commitTitle = [
  `commit ${fullCommitSha}`,
  buildTimeLabel ? `built ${buildTimeLabel}` : null,
  buildTime && buildTime !== buildTimeLabel ? buildTime : null,
].filter(Boolean).join("\n")

export function TitlePageFooter() {
  const currentYear = new Date().getFullYear()
  const { footerAttribution } = SITE_CONFIG

  return (
    <footer className="px-4 pb-6">
      <div className="mx-auto mb-6 h-px max-w-xs bg-gradient-to-r from-transparent via-primary-300 to-transparent" />

      <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="flex items-center gap-3.5">
          <div className="relative h-9 w-9 overflow-hidden rounded-full shadow-sm ring-1 ring-primary-200/60">
            <Image
              src={footerAttribution.imageSrc}
              alt={footerAttribution.imageAlt}
              fill
              className="object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-800">
              {footerAttribution.name}
            </span>
            <span className="text-xs text-gray-400">
              {footerAttribution.description} · &copy; {currentYear}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
          <Link
            href={SITE_CONFIG.homeHref}
            className="inline-flex items-center gap-1.5 text-gray-500 transition-colors hover:text-primary-600"
          >
            <GraduationCap className="h-3.5 w-3.5" />
            <span>{SITE_CONFIG.footerHomeLabel}</span>
          </Link>
          <span className="hidden text-gray-300 sm:inline">·</span>
          <span
            className="inline-flex items-center gap-1.5 text-gray-500"
            title={commitTitle}
          >
            <GitCommitHorizontal className="h-3.5 w-3.5" />
            <code className="font-mono text-xs text-gray-600">{commitLabel}</code>
          </span>
        </div>
      </div>
    </footer>
  )
}
