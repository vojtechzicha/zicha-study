"use client"

import { Badge } from "@/components/ui/badge"
import { StudyLogo } from "./study-logo"
import { useLogoTheme } from "@/hooks/use-logo-theme"
import { useFavicon } from "@/hooks/use-favicon"
import { PublicMaterialsSection } from "./public-materials-section"
import { StudyNotesDisplaySection } from "./study-notes-display-section"
import { FinalExamsList } from "./final-exams-list"
import { StudyStatsCards } from "./subjects/study-stats"
import { StudySubjectsPublic } from "./subjects/study-subjects-section"
import { DiplomaShowcase } from "./diploma-showcase"
import { PublicPageFooter } from "./public-page-footer"
import { getStatusColor, getStatusText, StudyStatus } from "@/lib/status-utils"
import { getStudyFormLabel } from "@/lib/constants"
import { getStudyTerminology } from "@/lib/study-kind"

interface Study {
  id: string
  name: string
  type: string
  form: string
  start_year: number
  end_year?: number
  status: StudyStatus
  logo_url?: string
  diploma_url?: string | null
  diploma_mime_type?: string
  diploma_uploaded_at?: string
  is_public?: boolean
  public_slug?: string
  final_exams_enabled?: boolean
  public_description?: string
  last_updated?: string
}

interface Subject {
  id: string
  study_id: string
  semester: string
  abbreviation: string
  name: string
  completion_type: string
  subject_type: string
  credits: number
  hours?: number
  points?: number
  grade?: string
  lecturer?: string
  department?: string
  completed: boolean
  exam_completed: boolean
  credit_completed: boolean
  planned?: boolean
  final_date?: string
  created_at: string
  is_repeat?: boolean
  repeats_subject_id?: string
}

interface PublicStudyViewProps {
  study: Study
  subjects: Subject[]
}

export function PublicStudyView({ study, subjects }: PublicStudyViewProps) {
  // Extract and apply theme colors from logo
  useLogoTheme(study.logo_url)

  // Update favicon with study logo
  useFavicon(study.logo_url)

  const getStatusBadge = (status: StudyStatus) => {
    return <Badge className={getStatusColor(status)}>{getStatusText(status)}</Badge>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0">
              <StudyLogo logoUrl={study.logo_url} studyName={study.name} size="xl" className="!w-32 !h-32 !text-2xl" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{study.name}</h1>
              <div className="flex items-center space-x-3 mt-2">
                <span className="text-gray-600">{study.type}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-600">{getStudyFormLabel(study.form)}</span>
                <span className="text-gray-400">•</span>
                {getStatusBadge(study.status)}
              </div>

              {/* Study Timeline */}
              <div className="mt-4 bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-white/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Doba studia</span>
                  <span className="text-sm text-gray-600">
                    {study.start_year} - {study.end_year || 'probíhá'}
                  </span>
                </div>
                <div className="relative">
                  {/* Timeline bar */}
                  <div className="h-2 bg-primary-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-300"
                      style={{
                        width: study.end_year
                          ? `${Math.min(100, Math.max(5, ((new Date().getFullYear() - study.start_year) / (study.end_year - study.start_year)) * 100))}%`
                          : '66%'
                      }}
                    />
                  </div>

                  {/* Year markers */}
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>{study.start_year}</span>
                    {study.end_year && (
                      <span>{study.end_year}</span>
                    )}
                  </div>

                  {/* Current year indicator */}
                  {study.end_year && new Date().getFullYear() >= study.start_year && new Date().getFullYear() <= study.end_year && (() => {
                    const currentYear = new Date().getFullYear()
                    const progress = (currentYear - study.start_year) / (study.end_year - study.start_year)
                    const leftPosition = Math.max(8, Math.min(92, progress * 100))

                    return (
                      <div
                        className="absolute top-0 transform -translate-x-1/2"
                        style={{
                          left: `${leftPosition}%`
                        }}
                      >
                        <div className="w-3 h-3 bg-primary-600 rounded-full border-2 border-white shadow-sm -mt-0.5"></div>
                        <div className="text-xs text-primary-600 font-medium mt-1 whitespace-nowrap">
                          {currentYear}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
              {study.public_description && <p className="text-gray-600 mt-2 max-w-2xl">{study.public_description}</p>}
              {study.last_updated && (
                <p className="text-sm text-gray-500 mt-2">
                  Naposledy aktualizováno: {new Date(study.last_updated).toLocaleDateString("cs-CZ")}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Diploma Showcase (only renders when study is completed and diploma uploaded) */}
        <DiplomaShowcase study={study} />

        {/* Statistics Cards */}
        <StudyStatsCards study={study} subjects={subjects} variant="full" />

        {/* Materials Section */}
        <div className="mb-8">
          <PublicMaterialsSection studyId={study.id} study={study} />
        </div>

        {/* Study Notes Section */}
        <div className="mb-8">
          <StudyNotesDisplaySection
            studyId={study.id}
            study={study}
            isPublicView={true}
            showSubtitle={true}
            showPublicBadge={false}
            showSubjectNames={false}
          />
        </div>

        {/* Final Exams Section */}
        {study.final_exams_enabled && (
          <div className="mb-8">
            <FinalExamsList
              studyId={study.id}
              studySlug={study.public_slug}
              terminology={getStudyTerminology(study.type)}
              isPublic={true}
            />
          </div>
        )}

        {/* Subjects */}
        <StudySubjectsPublic study={study} subjects={subjects} />

        <PublicPageFooter />
      </main>
    </div>
  )
}
