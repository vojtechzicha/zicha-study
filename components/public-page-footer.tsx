"use client"

import Image from "next/image"
import Link from "next/link"
import { GraduationCap } from "lucide-react"

interface PublicPageFooterProps {
  studyName?: string
  studySlug?: string | null
}

export function PublicPageFooter({ studyName, studySlug }: PublicPageFooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-16 pt-8 pb-6">
      {/* Thin gradient divider */}
      <div className="mx-auto mb-8 h-px max-w-xs bg-gradient-to-r from-transparent via-primary-300 to-transparent" />

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
        {/* Author attribution */}
        <div className="flex items-center gap-3.5">
          <div className="relative h-9 w-9 overflow-hidden rounded-full ring-1 ring-primary-200/60 shadow-sm">
            <Image
              src="/profile.jpg"
              alt="Vojtěch Zicha"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-800">
              Vojtěch Zicha
            </span>
            <span className="text-xs text-gray-400">
              osobní studijní archiv · &copy; {currentYear}
            </span>
          </div>
        </div>

        {/* Navigation links */}
        <div className="flex items-center gap-4 text-sm">
          {studySlug && studyName && (
            <Link
              href={`/${studySlug}`}
              className="text-gray-500 transition-colors hover:text-primary-600"
            >
              {studyName}
            </Link>
          )}
          {studySlug && studyName && (
            <span className="text-gray-300">·</span>
          )}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-gray-500 transition-colors hover:text-primary-600"
          >
            <GraduationCap className="h-3.5 w-3.5" />
            <span>Sledování studií</span>
          </Link>
        </div>
      </div>
    </footer>
  )
}
