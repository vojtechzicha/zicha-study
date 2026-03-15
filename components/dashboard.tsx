"use client"

import { useState, useEffect, useCallback } from "react"
import type { User } from "next-auth"
import { signOut } from "next-auth/react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GraduationCap, Plus, BookOpen, TrendingUp, LogOut, Settings, Edit, FileSpreadsheet, RefreshCw } from "lucide-react"
import { StudyLogo } from "@/components/study-logo"
import { useRouter } from "next/navigation"
import { Study, getStatusColor, getStatusText, sortStudiesByStatus } from "@/lib/status-utils"
import { getStudyFormLabel } from "@/lib/constants"
import { exportStudiesToExcel } from "@/lib/utils/export-excel"
import { regenerateAllStudyNotes } from "@/lib/utils/regenerate-study-notes"
import { useToast } from "@/hooks/use-toast"

interface DashboardProps {
  user: User
}

export function Dashboard({ user }: DashboardProps) {
  const [studies, setStudies] = useState<Study[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  const fetchStudies = useCallback(async () => {
    const { data, error } = await supabase.from("studies").select("*")

    if (!error && data) {
      // Sort studies by status priority, then by created_at
      const sortedStudies = sortStudiesByStatus(data)
      setStudies(sortedStudies)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchStudies()
  }, [fetchStudies])

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportStudiesToExcel()
      toast({
        title: "Export úspěšný",
        description: "Excel soubor byl úspěšně stažen.",
      })
    } catch (error) {
      console.error("Export failed:", error)
      toast({
        title: "Export selhal",
        description: error instanceof Error ? error.message : "Nepodařilo se exportovat data.",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const handleRegenerateNotes = async () => {
    setRegenerating(true)
    try {
      const result = await regenerateAllStudyNotes()

      if (result.success) {
        toast({
          title: "Regenerace dokončena",
          description: result.message,
        })
      } else {
        toast({
          title: "Regenerace selhala",
          description: result.message,
          variant: "destructive",
        })
      }

      if (result.errors) {
        console.error("Regeneration errors:", result.errors)
      }
    } catch (error) {
      console.error("Regeneration failed:", error)
      toast({
        title: "Regenerace selhala",
        description: "Nepodařilo se regenerovat studijní zápisy.",
        variant: "destructive",
      })
    } finally {
      setRegenerating(false)
    }
  }


  const getUserDisplayName = () => {
    if (user.name) {
      return user.name
    }
    return user.email?.split("@")[0] || "Uživatel"
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Sledování studií</h1>
                <p className="text-sm text-gray-600">Vítejte, {getUserDisplayName()}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                disabled={exporting || studies.length === 0}
                title="Export studií do Excelu"
              >
                {exporting ? (
                  <Settings className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerateNotes}
                disabled={regenerating || studies.length === 0}
                title="Regenerovat všechny studijní zápisy"
              >
                {regenerating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
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
              <BookOpen className="h-4 w-4 text-primary-600" />
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
            onClick={() => router.push("/studies/new")}
            className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"
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
                  <div className="h-4 bg-primary-200 rounded w-3/4"></div>
                  <div className="h-3 bg-primary-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-3 bg-primary-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-primary-200 rounded w-2/3"></div>
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
                onClick={() => router.push("/studies/new")}
                className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
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
                    <div className="flex items-start gap-3 flex-1 min-w-0" onClick={() => router.push(`/studies/${study.id}`)}>
                      <StudyLogo logoUrl={study.logo_url} studyName={study.name} size="lg" />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors leading-tight break-words">
                          {study.name}
                        </CardTitle>
                        <CardDescription className="text-gray-600 text-sm mt-1">
                          {study.type} • {getStudyFormLabel(study.form)}
                        </CardDescription>
                        <div className="flex gap-1 mt-2">
                          <Badge className={getStatusColor(study.status)}>{getStatusText(study.status)}</Badge>
                          {study.is_public && (
                            <Badge variant="outline" className="bg-primary-50 text-primary-700 border-primary-200">
                              Veřejné
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/studies/${study.id}/edit`)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent onClick={() => router.push(`/studies/${study.id}`)}>
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
