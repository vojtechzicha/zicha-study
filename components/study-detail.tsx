"use client"

import { useState, useEffect, useMemo } from "react"
import { fetchSubjectsByStudyId } from "@/lib/actions/subjects"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, BarChart3, BookOpen, Edit, Settings, Search, Filter } from "lucide-react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { SubjectForm } from "./subject-form"
import { SubjectTable } from "./subject-table"
import { StudyHeader } from "./study-header"
import { MaterialsSection } from "./materials-section"
import { StudyNotesDisplaySection } from "./study-notes-display-section"
import { FinalExamsList } from "./final-exams-list"
import { ExamSchedulerSection } from "./exam-scheduler-section"
import { StudyStatisticsCards } from "./study-statistics-cards"
import { DiplomaShowcase } from "./diploma-showcase"
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
  logo_url?: string
  diploma_url?: string | null
  diploma_mime_type?: string
  diploma_uploaded_at?: string
  is_public?: boolean
  public_slug?: string
  final_exams_enabled?: boolean
  exam_scheduler_enabled?: boolean
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
  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [currentStudy] = useState<Study>(study)
  const [searchQuery, setSearchQuery] = useState("")
  const [showActiveOnly, setShowActiveOnly] = useState(false)
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

  const handleSubjectAdded = () => {
    setShowSubjectForm(false)
    fetchSubjects()
  }

  // Filter subjects based on search query and active filter
  const filteredSubjects = useMemo(() => {
    let filtered = subjects
    
    // Apply active filter first
    if (showActiveOnly) {
      filtered = subjects.filter(s => !s.completed && !s.planned)
    }
    
    // Then apply search filter
    if (!searchQuery.trim()) {
      return filtered
    }

    const query = searchQuery.toLowerCase().trim()
    return filtered.filter(subject => {
      const searchableFields = [
        subject.name?.toLowerCase() || '',
        subject.abbreviation?.toLowerCase() || '',
        subject.department?.toLowerCase() || '',
        subject.lecturer?.toLowerCase() || '',
        subject.completion_type?.toLowerCase() || '',
        subject.subject_type?.toLowerCase() || '',
        subject.semester?.toLowerCase() || ''
      ]
      
      return searchableFields.some(field => field.includes(query))
    })
  }, [subjects, searchQuery, showActiveOnly])

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
        <StudyStatisticsCards subjects={subjects} variant="simple" />

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
            <FinalExamsList studyId={study.id} studySlug={currentStudy.public_slug} onUpdate={fetchSubjects} />
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
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary-600" />
                  <CardTitle className="text-xl font-bold text-gray-900">Předměty</CardTitle>
                </div>
                <p className="text-sm text-gray-600 mt-1 ml-7">
                  {(searchQuery || showActiveOnly) ? (
                    `Zobrazeno ${filteredSubjects.length} z ${subjects.length} předmětů`
                  ) : (
                    "Přehled všech předmětů ve studiu"
                  )}
                </p>
              </div>
              {/* Search Input with Filter and Add button - Right side on desktop, below on mobile */}
              <div className="w-full md:w-auto relative flex gap-2 items-center">
                <div className="flex-1 md:flex-initial md:w-64 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Hledat v předmětech..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowActiveOnly(!showActiveOnly)}
                  className={`h-10 w-10 p-0 flex-shrink-0 ${
                    showActiveOnly 
                      ? 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700' 
                      : 'text-gray-600 hover:bg-primary-100 hover:text-gray-900'
                  }`}
                  title={showActiveOnly ? "Zobrazit všechny předměty" : "Zobrazit pouze aktivní předměty"}
                >
                  <Filter className={`h-4 w-4 ${
                    showActiveOnly ? 'text-white' : 'text-gray-600'
                  }`} />
                </Button>
                <Button 
                  onClick={() => setShowSubjectForm(true)} 
                  size="sm"
                  className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Přidat předmět</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <SubjectTable subjects={filteredSubjects} loading={loading} onUpdate={fetchSubjects} hideFilters study={study} />
          </CardContent>
        </Card>
      </main>

      {/* Subject Form Modal */}
      <Dialog open={showSubjectForm} onOpenChange={setShowSubjectForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <SubjectForm study={study} onSuccess={handleSubjectAdded} onClose={() => setShowSubjectForm(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
