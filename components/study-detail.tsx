"use client"

import { useState, useEffect } from "react"
import { fetchSubjectsByStudyId } from "@/lib/actions/subjects"
import { Button } from "@/components/ui/button"
import { BarChart3, Edit, Settings } from "lucide-react"
import { StudyHeader } from "./study-header"
import { MaterialsSection } from "./materials-section"
import { StudyNotesDisplaySection } from "./study-notes-display-section"
import { FinalExamsList } from "./final-exams-list"
import { ExamSchedulerSection } from "./exam-scheduler-section"
import { StudyStatsCards } from "./subjects/study-stats"
import { StudySubjectsAdmin } from "./subjects/study-subjects-section"
import { DiplomaShowcase } from "./diploma-showcase"
import { TasksSection } from "./tasks-section"
import { TitlePageFooter } from "./title-page-footer"
import { getStudyTerminology } from "@/lib/study-kind"
import { useLogoTheme } from "@/hooks/use-logo-theme"
import { useFavicon } from "@/hooks/use-favicon"
import { useRouter } from "next/navigation"

interface Study {
  id: string
  name: string
  type: string
  form: string
  start_year: number
  end_year?: number
  status: "active" | "completed" | "paused" | "abandoned"
  graduation_result?: string | null
  logo_url?: string
  diploma_url?: string | null
  diploma_mime_type?: string
  diploma_uploaded_at?: string
  is_public?: boolean
  public_slug?: string
  final_exams_enabled?: boolean
  exam_scheduler_enabled?: boolean
  tasks_enabled?: boolean
  transit_duration_hours?: number
  transit_cost_one_way?: number
  accommodation_cost_per_night?: number
  earliest_arrival_time?: string | null
  is_url?: string
  created_at: string
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

interface StudyDetailProps {
  study: Study
  onBack: () => void
}

export function StudyDetail({ study, onBack }: StudyDetailProps) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [currentStudy] = useState<Study>(study)
  const [examSchedulerRefreshTrigger, setExamSchedulerRefreshTrigger] = useState(0)
  const router = useRouter()
  
  // Extract and apply theme colors from logo
  useLogoTheme(currentStudy.logo_url)
  
  // Update favicon with study logo
  useFavicon(currentStudy.logo_url)

  useEffect(() => {
    const loadSubjects = async () => {
      setLoading(true)
      const data = await fetchSubjectsByStudyId(study.id)
      setSubjects(data)
      setLoading(false)
    }

    loadSubjects()
  }, [study.id])

  const fetchSubjects = async () => {
    setLoading(true)
    const data = await fetchSubjectsByStudyId(study.id)
    setSubjects(data)
    setLoading(false)
    // Trigger exam scheduler to reload exam options
    setExamSchedulerRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <StudyHeader 
        study={currentStudy}
        onBack={onBack}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push(`/studies/${study.id}/edit`)} className="text-gray-700" size="sm">
              <Edit className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Upravit</span>
            </Button>
            <Button variant="outline" onClick={() => router.push(`/studies/${study.id}/settings`)} className="text-gray-700" size="sm">
              <Settings className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sdílení</span>
            </Button>
            <Button variant="outline" onClick={() => router.push(`/studies/${study.id}/statistics`)} className="text-gray-700" size="sm">
              <BarChart3 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Statistiky</span>
            </Button>
          </>
        }
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Diploma Showcase (only renders when study is completed and diploma uploaded) */}
        <DiplomaShowcase study={currentStudy} variant="compact" />

        {/* Statistics Cards */}
        <StudyStatsCards study={currentStudy} subjects={subjects} variant="simple" />

        {/* Tasks Section */}
        {currentStudy.tasks_enabled && (
          <div className="mb-8">
            <TasksSection studyId={study.id} />
          </div>
        )}

        {/* Materials Section */}
        <div className="mb-8">
          <MaterialsSection studyId={study.id} study={study} />
        </div>

        {/* Study Notes Section */}
        <div className="mb-8">
          <StudyNotesDisplaySection 
            studyId={study.id} 
            study={study}
            isPublicView={false}
            showSubtitle={false}
            showPublicBadge={true}
            showSubjectNames={false}
          />
        </div>

        {/* Final Exams Section */}
        {currentStudy.final_exams_enabled && (
          <div className="mb-8">
            <FinalExamsList
              studyId={study.id}
              studySlug={currentStudy.public_slug}
              terminology={getStudyTerminology(currentStudy.type)}
              onUpdate={fetchSubjects}
            />
          </div>
        )}

        {/* Exam Scheduler Section */}
        {currentStudy.exam_scheduler_enabled && (
          <div className="mb-8">
            <ExamSchedulerSection
              study={{
                id: currentStudy.id,
                name: currentStudy.name,
                exam_scheduler_enabled: currentStudy.exam_scheduler_enabled,
                transit_duration_hours: currentStudy.transit_duration_hours || 4,
                transit_cost_one_way: currentStudy.transit_cost_one_way || 200,
                accommodation_cost_per_night: currentStudy.accommodation_cost_per_night || 2000,
                earliest_arrival_time: currentStudy.earliest_arrival_time,
              }}
              subjects={subjects}
              refreshTrigger={examSchedulerRefreshTrigger}
            />
          </div>
        )}

        {/* Subjects Section */}
        <StudySubjectsAdmin study={currentStudy} subjects={subjects} loading={loading} onUpdate={fetchSubjects} />
      </main>

      <TitlePageFooter />
    </div>
  )
}
