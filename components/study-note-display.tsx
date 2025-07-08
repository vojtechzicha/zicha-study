"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  FileText, 
  Download, 
  ExternalLink, 
  Calendar, 
  BookOpen,
  Home,
  RefreshCw,
  Clock
} from "lucide-react"
import Link from "next/link"
import type { StudyNote } from "@/lib/types/study-notes"
import { StudyNoteContent } from "@/components/study-note-content"
import { StudyLogo } from "./study-logo"
import { useLogoTheme } from "@/hooks/use-logo-theme"
import { useFavicon } from "@/hooks/use-favicon"
import "@/app/study-note-content.css"

interface StudyNoteDisplayProps {
  note: StudyNote & {
    subjects?: {
      id: string
      name: string
      abbreviation: string
      studies?: {
        id: string
        name: string
        is_public: boolean
        public_slug: string | null
      }
    }
  }
  subject?: {
    id: string
    name: string
    abbreviation: string
    studies?: {
      id: string
      name: string
      is_public: boolean
      public_slug: string | null
      logo_url?: string | null
    }
  }
  study?: {
    id: string
    name: string
    is_public: boolean
    public_slug: string | null
    logo_url?: string | null
  }
  flush?: boolean
}

interface CacheInfo {
  onedriveLastModified?: string
  generatedAt?: string
}

export function StudyNoteDisplay({ note, subject, study, flush }: StudyNoteDisplayProps) {
  const [cacheInfo, setCacheInfo] = React.useState<CacheInfo | null>(null)
  const subjectData = subject || note.subjects
  const studyData = study || subjectData?.studies

  // Extract and apply theme colors from study logo
  const { extractedColor, isLoading: colorLoading } = useLogoTheme(studyData?.logo_url || study?.logo_url)
  
  // Update favicon with study logo
  useFavicon(studyData?.logo_url || study?.logo_url)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return ""
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  return (
    <div 
      className="min-h-screen" 
      style={{ 
        background: `linear-gradient(to bottom right, var(--primary-50, hsl(217, 100%, 95%)), var(--primary-100, hsl(217, 100%, 90%)))`,
        minHeight: "100vh"
      } as React.CSSProperties}
    >
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              {(studyData?.logo_url || study?.logo_url) && (
                <StudyLogo 
                  logoUrl={studyData?.logo_url || study?.logo_url} 
                  studyName={studyData?.name || study?.name || "Study"} 
                  size="sm" 
                  className="!w-10 !h-10" 
                />
              )}
              <div className="flex items-center space-x-4">
                <Link href="/" className="text-gray-600 hover:text-gray-900">
                  <Home className="h-5 w-5" />
                </Link>
                {studyData?.is_public && studyData.public_slug && (
                  <>
                    <span className="text-gray-400">/</span>
                    <Link 
                      href={`/${studyData.public_slug}`}
                      className="text-gray-600 hover:text-gray-900 font-medium"
                    >
                      {studyData.name}
                    </Link>
                  </>
                )}
                {subjectData && (
                  <>
                    <span className="text-gray-400">/</span>
                    <span className="text-gray-900 font-medium">
                      {subjectData.abbreviation}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Note Info Card */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-2xl flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-600" />
                    {note.name}
                  </CardTitle>
                  {note.description && (
                    <p className="text-gray-600">{note.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => window.open(note.onedrive_web_url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Otevřít v OneDrive
                  </Button>
                  {note.onedrive_download_url && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(note.onedrive_download_url!, "_blank")}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Stáhnout
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {cacheInfo?.onedriveLastModified && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <RefreshCw className="h-4 w-4" />
                    <span>Naposledy upraveno: {formatDate(cacheInfo.onedriveLastModified)}</span>
                  </div>
                )}
                {cacheInfo?.generatedAt && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Naposledy generováno: {formatDate(cacheInfo.generatedAt)}</span>
                  </div>
                )}
                {note.subjects && note.subjects.length > 0 && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <BookOpen className="h-4 w-4" />
                    <span>
                      {note.subjects.length === 1 
                        ? `Předmět: ${note.subjects[0].name}`
                        : `Předměty: ${note.subjects.map(s => s.abbreviation || s.name).join(", ")}`
                      }
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Document Content Area */}
          <StudyNoteContent 
            slug={note.public_slug} 
            studyId={note.study_id}
            flush={flush} 
            onCacheInfo={setCacheInfo}
          />
        </div>
      </main>
    </div>
  )
}