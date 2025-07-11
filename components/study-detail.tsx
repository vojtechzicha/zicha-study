"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, BarChart3, BookOpen, Calendar, Target, TrendingUp, Edit, Settings, Search, Filter } from "lucide-react"
import { SubjectForm } from "./subject-form"
import { SubjectTable } from "./subject-table"
import { StudyHeader } from "./study-header"
import { MaterialsSection } from "./materials-section"
import { StudyNotesOverviewSection } from "./study-notes-overview-section"
import { FinalExamsList } from "./final-exams-list"
import { useLogoTheme } from "@/hooks/use-logo-theme"
import { useFavicon } from "@/hooks/use-favicon"
import { calculateAverage } from "@/lib/grade-utils"
import { isSubjectFailed } from "@/lib/status-utils"
import type { User } from "@supabase/supabase-js"
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
  final_exams_enabled?: boolean
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
  final_date?: string
  created_at: string
}

interface StudyDetailProps {
  study: Study
  onBack: () => void
  user: User
}

export function StudyDetail({ study, onBack }: StudyDetailProps) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [currentStudy, setCurrentStudy] = useState<Study>(study)
  const [searchQuery, setSearchQuery] = useState("")
  const [showActiveOnly, setShowActiveOnly] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  
  // Extract and apply theme colors from logo
  useLogoTheme(currentStudy.logo_url)
  
  // Update favicon with study logo
  useFavicon(currentStudy.logo_url)

  useEffect(() => {
    const loadSubjects = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("study_id", study.id)
        .order("semester", { ascending: true })

      if (!error && data) {
        setSubjects(data)
      }
      setLoading(false)
    }
    
    loadSubjects()
  }, [study.id, supabase])

  const fetchSubjects = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("study_id", study.id)
      .order("semester", { ascending: true })

    if (!error && data) {
      setSubjects(data)
    }
    setLoading(false)
  }

  const fetchStudyData = async () => {
    const { data, error } = await supabase.from("studies").select("*").eq("id", study.id).single()

    if (!error && data) {
      setCurrentStudy(data)
    }
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

  // Calculate statistics
  const completedSubjects = subjects.filter((s) => s.completed && !isSubjectFailed(s))
  const average = calculateAverage(completedSubjects)
  
  const stats = {
    total: subjects.length,
    completed: subjects.filter((s) => s.completed).length,
    totalCredits: subjects.reduce((sum, s) => sum + s.credits, 0),
    completedCredits: completedSubjects.reduce((sum, s) => sum + s.credits, 0),
    average
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
            <Button onClick={() => setShowSubjectForm(true)} className="text-white" style={{ backgroundColor: "hsl(var(--primary-600))", "--tw-bg-opacity": "1" } as React.CSSProperties} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--primary-700))" }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--primary-600))" }} size="sm">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Přidat předmět</span>
            </Button>
          </>
        }
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Celkem předmětů</CardTitle>
              <BookOpen className="h-4 w-4 text-primary-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <p className="text-xs text-gray-600 mt-1">
                Dokončeno: {stats.completed} ({stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}
                %)
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Dokončeno</CardTitle>
              <Calendar className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
              <p className="text-xs text-gray-600 mt-1">z {stats.total} předmětů</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Celkem kreditů</CardTitle>
              <Target className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.completedCredits}</div>
              <p className="text-xs text-gray-600 mt-1">z {stats.totalCredits} kreditů</p>
            </CardContent>
          </Card>

          {stats.average.type !== 'none' && (
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{stats.average.label}</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                {stats.average.type === 'both' ? (
                  <div className="space-y-2">
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {stats.average.pointsValue ? stats.average.pointsValue.toFixed(2) : '-'}
                      </div>
                      <p className="text-xs text-gray-600">body (vážené kredity)</p>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {stats.average.gradeValue ? stats.average.gradeValue.toFixed(2) : '-'}
                      </div>
                      <p className="text-xs text-gray-600">známky (vážené kredity)</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.average.value ? stats.average.value.toFixed(2) : '-'}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">průměr vážený kredity</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Materials Section */}
        <div className="mb-8">
          <MaterialsSection studyId={study.id} study={study} />
        </div>

        {/* Study Notes Section */}
        <div className="mb-8">
          <StudyNotesOverviewSection studyId={study.id} study={study} />
        </div>

        {/* Final Exams Section */}
        {currentStudy.final_exams_enabled && (
          <div className="mb-8">
            <FinalExamsList studyId={study.id} onUpdate={fetchSubjects} />
          </div>
        )}

        {/* Subjects Section */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div className="flex-1">
                <CardTitle className="text-xl font-bold text-gray-900">Předměty</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {(searchQuery || showActiveOnly) ? (
                    `Zobrazeno ${filteredSubjects.length} z ${subjects.length} předmětů`
                  ) : (
                    "Přehled všech předmětů ve studiu"
                  )}
                </p>
              </div>
              {/* Search Input with Filter - Right side on desktop, below on mobile */}
              <div className="w-full md:w-80 relative flex gap-2 items-center">
                <div className="flex-1 relative">
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
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SubjectTable subjects={filteredSubjects} loading={loading} onUpdate={fetchSubjects} hideFilters study={study} />
          </CardContent>
        </Card>
      </main>

      {/* Subject Form Modal */}
      {showSubjectForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <SubjectForm study={study} onSuccess={handleSubjectAdded} onClose={() => setShowSubjectForm(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
