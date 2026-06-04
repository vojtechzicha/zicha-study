"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { BookOpen } from "lucide-react"
import {
  getSubjectStatus,
  isFieldVisibleForState,
  getCompletionBadgeConfig,
  isSubjectFailed,
  getGradeBadgeConfig,
  getCzechPointsWord,
  getCreditsAndHoursDisplay,
  getSubjectStateBadgeConfig,
} from "@/lib/status-utils"
import { calculateAverage, calculateGpa, type AverageResult } from "@/lib/grade-utils"
import { getSubjectTypeConfig } from "@/lib/constants"
import { formatDateCzech } from "@/lib/utils"
import { sortSubjects } from "@/lib/utils/subject-utils"
import type { StudySubjectsPublicProps } from "./types"

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

export function UniversitySubjectsPublic({ subjects }: StudySubjectsPublicProps) {
  const typedSubjects = subjects as unknown as Subject[]

  // Group subjects by semester with averages
  const subjectsBySemester = useMemo(() => {
    const grouped: { [key: string]: { subjects: Subject[]; average: AverageResult; gpa: number | null } } = {}
    const sortedSubjects = sortSubjects(typedSubjects)

    sortedSubjects.forEach((subject) => {
      if (!grouped[subject.semester]) {
        grouped[subject.semester] = { subjects: [], average: { type: "none", value: null, label: "" }, gpa: null }
      }
      grouped[subject.semester].subjects.push(subject)
    })

    Object.keys(grouped).forEach((semester) => {
      const completedSemesterSubjects = grouped[semester].subjects.filter((s) => s.completed && !isSubjectFailed(s))
      grouped[semester].average = calculateAverage(completedSemesterSubjects)
      grouped[semester].gpa = calculateGpa(grouped[semester].subjects.filter((s) => s.completed && !s.planned))
    })

    return grouped
  }, [typedSubjects])

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
                {(semesterData.average.type !== "none" || semesterData.gpa !== null) && (
                  <div className="text-xs text-gray-500 mt-1">
                    {semesterData.average.type === "both" ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span>Body: {semesterData.average.pointsValue ? semesterData.average.pointsValue.toFixed(2) : "-"}</span>
                        <span>Známky: {semesterData.average.gradeValue ? semesterData.average.gradeValue.toFixed(2) : "-"}</span>
                        {semesterData.gpa !== null && <span>GPA: {semesterData.gpa.toFixed(2)}</span>}
                      </div>
                    ) : semesterData.average.type !== "none" ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          {semesterData.average.label}: {semesterData.average.value ? semesterData.average.value.toFixed(2) : "-"}
                        </span>
                        {semesterData.gpa !== null && <span>GPA: {semesterData.gpa.toFixed(2)}</span>}
                      </div>
                    ) : (
                      <div>GPA: {semesterData.gpa?.toFixed(2) ?? "-"}</div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>
                  {semesterData.subjects.filter((s) => s.completed).length}/{semesterData.subjects.length} dokončeno
                </span>
                <span>{semesterData.subjects.filter((s) => !s.is_repeat).reduce((sum, s) => sum + s.credits, 0)} kreditů</span>
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
                      <TableCell className="font-mono text-sm">{subject.abbreviation || "-"}</TableCell>
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
                              {[subject.department, subject.lecturer].filter(Boolean).join(" • ")}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getSubjectTypeBadge(subject.subject_type)}</TableCell>
                      <TableCell>{getCompletionBadge(subject.completion_type)}</TableCell>
                      <TableCell className="text-center font-medium whitespace-nowrap">
                        {(() => {
                          const display = getCreditsAndHoursDisplay(subject.credits, subject.hours)

                          if (display.type === "none") return "-"

                          if (display.type === "both") {
                            return (
                              <span>
                                <span className="font-medium">{display.credits}</span>
                                <span className="text-gray-500 text-sm ml-1">
                                  ({display.hours} {display.hoursText})
                                </span>
                              </span>
                            )
                          }

                          if (display.type === "credits") {
                            return <span className="font-medium">{display.credits}</span>
                          }

                          if (display.type === "hours") {
                            return (
                              <span className="text-gray-500">
                                {display.hours} {display.hoursText}
                              </span>
                            )
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
                            const gradeConfig = getGradeBadgeConfig(subject.grade!, subject)
                            return (
                              <div className="flex items-center justify-center gap-2">
                                <span
                                  className={`px-2 py-1 rounded text-sm font-medium ${gradeConfig.className}`}
                                  style={gradeConfig.style}
                                >
                                  {subject.grade}
                                </span>
                                <span className="text-sm text-gray-600">
                                  ({subject.points} {getCzechPointsWord(subject.points!)})
                                </span>
                              </div>
                            )
                          }

                          if (hasGrade) {
                            const gradeConfig = getGradeBadgeConfig(subject.grade!, subject)
                            return (
                              <span
                                className={`px-2 py-1 rounded text-sm font-medium ${gradeConfig.className}`}
                                style={gradeConfig.style}
                              >
                                {subject.grade}
                              </span>
                            )
                          }

                          if (hasPoints) {
                            return (
                              <span className="text-sm text-gray-600">
                                {subject.points} {getCzechPointsWord(subject.points!)}
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
  )
}
