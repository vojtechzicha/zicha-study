"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, BookOpen, Clock, Trophy, Target } from "lucide-react"
import { StudyLogo } from "./study-logo"
import { StudyHeader } from "./study-header"
import { useLogoTheme } from "@/hooks/use-logo-theme"

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
  subjects: Subject[]
  studyName: string
  studyLogoUrl?: string
  onBack: () => void
}

export function StudyStatistics({ subjects, studyName, studyLogoUrl, onBack }: StudyStatisticsProps) {
  const [semesterFilter, setSemesterFilter] = useState<string>("all")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  
  // Extract and apply theme colors from logo
  const { extractedColor, isLoading: colorLoading } = useLogoTheme(studyLogoUrl)

  // Extract years and semesters for filtering
  const { years, semesters } = useMemo(() => {
    const semesterSet = new Set(subjects.map((s) => s.semester))
    const yearSet = new Set<string>()

    // Extract years from semesters
    subjects.forEach((subject) => {
      const match = subject.semester.match(/(\d+)\.\s*ročník/i)
      if (match) {
        yearSet.add(`${match[1]}. ročník`)
      }
    })

    // Sort semesters properly (ZS before LS)
    const sortedSemesters = Array.from(semesterSet).sort((a, b) => {
      const getSemesterOrder = (semester: string) => {
        const match = semester.match(/(\d+)\.\s*ročník\s*(ZS|LS)/i)
        if (match) {
          const year = Number.parseInt(match[1])
          const semesterType = match[2].toUpperCase()
          return year * 10 + (semesterType === "ZS" ? 1 : 2)
        }
        return 999
      }
      return getSemesterOrder(a) - getSemesterOrder(b)
    })

    const sortedYears = Array.from(yearSet).sort((a, b) => {
      const aYear = Number.parseInt(a.match(/(\d+)/)?.[1] || "0")
      const bYear = Number.parseInt(b.match(/(\d+)/)?.[1] || "0")
      return aYear - bYear
    })

    return { years: sortedYears, semesters: sortedSemesters }
  }, [subjects])

  const departments = useMemo(() => {
    const unique = [...new Set(subjects.map((s) => s.department).filter((dept): dept is string => Boolean(dept)))].sort()
    return unique
  }, [subjects])

  const subjectTypes = ["Povinný", "Povinně volitelný", "Volitelný", "Ostatní"]

  // Filter subjects based on selected filters
  const filteredSubjects = useMemo(() => {
    return subjects.filter((subject) => {
      // Handle semester/year filtering
      if (semesterFilter !== "all") {
        if (semesterFilter.includes("ročník") && !semesterFilter.includes("ZS") && !semesterFilter.includes("LS")) {
          // Year filter - include both ZS and LS of that year
          const yearMatch = semesterFilter.match(/(\d+)\.\s*ročník/i)
          if (yearMatch) {
            const year = yearMatch[1]
            const subjectYearMatch = subject.semester.match(/(\d+)\.\s*ročník/i)
            if (!subjectYearMatch || subjectYearMatch[1] !== year) return false
          }
        } else {
          // Specific semester filter
          if (subject.semester !== semesterFilter) return false
        }
      }

      if (departmentFilter !== "all" && subject.department !== departmentFilter) return false
      if (typeFilter !== "all" && subject.subject_type !== typeFilter) return false
      return true
    })
  }, [subjects, semesterFilter, departmentFilter, typeFilter])

  // Calculate main statistics
  const stats = useMemo(() => {
    const total = filteredSubjects.length
    const completed = filteredSubjects.filter((s) => s.completed).length
    const creditsCompleted = filteredSubjects.filter((s) => s.credit_completed).length
    const examsCompleted = filteredSubjects.filter((s) => s.exam_completed).length

    const subjectsWithCredits = filteredSubjects.filter((s) => s.completion_type.includes("Zp") || s.completion_type.includes("KZp"))
    const subjectsWithExams = filteredSubjects.filter((s) => s.completion_type.includes("Zk"))

    const remainingCredits = filteredSubjects.filter(
      (s) => !s.credit_completed && (s.completion_type.includes("Zp") || s.completion_type.includes("KZp")),
    ).length
    const remainingExams = filteredSubjects.filter((s) => !s.exam_completed && s.completion_type.includes("Zk")).length

    const totalCredits = filteredSubjects.reduce((sum, s) => sum + s.credits, 0)
    const completedCredits = filteredSubjects.filter((s) => s.completed).reduce((sum, s) => sum + s.credits, 0)

    const totalHours = filteredSubjects.reduce((sum, s) => sum + (s.hours || 0), 0)
    const completedHours = filteredSubjects.filter((s) => s.completed).reduce((sum, s) => sum + (s.hours || 0), 0)

    // Calculate weighted average
    const subjectsWithPoints = filteredSubjects.filter(
      (s) => s.points !== null && s.points !== undefined && s.completed,
    )
    const weightedSum = subjectsWithPoints.reduce((sum, s) => sum + s.points! * s.credits, 0)
    const totalWeights = subjectsWithPoints.reduce((sum, s) => sum + s.credits, 0)
    const weightedAverage = totalWeights > 0 ? weightedSum / totalWeights : 0

    return {
      total,
      completed,
      creditsCompleted,
      examsCompleted,
      remainingCredits,
      remainingExams,
      totalCredits,
      completedCredits,
      totalHours,
      completedHours,
      weightedAverage,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      creditCompletionRate: subjectsWithCredits.length > 0 ? (creditsCompleted / subjectsWithCredits.length) * 100 : 0,
      examCompletionRate: subjectsWithExams.length > 0 ? (examsCompleted / subjectsWithExams.length) * 100 : 0,
      totalSubjectsWithCredits: subjectsWithCredits.length,
      totalSubjectsWithExams: subjectsWithExams.length,
    }
  }, [filteredSubjects])

  // Statistics by semester
  const semesterStats = useMemo(() => {
    const stats: { [key: string]: any } = {}

    semesters.forEach((semester) => {
      const semesterSubjects = filteredSubjects.filter((s) => s.semester === semester)
      const total = semesterSubjects.length
      const completed = semesterSubjects.filter((s) => s.completed).length
      const credits = semesterSubjects.reduce((sum, s) => sum + s.credits, 0)
      const completedCredits = semesterSubjects.filter((s) => s.completed).reduce((sum, s) => sum + s.credits, 0)

      if (total > 0) {
        stats[semester] = {
          total,
          completed,
          credits,
          completedCredits,
          completionRate: (completed / total) * 100,
        }
      }
    })

    return stats
  }, [filteredSubjects, semesters])

  // Statistics by year
  const yearStats = useMemo(() => {
    const stats: { [key: string]: any } = {}

    years.forEach((year) => {
      const yearSubjects = filteredSubjects.filter((s) => {
        const yearMatch = year.match(/(\d+)\.\s*ročník/i)
        if (yearMatch) {
          const yearNum = yearMatch[1]
          const subjectYearMatch = s.semester.match(/(\d+)\.\s*ročník/i)
          return subjectYearMatch && subjectYearMatch[1] === yearNum
        }
        return false
      })

      const total = yearSubjects.length
      const completed = yearSubjects.filter((s) => s.completed).length
      const credits = yearSubjects.reduce((sum, s) => sum + s.credits, 0)
      const completedCredits = yearSubjects.filter((s) => s.completed).reduce((sum, s) => sum + s.credits, 0)

      if (total > 0) {
        stats[year] = {
          total,
          completed,
          credits,
          completedCredits,
          completionRate: (completed / total) * 100,
        }
      }
    })

    return stats
  }, [filteredSubjects, years])

  // Statistics by department
  const departmentStats = useMemo(() => {
    const stats: { [key: string]: { total: number; completed: number; credits: number; hours: number; completionRate: number } } = {}

    departments.forEach((dept) => {
      const deptSubjects = filteredSubjects.filter((s) => s.department === dept)
      const total = deptSubjects.length
      const completed = deptSubjects.filter((s) => s.completed).length
      const credits = deptSubjects.reduce((sum, s) => sum + s.credits, 0)
      const hours = deptSubjects.reduce((sum, s) => sum + (s.hours || 0), 0)

      if (total > 0) {
        stats[dept] = {
          total,
          completed,
          credits,
          hours,
          completionRate: (completed / total) * 100,
        }
      }
    })

    return stats
  }, [filteredSubjects, departments])

  // Statistics by subject type
  const typeStats = useMemo(() => {
    const stats: { [key: string]: any } = {}

    subjectTypes.forEach((type) => {
      const typeSubjects = filteredSubjects.filter((s) => s.subject_type === type)
      const total = typeSubjects.length
      const completed = typeSubjects.filter((s) => s.completed).length
      const credits = typeSubjects.reduce((sum, s) => sum + s.credits, 0)

      if (total > 0) {
        stats[type] = {
          total,
          completed,
          credits,
          completionRate: (completed / total) * 100,
        }
      }
    })

    return stats
  }, [filteredSubjects])

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Povinný":
        return "bg-red-50 text-red-700 border-red-200"
      case "Povinně volitelný":
        return "bg-yellow-50 text-yellow-700 border-yellow-200"
      case "Volitelný":
        return "bg-green-50 text-green-700 border-green-200"
      case "Ostatní":
        return "bg-gray-50 text-gray-700 border-gray-200"
      default:
        return "bg-gray-50 text-gray-700 border-gray-200"
    }
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
        title="Statistiky"
        subtitle={studyName}
        logoUrl={studyLogoUrl}
        onBack={onBack}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900">Filtry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-gray-700">Období</label>
                <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Všechna období" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechna období</SelectItem>
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year} (celý rok)
                      </SelectItem>
                    ))}
                    {semesters.map((semester) => (
                      <SelectItem key={semester} value={semester}>
                        {semester}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block text-gray-700">Katedra</label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Všechny katedry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechny katedry</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block text-gray-700">Typ předmětu</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Všechny typy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechny typy</SelectItem>
                    {subjectTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
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
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <p className="text-xs text-gray-600 mt-1">
                Dokončeno: {stats.completed} ({stats.completionRate.toFixed(1)}%)
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Zbývá zkoušek</CardTitle>
              <Target className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.remainingExams}</div>
              <p className="text-xs text-gray-600 mt-1">
                Dokončeno: {stats.examsCompleted} z {stats.totalSubjectsWithExams} ({stats.examCompletionRate.toFixed(1)}%)
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Zbývá zápočtů</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.remainingCredits}</div>
              <p className="text-xs text-gray-600 mt-1">
                Dokončeno: {stats.creditsCompleted} z {stats.totalSubjectsWithCredits} ({stats.creditCompletionRate.toFixed(1)}%)
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Vážený průměr</CardTitle>
              <Trophy className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.weightedAverage.toFixed(1)}</div>
              <p className="text-xs text-gray-600 mt-1">bodů (vážený kredity)</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">Dokončené předměty</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {stats.completed} z {stats.total}
                  </span>
                  <span className="font-medium">{stats.completionRate.toFixed(1)}%</span>
                </div>
                <Progress value={stats.completionRate} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">Získané kredity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {stats.completedCredits} z {stats.totalCredits}
                  </span>
                  <span className="font-medium">
                    {stats.totalCredits > 0 ? ((stats.completedCredits / stats.totalCredits) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <Progress
                  value={stats.totalCredits > 0 ? (stats.completedCredits / stats.totalCredits) * 100 : 0}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">Celkové hodiny</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{stats.completedHours}</p>
                <p className="text-sm text-gray-600">
                  z {stats.totalHours} hodin ({stats.totalHours > 0 ? ((stats.completedHours / stats.totalHours) * 100).toFixed(1) : 0}%)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Year Overview (when showing all periods) */}
        {semesterFilter === "all" && years.length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-8">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">Přehled podle ročníků</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {years.map((year) => {
                  const yearData = yearStats[year]
                  if (!yearData) return null
                  return (
                    <div key={year} className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium text-gray-900">{year}</h3>
                        <Badge variant="outline" className="bg-white">
                          {yearData.completed}/{yearData.total} předmětů
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Dokončeno: </span>
                          <span className="font-medium">{yearData.completionRate.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Kredity: </span>
                          <span className="font-medium">
                            {yearData.completedCredits}/{yearData.credits}
                          </span>
                        </div>
                      </div>
                      <Progress value={yearData.completionRate} className="h-2 mt-2" />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Semester Breakdown */}
        {Object.keys(semesterStats).length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-8">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">Přehled podle semestrů</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(semesterStats).map(([semester, semesterData]) => (
                  <div key={semester} className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium text-gray-900">{semester}</h3>
                      <Badge variant="outline" className="bg-white">
                        {semesterData.completed}/{semesterData.total} předmětů
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Dokončeno: </span>
                        <span className="font-medium">{semesterData.completionRate.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Kredity: </span>
                        <span className="font-medium">
                          {semesterData.completedCredits}/{semesterData.credits}
                        </span>
                      </div>
                    </div>
                    <Progress value={semesterData.completionRate} className="h-2 mt-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Department Breakdown */}
        {Object.keys(departmentStats).length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-8">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">Přehled podle kateder</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(departmentStats).map(([dept, deptData]) => (
                  <div key={dept} className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium text-gray-900">{dept}</h3>
                      <Badge variant="outline" className="bg-white">
                        {deptData.completed}/{deptData.total} předmětů
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Dokončeno: </span>
                        <span className="font-medium">{deptData.completionRate.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Kredity: </span>
                        <span className="font-medium">{deptData.credits}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Hodiny: </span>
                        <span className="font-medium">{deptData.hours}</span>
                      </div>
                    </div>
                    <Progress value={deptData.completionRate} className="h-2 mt-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subject Type Breakdown */}
        {Object.keys(typeStats).length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">Přehled podle typů předmětů</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(typeStats).map(([type, data]) => (
                  <div key={type} className={`border rounded-lg p-4 ${getTypeColor(type)}`}>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium">{type}</h3>
                      <Badge variant="outline" className="bg-white">
                        {data.completed}/{data.total}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="opacity-75">Dokončeno: </span>
                        <span className="font-medium">{data.completionRate.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="opacity-75">Kredity: </span>
                        <span className="font-medium">{data.credits}</span>
                      </div>
                    </div>
                    <Progress value={data.completionRate} className="h-2 mt-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
