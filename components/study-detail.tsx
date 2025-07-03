"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, BarChart3, BookOpen, Calendar, Target, TrendingUp, Edit, Settings } from "lucide-react"
import { SubjectForm } from "./subject-form"
import { SubjectTable } from "./subject-table"
import { StudyLogo } from "./study-logo"
import { StudyHeader } from "./study-header"
import { useLogoTheme } from "@/hooks/use-logo-theme"
import { calculateAverage } from "@/lib/grade-utils"
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

export function StudyDetail({ study, onBack, user }: StudyDetailProps) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [currentStudy, setCurrentStudy] = useState<Study>(study)
  const supabase = createClient()
  const router = useRouter()
  
  // Extract and apply theme colors from logo
  const { extractedColor, isLoading: colorLoading } = useLogoTheme(currentStudy.logo_url)

  useEffect(() => {
    fetchSubjects()
  }, [study.id])

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

  const handleStudyUpdated = () => {
    fetchStudyData()
  }

  // Calculate statistics
  const completedSubjects = subjects.filter((s) => s.completed)
  const average = calculateAverage(completedSubjects)
  
  const stats = {
    total: subjects.length,
    completed: completedSubjects.length,
    totalCredits: subjects.reduce((sum, s) => sum + s.credits, 0),
    completedCredits: completedSubjects.reduce((sum, s) => sum + s.credits, 0),
    average
  }



  return (
    <div 
      className="min-h-screen" 
      style={{ 
        background: `linear-gradient(to bottom right, var(--primary-50, hsl(217, 100%, 95%)), var(--primary-100, hsl(217, 100%, 90%)))`,
        minHeight: "100vh"
      } as React.CSSProperties}
    >
      <StudyHeader 
        study={currentStudy}
        onBack={onBack}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push(`/studies/${study.id}/edit`)} className="text-gray-700">
              <Edit className="mr-2 h-4 w-4" />
              Upravit
            </Button>
            <Button variant="outline" onClick={() => router.push(`/studies/${study.id}/settings`)} className="text-gray-700">
              <Settings className="mr-2 h-4 w-4" />
              Sdílení
            </Button>
            <Button variant="outline" onClick={() => router.push(`/studies/${study.id}/statistics`)} className="text-gray-700">
              <BarChart3 className="mr-2 h-4 w-4" />
              Statistiky
            </Button>
            <Button onClick={() => setShowSubjectForm(true)} className="text-white" style={{ backgroundColor: "var(--primary-600)", "--tw-bg-opacity": "1" } as React.CSSProperties} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-700)" }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-600)" }}>
              <Plus className="mr-2 h-4 w-4" />
              Přidat předmět
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
              <BookOpen className="h-4 w-4 text-blue-600" />
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

        {/* Subjects Section */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">Předměty</CardTitle>
                <p className="text-sm text-gray-600 mt-1">Přehled všech předmětů ve studiu</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SubjectTable subjects={subjects} loading={loading} onUpdate={fetchSubjects} />
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
