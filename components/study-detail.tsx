"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, BarChart3, BookOpen, Calendar, Target, TrendingUp, Edit, Settings } from "lucide-react"
import { SubjectForm } from "./subject-form"
import { SubjectTable } from "./subject-table"
import { StudyStatistics } from "./study-statistics"
import { StudyEditForm } from "./study-edit-form"
import { StudyLogo } from "./study-logo"
import type { User } from "@supabase/supabase-js"
import { StudySettings } from "./study-settings"

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
  const [showStatistics, setShowStatistics] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [currentStudy, setCurrentStudy] = useState<Study>(study)
  const supabase = createClient()

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
    setShowEditForm(false)
    fetchStudyData()
  }

  // Calculate statistics
  const stats = {
    total: subjects.length,
    completed: subjects.filter((s) => s.completed).length,
    totalCredits: subjects.reduce((sum, s) => sum + s.credits, 0),
    completedCredits: subjects.filter((s) => s.completed).reduce((sum, s) => sum + s.credits, 0),
    // Calculate weighted average
    weightedAverage: (() => {
      const subjectsWithPoints = subjects.filter((s) => s.points && s.completed)
      if (subjectsWithPoints.length === 0) return 0
      const weightedSum = subjectsWithPoints.reduce((sum, s) => sum + s.points! * s.credits, 0)
      const totalWeights = subjectsWithPoints.reduce((sum, s) => sum + s.credits, 0)
      return totalWeights > 0 ? weightedSum / totalWeights : 0
    })(),
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aktivní</Badge>
      case "completed":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Dokončené</Badge>
      case "paused":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pozastavené</Badge>
      case "abandoned":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Zanechaný</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (showStatistics) {
    return <StudyStatistics subjects={subjects} studyName={currentStudy.name} onBack={() => setShowStatistics(false)} />
  }

  if (showSettings) {
    return <StudySettings study={currentStudy} onBack={() => setShowSettings(false)} onSuccess={handleStudyUpdated} />
  }

  if (showEditForm) {
    return <StudyEditForm study={currentStudy} onClose={() => setShowEditForm(false)} onSuccess={handleStudyUpdated} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={onBack} className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zpět
              </Button>
              <div className="flex items-center space-x-3">
                <StudyLogo logoUrl={currentStudy.logo_url} studyName={currentStudy.name} size="lg" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{currentStudy.name}</h1>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span>{currentStudy.type}</span>
                    <span>•</span>
                    <span>{currentStudy.form}</span>
                    <span>•</span>
                    {getStatusBadge(currentStudy.status)}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => setShowEditForm(true)} className="text-gray-700">
                <Edit className="mr-2 h-4 w-4" />
                Upravit
              </Button>
              <Button variant="outline" onClick={() => setShowSettings(true)} className="text-gray-700">
                <Settings className="mr-2 h-4 w-4" />
                Sdílení
              </Button>
              <Button variant="outline" onClick={() => setShowStatistics(true)} className="text-gray-700">
                <BarChart3 className="mr-2 h-4 w-4" />
                Statistiky
              </Button>
              <Button onClick={() => setShowSubjectForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="mr-2 h-4 w-4" />
                Přidat předmět
              </Button>
            </div>
          </div>
        </div>
      </header>

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

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Vážený průměr bodů</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.weightedAverage.toFixed(2)}</div>
              <p className="text-xs text-gray-600 mt-1">průměr vážený kredity</p>
            </CardContent>
          </Card>
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
            <SubjectForm studyId={study.id} onSuccess={handleSubjectAdded} onCancel={() => setShowSubjectForm(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
