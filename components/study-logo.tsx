"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

interface StudyLogoProps {
  logoUrl?: string | null
  studyName: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
  fallback?: boolean
}

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
}

const fallbackSizeClasses = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-12 h-12 text-lg",
  xl: "w-16 h-16 text-xl",
}

export function StudyLogo({ logoUrl, studyName, size = "md", className, fallback = true }: StudyLogoProps) {
  if (logoUrl) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-lg bg-white border border-gray-200 flex items-center justify-center",
          sizeClasses[size],
          className,
        )}
      >
        <Image
          src={logoUrl || "/placeholder.svg"}
          alt={`${studyName} logo`}
          fill
          className="object-contain p-1"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
    )
  }

  if (fallback) {
    // Create initials from study name
    const initials = studyName
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2)

    return (
      <div
        className={cn(
          "bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold",
          fallbackSizeClasses[size],
          className,
        )}
      >
        {initials}
      </div>
    )
  }

  return null
}
