"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { StudyLogo } from "./study-logo"
import { useLogoTheme } from "@/hooks/use-logo-theme"
import { useFavicon } from "@/hooks/use-favicon"
import { PublicMaterialsSection } from "./public-materials-section"
import { PublicStudyNotesSection } from "./public-study-notes-section"
import { FinalExamsList } from "./final-exams-list"
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
  isSubjectFailed,
  getGradeBadgeConfig,
  getCzechPointsWord,
  getCreditsAndHoursDisplay,
  getSubjectStateBadgeConfig
} from "@/lib/status-utils"
import { calculateAverage, getUniqueSemesters } from "@/lib/grade-utils"
import { getSubjectTypeConfig, getStudyFormLabel } from "@/lib/constants"
import { formatDateCzech } from "@/lib/utils"

interface Study {
  id: string
  name: string
  type: string
  form: string
  start_year: number
  end_year?: number
  status: StudyStatus
  logo_url?: string
  final_exams_enabled?: boolean
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
  is_repeat?: boolean
  repeats_subject_id?: string
}

interface PublicStudyViewProps {
  study: Study
  subjects: Subject[]
}

const sortSubjects = (subjects: Subject[]) => {
  const getTypeOrder = (type: string) => getSubjectTypeConfig(type).order

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

    const aTypeOrder = getTypeOrder(a.subject_type)
    const bTypeOrder = getTypeOrder(b.subject_type)
    if (aTypeOrder !== bTypeOrder) {
      return aTypeOrder - bTypeOrder
    }

    return a.name.localeCompare(b.name, "cs")
  })
}

