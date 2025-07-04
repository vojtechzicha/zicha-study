"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StudyLogo } from "./study-logo"
import { useLogoTheme } from "@/hooks/use-logo-theme"
import { BookOpen, Target, Clock, Trophy } from "lucide-react"
import { 
  getStatusColor, 
  getStatusText, 
  StudyStatus,
  getSubjectStatus,
  getSubjectStateColor,
  getSubjectStateText,
  isFieldVisibleForState,
  getCompletionBadgeConfig,
  isSubjectFailed
} from "@/lib/status-utils"
import { calculateAverage, getUniqueSemesters } from "@/lib/grade-utils"

interface Study {
  id: string
  name: string
  type: string
  form: string
  start_year: number
  end_year?: number
  status: StudyStatus
  logo_url?: string
  public_description?: string
  last_updated?: string
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
}

interface PublicStudyViewProps {
  study: Study
  subjects: Subject[]
}

const sortSubjects = (subjects: Subject[]) => {
  const typeOrder = {
    Povinný: 1,
    "Povinně volitelný": 2,
    Volitelný: 3,
    Ostatní: 4,
  }

  // Get subject status priority (Active > Completed > Planned)
  const getStatusPriority = (subject: Subject) => {
    if (subject.planned) return 3  // Planned
    if (subject.completed) return 2  // Completed
    return 1  // Active
  }

  const getSemesterOrder = (semester: string) => {
    const match = semester.match(/(\d+)\.\s*ročník\s*(ZS|LS)/i)
    if (match) {
      const year = Number.parseInt(match[1])
      const semesterType = match[2].toUpperCase()
      return year * 10 + (semesterType === "ZS" ? 1 : 2)
    }
    return 999
  }

  return [...subjects].sort((a, b) => {
    // First sort by status priority (Active > Completed > Planned)
    const aStatusPriority = getStatusPriority(a)
    const bStatusPriority = getStatusPriority(b)
    if (aStatusPriority !== bStatusPriority) {
      return aStatusPriority - bStatusPriority
    }

    const aSemesterOrder = getSemesterOrder(a.semester)
    const bSemesterOrder = getSemesterOrder(b.semester)
    if (aSemesterOrder !== bSemesterOrder) {
      return aSemesterOrder - bSemesterOrder
    }

    const aTypeOrder = typeOrder[a.subject_type as keyof typeof typeOrder] || 5
    const bTypeOrder = typeOrder[b.subject_type as keyof typeof typeOrder] || 5
    if (aTypeOrder !== bTypeOrder) {
      return aTypeOrder - bTypeOrder
    }

    return a.name.localeCompare(b.name, "cs")
  })
}

