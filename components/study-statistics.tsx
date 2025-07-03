"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BookOpen, Calendar, GraduationCap, Target, TrendingUp, Users, Building } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface Study {
  id: string
  name: string
  type: string
  form: string
  start_year: number
  end_year?: number
  status: "active" | "completed" | "paused" | "abandoned"
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

interface StudyStatisticsProps {
  study: Study
  onBack: () => void
}

export function StudyStatistics({ study, onBack }: StudyStatisticsProps) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSemester, setSelectedSemester] = useState<string>("all")
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all")
  const [selectedSubjectType, setSelectedSubjectType] = useState<string>("all")
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

  const filteredSubjects = useMemo(() => {
    return subjects.filter((subject) => {
      if (selectedSemester !== "all" && subject.semester !== selectedSemester) return false
      if (selectedDepartment !== "all" && subject.department !== selectedDepartment) return false
      if (selectedSubjectType !== "all" && subject.subject_type !== selectedSubjectType) return false
      return true
    })
  }, [subjects, selectedSemester, selectedDepartment, selectedSubjectType])

  const statistics = useMemo(() => {
    const total = filteredSubjects.length
    const completed = filteredSubjects.filter((s) => s.completed).length
    const withCreditsOnly = filteredSubjects.filter((s) => s.credit_completed && !s.exam_completed).length
    const withExamsOnly = filteredSubjects.filter((s) => s.exam_completed && !s.credit_completed).length
    const pendingCredits = filteredSubjects.filter(
      (s) => !s.credit_completed && (s.completion_type.includes("Zp") || s.completion_type.includes("KZp")),
    ).length
    const pendingExams = filteredSubjects.filter((s) => !s.exam_completed && s.completion_type.includes("Zk")).length

    const totalCredits = filteredSubjects.reduce((sum, s) => sum + s.credits, 0)
    const completedCredits = filteredSubjects.filter((s) => s.completed).reduce((sum, s) => sum + s.credits, 0)
    const totalHours = filteredSubjects.reduce((sum, s) => sum + (s.hours || 0), 0)

    const subjectsWithPoints = filteredSubjects.filter((s) => s.completed && s.points && s.points > 0)
    const weightedAverage =
      subjectsWithPoints.length > 0
        ? subjectsWithPoints.reduce((sum, s) => sum + s.points! * s.credits, 0) /
          subjectsWithPoints.reduce((sum, s) => sum + s.credits, 0)
        : 0

    const gradeDistribution = filteredSubjects
      .filter((s) => s.grade)
      .reduce(
        (acc, s) => {
          acc[s.grade!] = (acc[s.grade!] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )

    const semesterStats = filteredSubjects.reduce(
      (acc, s) => {
        if (!acc[s.semester]) {
          acc[s.semester] = { total: 0, completed: 0, credits: 0, completedCredits: 0 }
        }
        acc[s.semester].total++
        acc[s.semester].credits += s.credits
        if (s.completed) {
          acc[s.semester].completed++
          acc[s.semester].completedCredits += s.credits
        }
        return acc
      },
      {} as Record<string, { total: number; completed: number; credits: number; completedCredits: number }>,
    )

    const departmentStats = filteredSubjects
      .filter((s) => s.department)
      .reduce(
        (acc, s) => {
          if (!acc[s.department!]) {
            acc[s.department!] = { total: 0, completed: 0, credits: 0 }
          }
          acc[s.department!].total++
          acc[s.department!].credits += s.credits
          if (s.completed) {
            acc[s.department!].completed++
          }
          return acc
        },
        {} as Record<string, { total: number; completed: number; credits: number }>,
      )

    const subjectTypeStats = filteredSubjects.reduce(
      (acc, s) => {
        if (!acc[s.subject_type]) {
          acc[s.subject_type] = { total: 0, completed: 0, credits: 0 }
        }
        acc[s.subject_type].total++
        acc[s.subject_type].credits += s.credits
        if (s.completed) {
          acc[s.subject_type].completed++
        }
        return acc
      },
      {} as Record<string, { total: number; completed: number; credits: number }>,
    )

    return {
      total,
      completed,
      withCreditsOnly,
      withExamsOnly,
      pendingCredits,
      pendingExams,
      totalCredits,
      completedCredits,
      totalHours,
      weightedAverage,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      creditCompletionRate: totalCredits > 0 ? (completedCredits / totalCredits) * 100 : 0,
      gradeDistribution,
      semesterStats,
      departmentStats,
      subjectTypeStats,
    }
  }, [filteredSubjects])

  const uniqueSemesters = [...new Set(subjects.map((s) => s.semester))].sort()
  const uniqueDepartments = [...new Set(subjects.map((s) => s.department).filter(Boolean))].sort()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Načítání statistik...</p>
        </div>
      </div>
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
                <h1 className="text-xl font-bold text-gray-900">Statistiky - {study.name}</h1>
                <p className="text-sm text-gray-600">Detailní přehled vašeho studia</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900">Filtry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Semestr</label>
                <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                  <SelectTrigger>
                    <SelectValue placeholder="Všechny semestry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechny semestry</SelectItem>
                    {uniqueSemesters.map((semester) => (
                      <SelectItem key={semester} value={semester}>
                        {semester}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Katedra</label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Všechny katedry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechny katedry</SelectItem>
                    {uniqueDepartments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Typ předmětu</label>
                <Select value={selectedSubjectType} onValueChange={setSelectedSubjectType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Všechny typy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechny typy</SelectItem>
                    <SelectItem value="Povinný">Povinný</SelectItem>
                    <SelectItem value="Povinně volitelný">Povinně volitelný</SelectItem>
                    <SelectItem value="Volitelný">Volitelný</SelectItem>
                    <SelectItem value="Ostatní">Ostatní</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Celkem předmětů</CardTitle>
              <BookOpen className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{statistics.total}</div>
              <p className="text-xs text-gray-600 mt-1">
                Dokončeno: {statistics.completed} ({statistics.completionRate.toFixed(1)}%)
              </p>
              <Progress value={statistics.completionRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Zbývající zkoušky</CardTitle>
              <GraduationCap className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{statistics.pendingExams}</div>
              <p className="text-xs text-gray-600 mt-1">Zbývající zápočty: {statistics.pendingCredits}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Kredity</CardTitle>
              <Target className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {statistics.completedCredits}/{statistics.totalCredits}
              </div>
              <p className="text-xs text-gray-600 mt-1">Dokončeno: {statistics.creditCompletionRate.toFixed(1)}%</p>
              <Progress value={statistics.creditCompletionRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Vážený průměr</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{statistics.weightedAverage.toFixed(2)}</div>
              <p className="text-xs text-gray-600 mt-1">Celkem hodin: {statistics.totalHours}</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Semester Statistics */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Statistiky podle semestrů
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(statistics.semesterStats).map(([semester, stats]) => (
                  <div key={semester} className="border-b border-gray-200 pb-3 last:border-b-0">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-900">{semester}</h4>
                      <Badge variant="outline">
                        {stats.completed}/{stats.total}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      Kredity: {stats.completedCredits}/{stats.credits}
                    </div>
                    <Progress value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Department Statistics */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center">
                <Building className="mr-2 h-5 w-5" />
                Statistiky podle kateder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(statistics.departmentStats).map(([department, stats]) => (
                  <div key={department} className="border-b border-gray-200 pb-3 last:border-b-0">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-900 text-sm">{department}</h4>
                      <Badge variant="outline">
                        {stats.completed}/{stats.total}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">Kredity: {stats.credits}</div>
                    <Progress value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subject Type Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center">
                <Users className="mr-2 h-5 w-5" />
                Statistiky podle typu předmětu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(statistics.subjectTypeStats).map(([type, stats]) => (
                  <div key={type} className="border-b border-gray-200 pb-3 last:border-b-0">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-900">{type}</h4>
                      <Badge variant="outline">
                        {stats.completed}/{stats.total}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">Kredity: {stats.credits}</div>
                    <Progress value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Grade Distribution */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center">
                <TrendingUp className="mr-2 h-5 w-5" />
                Rozložení známek
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(statistics.gradeDistribution)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([grade, count]) => (
                    <div key={grade} className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">{grade}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(count / Math.max(...Object.values(statistics.gradeDistribution))) * 100}%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