export function PublicStudyView({ study, subjects }: PublicStudyViewProps) {
  // Extract and apply theme colors from logo
  const { extractedColor, isLoading: colorLoading } = useLogoTheme(study.logo_url)
  
  // Update favicon with study logo
  useFavicon(study.logo_url)


  // Calculate statistics
  const stats = useMemo(() => {
    const total = subjects.length
    const completed = subjects.filter((s) => s.completed).length
    const creditsCompleted = subjects.filter((s) => s.credit_completed).length
    const examsCompleted = subjects.filter((s) => s.exam_completed).length

    const totalCredits = subjects.filter(s => !s.is_repeat).reduce((sum, s) => sum + s.credits, 0)
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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className={`text-xs ${config.className}`} style={config.style}>
              {config.text}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.fullText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const getSubjectTypeBadge = (type: string) => {
    const config = getSubjectTypeConfig(type)
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs">
              {config.shortCode}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.fullText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0">
              <StudyLogo logoUrl={study.logo_url} studyName={study.name} size="xl" className="!w-32 !h-32 !text-2xl" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{study.name}</h1>
              <div className="flex items-center space-x-3 mt-2">
                <span className="text-gray-600">{study.type}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-600">{getStudyFormLabel(study.form)}</span>
                <span className="text-gray-400">•</span>
                {getStatusBadge(study.status)}
              </div>
              
              {/* Study Timeline */}
              <div className="mt-4 bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-white/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Doba studia</span>
                  <span className="text-sm text-gray-600">
                    {study.start_year} - {study.end_year || 'probíhá'}
                  </span>
                </div>
                <div className="relative">
                  {/* Timeline bar */}
                  <div className="h-2 bg-primary-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-300"
                      style={{
                        width: study.end_year 
                          ? `${Math.min(100, Math.max(5, ((new Date().getFullYear() - study.start_year) / (study.end_year - study.start_year)) * 100))}%`
                          : '66%' // Default progress for ongoing studies
                      }}
                    />
                  </div>
                  
                  {/* Year markers */}
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>{study.start_year}</span>
                    {study.end_year && (
                      <span>{study.end_year}</span>
                    )}
                  </div>
                  
                  {/* Current year indicator */}
                  {study.end_year && new Date().getFullYear() >= study.start_year && new Date().getFullYear() <= study.end_year && (() => {
                    const currentYear = new Date().getFullYear()
                    const progress = (currentYear - study.start_year) / (study.end_year - study.start_year)
                    const leftPosition = Math.max(8, Math.min(92, progress * 100)) // Keep between 8% and 92% to avoid text cutoff
                    
                    return (
                      <div 
                        className="absolute top-0 transform -translate-x-1/2"
                        style={{
                          left: `${leftPosition}%`
                        }}
                      >
                        <div className="w-3 h-3 bg-primary-600 rounded-full border-2 border-white shadow-sm -mt-0.5"></div>
                        <div className="text-xs text-primary-600 font-medium mt-1 whitespace-nowrap">
                          {currentYear}
                        </div>
                      </div>
                    )
                  })()}
                </div>
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
              <BookOpen className="h-4 w-4 text-primary-600" />
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

        {/* Materials Section */}
        <div className="mb-8">
          <PublicMaterialsSection studyId={study.id} study={study} />
        </div>

        {/* Study Notes Section */}
        <div className="mb-8">
          <PublicStudyNotesSection studyId={study.id} study={study} />
        </div>

        {/* Final Exams Section */}
        {study.final_exams_enabled && (
          <div className="mb-8">
            <FinalExamsList studyId={study.id} studySlug={study.public_slug} isPublic={true} />
          </div>
        )}

        {/* Subjects by Semester */}
        <div className="space-y-6">
          {Object.entries(subjectsBySemester).map(([semester, semesterData]) => (
            <Card key={semester} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary-600" />
                      <CardTitle className="text-xl font-bold text-gray-900 whitespace-nowrap">{semester}</CardTitle>
                    </div>
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
                    <span>{semesterData.subjects.filter(s => !s.is_repeat).reduce((sum, s) => sum + s.credits, 0)} kreditů</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Zkratka</TableHead>
                        <TableHead className="min-w-[200px]">Předmět</TableHead>
                        <TableHead className="w-[60px]">Typ</TableHead>
                        <TableHead className="w-[80px]">Ukončení</TableHead>
                        <TableHead className="w-[80px]">Kredity</TableHead>
                        <TableHead className="w-[120px]">Hodnocení</TableHead>
                        <TableHead className="w-[120px]">Datum ukončení</TableHead>
                        <TableHead className="w-[60px]">Stav</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {semesterData.subjects.map((subject) => (
                        <TableRow key={subject.id} className="hover:bg-primary-50">
                          <TableCell className="font-mono text-sm">{subject.abbreviation || '-'}</TableCell>
                          <TableCell className="text-sm">
                            <div>
                              <div className="flex items-center gap-2">
                                {subject.name}
                                {subject.is_repeat && (
                                  <Badge variant="secondary" className="text-xs">
                                    Opakovaný
                                  </Badge>
                                )}
                              </div>
                              {(subject.department || subject.lecturer) && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {[subject.department, subject.lecturer].filter(Boolean).join(' • ')}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getSubjectTypeBadge(subject.subject_type)}</TableCell>
                          <TableCell>{getCompletionBadge(subject.completion_type)}</TableCell>
                          <TableCell className="text-center font-medium whitespace-nowrap">
                            {(() => {
                              const display = getCreditsAndHoursDisplay(subject.credits, subject.hours)
                              
                              if (display.type === 'none') return "-"
                              
                              if (display.type === 'both') {
                                return (
                                  <span>
                                    <span className="font-medium">{display.credits}</span>
                                    <span className="text-gray-500 text-sm ml-1">({display.hours} {display.hoursText})</span>
                                  </span>
                                )
                              }
                              
                              if (display.type === 'credits') {
                                return <span className="font-medium">{display.credits}</span>
                              }
                              
                              if (display.type === 'hours') {
                                return <span className="text-gray-500">{display.hours} {display.hoursText}</span>
                              }
                            })()}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            {(() => {
                              const subjectState = getSubjectStatus(subject)
                              const hasGrade = isFieldVisibleForState("grade", subjectState) && subject.grade
                              const hasPoints = isFieldVisibleForState("points", subjectState) && subject.points
                              
                              if (!hasGrade && !hasPoints) {
                                return <span className="text-gray-400">-</span>
                              }
                              
                              if (hasGrade && hasPoints) {
                                const gradeConfig = getGradeBadgeConfig(subject.grade, subject)
                                return (
                                  <div className="flex items-center justify-center gap-2">
                                    <span className={`px-2 py-1 rounded text-sm font-medium ${gradeConfig.className}`} style={gradeConfig.style}>
                                      {subject.grade}
                                    </span>
                                    <span className="text-sm text-gray-600">
                                      ({subject.points} {getCzechPointsWord(subject.points)})
                                    </span>
                                  </div>
                                )
                              }
                              
                              if (hasGrade) {
                                const gradeConfig = getGradeBadgeConfig(subject.grade, subject)
                                return (
                                  <span className={`px-2 py-1 rounded text-sm font-medium ${gradeConfig.className}`} style={gradeConfig.style}>
                                    {subject.grade}
                                  </span>
                                )
                              }
                              
                              if (hasPoints) {
                                return (
                                  <span className="text-sm text-gray-600">
                                    {subject.points} {getCzechPointsWord(subject.points)}
                                  </span>
                                )
                              }
                            })()}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            {(() => {
                              const subjectState = getSubjectStatus(subject)
                              return isFieldVisibleForState("final_date", subjectState) && subject.final_date ? (
                                <span className="text-sm">{formatDateCzech(subject.final_date)}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )
                            })()}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const subjectState = getSubjectStatus(subject)
                              const config = getSubjectStateBadgeConfig(subjectState, subject, true)
                              return (
                                <Badge className={`text-xs ${config.className}`} style={config.style}>
                                  {config.text}
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
