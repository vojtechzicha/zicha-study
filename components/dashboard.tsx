"use client"

import { useState, useEffect } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GraduationCap, Plus, BookOpen, TrendingUp, LogOut, Settings, Edit } from "lucide-react"
import { StudyForm } from "@/components/study-form"
import { StudyDetail } from "@/components/study-detail"
import { StudyEditForm } from "@/components/study-edit-form"
import { StudySettings } from "@/components/study-settings"
import { StudyLogo } from "@/components/study-logo"

interface Study {
  id: string
  name: string
  type: string
  form: string
  start_year: number
  end_year?: number
  status: "active" | "completed" | "paused" | "abandoned"
  logo_url?: string
  is_public?: boolean
  public_slug?: string
  created_at: string
}

interface DashboardProps {
  user: User
}

export function Dashboard({ user }: DashboardProps) {
  const [studies, setStudies] = useState<Study[]>([])
  const [showStudyForm, setShowStudyForm] = useState(false)
  const [selectedStudy, setSelectedStudy] = useState<Study | null>(null)
  const [editingStudy, setEditingStudy] = useState<Study | null>(null)
  const [settingsStudy, setSettingsStudy] = useState<Study | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchStudies()
  }, [])

  const fetchStudies = async () => {
    const { data, error } = await supabase.from("studies").select("*").order("created_at", { ascending: false })

    if (!error && data) {
      setStudies(data)
    }
    setLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200"
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "paused":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "abandoned":
        return "bg-red-100 text-red-800 border-red-200"
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
      case "abandoned":
        return "Zanechaný"
      default:
        return status
    }
  }

  const getUserDisplayName = () => {
    if (user.user_metadata?.full_name) {
      return user.user_metadata.full_name
    }
    if (user.user_metadata?.name) {
      return user.user_metadata.name
    }
    return user.email?.split("@")[0] || "Uživatel"
  }

  if (selectedStudy) {
    return <StudyDetail study={selectedStudy} onBack={() => setSelectedStudy(null)} user={user} />
  }

  if (showStudyForm) {
    return (
      <StudyForm
        onClose={() => setShowStudyForm(false)}
        onSuccess={() => {
          setShowStudyForm(false)
          fetchStudies()
        }}
      />
    )
  }

  if (editingStudy) {
    return (
      <StudyEditForm
        study={editingStudy}
        onClose={() => setEditingStudy(null)}
        onSuccess={() => {
          setEditingStudy(null)
          fetchStudies()
        }}
      />
    )
  }

  if (settingsStudy) {
    return (
      <StudySettings
        study={settingsStudy}
        onClose={() => setSettingsStudy(null)}
        onSuccess={() => {
          setSettingsStudy(null)
          fetchStudies()
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
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Sledování studií</h1>
                <p className="text-sm text-gray-600">Vítejte, {getUserDisplayName()}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Celkem studií</CardTitle>
              <BookOpen className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{studies.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Aktivní studia</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {studies.filter((s) => s.status === "active").length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Dokončená studia</CardTitle>
              <GraduationCap className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {studies.filter((s) => s.status === "completed").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Studies List */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Vaše studia</h2>
          <Button
            onClick={() => setShowStudyForm(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="mr-2 h-4 w-4" />
            Přidat studium
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : studies.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="text-center py-12">
              <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Zatím nemáte žádná studia</h3>
              <p className="text-gray-600 mb-6">Začněte přidáním vašeho prvního studia</p>
              <Button
                onClick={() => setShowStudyForm(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Přidat studium
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studies.map((study) => (
              <Card
                key={study.id}
                className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer group relative"
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3 flex-1" onClick={() => setSelectedStudy(study)}>
                      <StudyLogo logoUrl={study.logo_url} studyName={study.name} size="lg" />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                          {study.name}
                        </CardTitle>
                        <CardDescription className="text-gray-600">
                          {study.type} • {study.form}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-1">
                        <Badge className={getStatusColor(study.status)}>{getStatusText(study.status)}</Badge>
                        {study.is_public && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Veřejné
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingStudy(study)
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent onClick={() => setSelectedStudy(study)}>
                  <div className="text-sm text-gray-600">
                    <p>Začátek: {study.start_year}</p>
                    {study.end_year && <p>Konec: {study.end_year}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// Export both default and named export for compatibility
export default Dashboard
