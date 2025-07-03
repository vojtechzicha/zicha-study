"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface StudyLogoProps {
  logoUrl?: string | null
  studyName: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-12 h-12 text-sm",
  lg: "w-16 h-16 text-base",
  xl: "w-24 h-24 text-lg",
}

export function StudyLogo({ logoUrl, studyName, size = "md", className }: StudyLogoProps) {
  const [imageError, setImageError] = useState(false)

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  if (logoUrl && !imageError) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-gray-200 bg-white p-1",
          sizeClasses[size],
          className,
        )}
      >
        <Image
          src={logoUrl || "/placeholder.svg"}
          alt={`${studyName} logo`}
          fill
          className="object-contain"
          onError={() => setImageError(true)}
        />
      </div>
    )
  }

  // Fallback to initials
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg border border-gray-200 bg-gradient-to-br from-blue-100 to-indigo-100 font-semibold text-blue-700",
        sizeClasses[size],
        className,
      )}
    >
      {getInitials(studyName)}
    </div>
  )
}
