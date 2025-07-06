"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit, Settings, BarChart3, Plus } from "lucide-react"
import { StudyLogo } from "./study-logo"
import { getStatusColor, getStatusText, StudyStatus } from "@/lib/status-utils"
import { getStudyFormLabel } from "@/lib/constants"

interface Study {
  id: string
  name: string
  type: string
  form: string
  status: StudyStatus
  logo_url?: string | null
  is_public?: boolean
}

interface StudyHeaderProps {
  study?: Study
  title?: string
  subtitle?: string
  logoUrl?: string | null
  onBack: () => void
  actions?: React.ReactNode
}

function getStatusBadge(status: StudyStatus) {
  return <Badge className={getStatusColor(status)}>{getStatusText(status)}</Badge>
}

export function StudyHeader({ study, title, subtitle, logoUrl, onBack, actions }: StudyHeaderProps) {
  const displayTitle = title || study?.name || ""
  const displaySubtitle = subtitle || (study ? `${study.type} • ${getStudyFormLabel(study.form)}` : "")
  const displayLogoUrl = logoUrl || study?.logo_url

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center min-h-16 py-3 gap-3">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <Button variant="ghost" onClick={onBack} className="text-gray-600 hover:text-gray-900 flex-shrink-0">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zpět
            </Button>
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <StudyLogo logoUrl={displayLogoUrl} studyName={displayTitle} size="lg" className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight break-words hyphens-auto overflow-wrap-anywhere whitespace-normal">{displayTitle}</h1>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600 mt-1">
                  {study ? (
                    <>
                      <span>{study.type}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{study.form}</span>
                      <span className="hidden sm:inline">•</span>
                      {getStatusBadge(study.status)}
                      {study.is_public && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Veřejné
                          </Badge>
                        </>
                      )}
                    </>
                  ) : (
                    subtitle && <span>{subtitle}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}