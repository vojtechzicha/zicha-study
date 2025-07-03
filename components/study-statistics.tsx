"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, BookOpen, Clock, Trophy, Target } from "lucide-react"

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
  onBack: () => void
}

export function StudyStatistics({ subjects, studyName, onBack }: StudyStatisticsProps) {
  const [semesterFilter, setSemesterFilter] = useState<string>("all")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")

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
    const unique = [...new Set(subjects.map((s) => s.department).filter(Boolean))].sort()
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

    const remainingCredits = filteredSubjects.filter(
      (s) => !s.credit_completed && (s.completion_type.includes("Zp") || s.completion_type.includes("KZp")),
    ).length
    const remainingExams = filteredSubjects.filter((s) => !s.exam_completed && s.completion_type.includes("Zk")).length

    const totalCredits = filteredSubjects.reduce((sum, s) => sum + s.credits, 0)
    const completedCredits = filteredSubjects.filter((s) => s.completed).reduce((sum, s) => sum + s.credits, 0)

    const totalHours = filteredSubjects.reduce((sum, s) => sum + (s.hours || 0), 0)

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
      weightedAverage,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      creditCompletionRate: total > 0 ? (creditsCompleted / total) * 100 : 0,
      examCompletionRate: total > 0 ? (examsCompleted / total) * 100 : 0,
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
    const stats: { [key: string]: any } = {}

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="p-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Statistiky</h1>
          <p className="text-gray-600">{studyName}</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Období</label>
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
              <label className="text-sm font-medium mb-2 block">Katedra</label>
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
              <label className="text-sm font-medium mb-2 block">Typ předmětu</label>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-600">Celkem předmětů</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{stats.remainingExams}</p>
                <p className="text-sm text-gray-600">Zbývá zkoušek</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{stats.remainingCredits}</p>
                <p className="text-sm text-gray-600">Zbývá zápočtů</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats.weightedAverage.toFixed(1)}</p>
                <p className="text-sm text-gray-600">Vážený průměr</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dokončené předměty</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {stats.completed} z {stats.total}
                </span>
                <span>{stats.completionRate.toFixed(1)}%</span>
              </div>
              <Progress value={stats.completionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Získané kredity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {stats.completedCredits} z {stats.totalCredits}
                </span>
                <span>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Celkové hodiny</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.totalHours}</p>
              <p className="text-sm text-gray-600">hodin výuky</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Year Overview (when showing all periods) */}
      {semesterFilter === "all" && years.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Přehled podle ročníků</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {years.map((year) => {
                const yearData = yearStats[year]
                if (!yearData) return null
                return (
                  <div key={year} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium">{year}</h3>
                      <Badge variant="outline">
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Přehled podle semestrů</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(semesterStats).map(([semester, semesterData]) => (
                <div key={semester} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">{semester}</h3>
                    <Badge variant="outline">
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Přehled podle kateder</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(departmentStats).map(([dept, deptData]) => (
                <div key={dept} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">{dept}</h3>
                    <Badge variant="outline">
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Přehled podle typů předmětů</CardTitle>
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
    </div>
  )
}