export function PublicStudyView({ study, subjects }: PublicStudyViewProps) {
  // Extract and apply theme colors from logo
  const { extractedColor, isLoading: colorLoading } = useLogoTheme(study.logo_url)

  // Calculate statistics
  const stats = useMemo(() => {
    const total = subjects.length
    const completed = subjects.filter((s) => s.completed).length
    const creditsCompleted = subjects.filter((s) => s.credit_completed).length
    const examsCompleted = subjects.filter((s) => s.exam_completed).length

    const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0)
    const completedCredits = subjects.filter((s) => s.completed && !isSubjectFailed(s)).reduce((sum, s) => sum + s.credits, 0)
    const totalHours = subjects.reduce((sum, s) => sum + (s.hours || 0), 0)
    const completedHours = subjects.filter((s) => s.completed).reduce((sum, s) => sum + (s.hours || 0), 0)

    // Calculate weighted average using new utility
    const completedSubjects = subjects.filter(s => s.completed && !isSubjectFailed(s))
    const average = calculateAverage(completedSubjects)

    const subjectsWithCredits = subjects.filter((s) => s.completion_type.includes("Zp") || s.completion_type.includes("KZp"))
    const subjectsWithExams = subjects.filter((s) => s.completion_type.includes("Zk"))
    
    const remainingCredits = subjects.filter(
      (s) => !s.credit_completed && (s.completion_type.includes("Zp") || s.completion_type.includes("KZp")),
    ).length
    const remainingExams = subjects.filter((s) => !s.exam_completed && s.completion_type.includes("Zk")).length

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
      average,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      creditCompletionRate: subjectsWithCredits.length > 0 ? (creditsCompleted / subjectsWithCredits.length) * 100 : 0,
      examCompletionRate: subjectsWithExams.length > 0 ? (examsCompleted / subjectsWithExams.length) * 100 : 0,
      totalSubjectsWithCredits: subjectsWithCredits.length,
      totalSubjectsWithExams: subjectsWithExams.length,
    }
  }, [subjects])

  // Group subjects by semester with averages
  const subjectsBySemester = useMemo(() => {
    const grouped: { [key: string]: { subjects: Subject[], average: any } } = {}
    const sortedSubjects = sortSubjects(subjects)

    sortedSubjects.forEach((subject) => {
      if (!grouped[subject.semester]) {
        grouped[subject.semester] = { subjects: [], average: { type: 'none', value: null, label: '' } }
      }
      grouped[subject.semester].subjects.push(subject)
    })

    // Calculate average for each semester
    Object.keys(grouped).forEach(semester => {
      const completedSemesterSubjects = grouped[semester].subjects.filter(s => s.completed && !isSubjectFailed(s))
      grouped[semester].average = calculateAverage(completedSemesterSubjects)
    })

    return grouped
  }, [subjects])

  const getStatusBadge = (status: StudyStatus) => {
    return <Badge className={getStatusColor(status)}>{getStatusText(status)}</Badge>
  }

  const getCompletionBadge = (type: string) => {
    const config = getCompletionBadgeConfig(type)
    return (
      <Badge variant="outline" className={`text-xs ${config.className}`}>
        {config.text}
      </Badge>
    )
  }

  const getSubjectTypeBadge = (type: string) => {
    switch (type) {
      case "Povinný":
        return (
          <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
            P
          </Badge>
        )
      case "Povinně volitelný":
        return (
          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
            PV
          </Badge>
        )
      case "Volitelný":
        return (
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
            V
          </Badge>
        )
      case "Ostatní":
        return (
          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700">
            -
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {type}
          </Badge>
        )
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
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center space-x-4">
            <StudyLogo logoUrl={study.logo_url} studyName={study.name} size="xl" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{study.name}</h1>
              <div className="flex items-center space-x-3 mt-2">
                <span className="text-gray-600">{study.type}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-600">{study.form}</span>
                <span className="text-gray-400">•</span>
                {getStatusBadge(study.status)}
              </div>
              {study.public_description && <p className="text-gray-600 mt-2 max-w-2xl">{study.public_description}</p>}
              {study.last_updated && (
                <p className="text-sm text-gray-500 mt-2">
                  Naposledy aktualizováno: {new Date(study.last_updated).toLocaleDateString("cs-CZ")}
                </p>
              )}
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
                Dokončeno: {stats.completed} ({stats.completionRate.toFixed(1)}%)
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Získané kredity</CardTitle>
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
                <Trophy className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                {stats.average.type === 'both' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {stats.average.pointsValue ? stats.average.pointsValue.toFixed(2) : '-'}
                      </div>
                      <p className="text-xs text-gray-600">body</p>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {stats.average.gradeValue ? stats.average.gradeValue.toFixed(2) : '-'}
                      </div>
                      <p className="text-xs text-gray-600">známky</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.average.value ? stats.average.value.toFixed(2) : '-'}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">vážené kredity</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Celkové hodiny</CardTitle>
              <Clock className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.completedHours}</div>
              <p className="text-xs text-gray-600 mt-1">
                z {stats.totalHours} hodin ({stats.totalHours > 0 ? ((stats.completedHours / stats.totalHours) * 100).toFixed(1) : 0}%)
              </p>
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
              <CardTitle className="text-lg font-bold text-gray-900">Zápočty</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {stats.creditsCompleted} z {stats.totalSubjectsWithCredits}
                  </span>
                  <span className="font-medium">{stats.creditCompletionRate.toFixed(1)}%</span>
                </div>
                <Progress value={stats.creditCompletionRate} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">Zkoušky</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {stats.examsCompleted} z {stats.totalSubjectsWithExams}
                  </span>
                  <span className="font-medium">{stats.examCompletionRate.toFixed(1)}%</span>
                </div>
                <Progress value={stats.examCompletionRate} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subjects by Semester */}
        <div className="space-y-6">
          {Object.entries(subjectsBySemester).map(([semester, semesterData]) => (
            <Card key={semester} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl font-bold text-gray-900 whitespace-nowrap">{semester}</CardTitle>
                    {semesterData.average.type !== 'none' && (
                      <div className="text-xs text-gray-500 mt-1">
                        {semesterData.average.type === 'both' ? (
                          <div className="flex space-x-4">
                            <span>Body: {semesterData.average.pointsValue ? semesterData.average.pointsValue.toFixed(2) : '-'}</span>
                            <span>Známky: {semesterData.average.gradeValue ? semesterData.average.gradeValue.toFixed(2) : '-'}</span>
                          </div>
                        ) : (
                          <div>
                            {semesterData.average.label}: {semesterData.average.value ? semesterData.average.value.toFixed(2) : '-'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>
                      {semesterData.subjects.filter((s) => s.completed).length}/{semesterData.subjects.length} dokončeno
                    </span>
                    <span>{semesterData.subjects.reduce((sum, s) => sum + s.credits, 0)} kreditů</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Zkratka</TableHead>
                        <TableHead className="min-w-[200px]">Předmět</TableHead>
                        <TableHead className="w-[60px]">Typ</TableHead>
                        <TableHead className="w-[80px]">Ukončení</TableHead>
                        <TableHead className="w-[80px]">Kredity</TableHead>
                        <TableHead className="w-[80px]">Body</TableHead>
                        <TableHead className="w-[100px]">Známka</TableHead>
                        <TableHead className="w-[120px]">Datum ukončení</TableHead>
                        <TableHead className="w-[60px]">Stav</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {semesterData.subjects.map((subject) => (
                        <TableRow key={subject.id} className="hover:bg-gray-50">
                          <TableCell className="font-mono text-sm">{subject.abbreviation || '-'}</TableCell>
                          <TableCell className="text-sm">{subject.name}</TableCell>
                          <TableCell>{getSubjectTypeBadge(subject.subject_type)}</TableCell>
                          <TableCell>{getCompletionBadge(subject.completion_type)}</TableCell>
                          <TableCell className="text-center font-medium">{subject.credits}</TableCell>
                          <TableCell className="text-center">
                            {(() => {
                              const subjectState = getSubjectStatus(subject)
                              return isFieldVisibleForState("points", subjectState) && subject.points ? (
                                <span className="font-medium">{subject.points}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )
                            })()}
                          </TableCell>
                          <TableCell className="text-center">
                            {(() => {
                              const subjectState = getSubjectStatus(subject)
                              return isFieldVisibleForState("grade", subjectState) && subject.grade ? (
                                <Badge 
                                  variant="outline" 
                                  className={`font-medium ${
                                    isSubjectFailed(subject) 
                                      ? "bg-orange-50 text-orange-700 border-orange-200" 
                                      : ""
                                  }`}
                                >
                                  {subject.grade}
                                </Badge>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )
                            })()}
                          </TableCell>
                          <TableCell className="text-center">
                            {(() => {
                              const subjectState = getSubjectStatus(subject)
                              return isFieldVisibleForState("final_date", subjectState) && subject.final_date ? (
                                <span className="text-sm">{subject.final_date}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )
                            })()}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const subjectState = getSubjectStatus(subject)
                              return (
                                <Badge className={getSubjectStateColor(subjectState, subject, true)}>
                                  {getSubjectStateText(subjectState, subject)}
                                </Badge>
                              )
                            })()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Vytvořeno pomocí University Study Tracker</p>
        </div>
      </main>
    </div>
  )
}
