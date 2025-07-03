"use client"

import { useState, useEffect } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, BookOpen, Calculator, Calendar } from "lucide-react"
import { SubjectForm } from "@/components/subject-form"
import { SubjectTable } from "@/components/subject-table"

interface Study {
  id: string
  name: string
  type: string
  start_year: number
  end_year?: number
  status: "active" | "completed" | "paused"
  created_at: string
}

interface Subject {
  id: string
  study_id: string
  semester: string
  abbreviation: string
  name: string
  completion_type: string
  credits: number
  points: number
  completed: boolean
  exam_completed: boolean
  credit_completed: boolean
  exam_date?: string
  credit_date?: string
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
  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchSubjects()
  }, [study.id])

  const fetchSubjects = async () => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200"
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "paused":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Aktivní"
      case "completed":
        return "Dokončeno"
      case "paused":
        return "Pozastaveno"
      default:
        return status
    }
  }

  const totalCredits = subjects.reduce((sum, subject) => sum + subject.credits, 0)
  const completedSubjects = subjects.filter((s) => s.completed).length

  const completedSubjectsWithPoints = subjects.filter((s) => s.completed && s.points > 0)
  const weightedAverage =
    completedSubjectsWithPoints.length > 0
      ? completedSubjectsWithPoints.reduce((sum, subject) => sum + subject.points * subject.credits, 0) /
        completedSubjectsWithPoints.reduce((sum, subject) => sum + subject.credits, 0)
      : 0

  if (showSubjectForm) {
    return (
      <SubjectForm
        study={study}
        onClose={() => setShowSubjectForm(false)}
        onSuccess={() => {
          setShowSubjectForm(false)
          fetchSubjects()
        }}
      />
    )
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
              <div>
                <h1 className="text-xl font-bold text-gray-900">{study.name}</h1>
                <p className="text-sm text-gray-600">{study.type}</p>
              </div>
              <Badge className={getStatusColor(study.status)}>{getStatusText(study.status)}</Badge>
            </div>
            <Button
              onClick={() => setShowSubjectForm(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Přidat předmět
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Celkem předmětů</CardTitle>
              <BookOpen className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{subjects.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Dokončeno</CardTitle>
              <Calendar className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{completedSubjects}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Celkem kreditů</CardTitle>
              <Calculator className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{totalCredits}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Vážený průměr bodů</CardTitle>
              <Calculator className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{weightedAverage.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Subjects Table */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900">Předměty</CardTitle>
            <CardDescription>Přehled všech předmětů ve studiu</CardDescription>
          </CardHeader>
          <CardContent>
            <SubjectTable subjects={subjects} loading={loading} onUpdate={fetchSubjects} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
