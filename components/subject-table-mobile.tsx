"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Edit, Play, CheckCircle } from "lucide-react"
import { SubjectEditForm } from "./subject-edit-form"
import { SubjectCompletionModal } from "./subject-completion-modal"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { 
  SubjectState, 
  getSubjectStatus, 
  getSubjectStateColor, 
  getSubjectStateText,
  getAvailableActions,
  isFieldVisibleForState,
  requiresCredit,
  isSubjectFailed,
  requiresExam,
  getCompletionBadgeConfig,
  getGradeBadgeConfig,
  getCzechPointsWord,
  getCreditsAndHoursDisplayMobile
} from "@/lib/status-utils"
import { getSubjectTypeConfig } from "@/lib/constants"
import { formatDateCzech } from "@/lib/utils"

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

interface SubjectTableMobileProps {
  subjects: Subject[]
  loading: boolean
  onUpdate: () => void
}

const sortSubjects = (subjects: Subject[]) => {
  const getTypeOrder = (type: string) => getSubjectTypeConfig(type).order

  // Get subject status priority (Active > Completed > Planned)
  const getStatusPriority = (subject: Subject) => {
    if (subject.planned) return 3  // Planned
    if (subject.completed) return 2  // Completed
    return 1  // Active
  }

  // Custom semester sorting function
  const getSemesterOrder = (semester: string) => {
    // Extract year and semester type
    const match = semester.match(/(\d+)\.\s*ročník\s*(ZS|LS)/i)
    if (match) {
      const year = Number.parseInt(match[1])
      const semesterType = match[2].toUpperCase()
      // ZS (winter) comes before LS (summer) in the same year
      return year * 10 + (semesterType === "ZS" ? 1 : 2)
    }
    // Fallback for non-standard semester names
    return 999
  }

  return [...subjects].sort((a, b) => {
    // First sort by status priority (Active > Completed > Planned)
    const aStatusPriority = getStatusPriority(a)
    const bStatusPriority = getStatusPriority(b)
    if (aStatusPriority !== bStatusPriority) {
      return aStatusPriority - bStatusPriority
    }

    // Then sort by semester with proper ZS/LS ordering
    const aSemesterOrder = getSemesterOrder(a.semester)
    const bSemesterOrder = getSemesterOrder(b.semester)
    if (aSemesterOrder !== bSemesterOrder) {
      return aSemesterOrder - bSemesterOrder
    }

    // Then sort by subject type
    const aTypeOrder = getTypeOrder(a.subject_type)
    const bTypeOrder = getTypeOrder(b.subject_type)
    if (aTypeOrder !== bTypeOrder) {
      return aTypeOrder - bTypeOrder
    }

    // Finally sort alphabetically by name
    return a.name.localeCompare(b.name, "cs")
  })
}

export function SubjectTableMobile({ subjects, loading, onUpdate }: SubjectTableMobileProps) {
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({})
  const [editFormOpen, setEditFormOpen] = useState(false)
  const [completionModalOpen, setCompletionModalOpen] = useState(false)
  const [completionModalSubject, setCompletionModalSubject] = useState<Subject | null>(null)
  const [completionModalType, setCompletionModalType] = useState<"credit" | "exam">("credit")
  const supabase = createClient()

  const sortedSubjects = sortSubjects(subjects)

  const handleStateChange = async (subjectId: string, newState: SubjectState) => {
    setActionLoading({ ...actionLoading, [subjectId]: true })

    // Find the subject to get its completion_type
    const subject = subjects.find(s => s.id === subjectId)
    if (!subject) return

    const updates: any = {
      planned: newState === "planned",
      completed: newState === "completed",
    }

    // If changing to completed, we need to set a final_date and mark credit/exam as completed
    if (newState === "completed") {
      updates.final_date = new Date().toISOString().split('T')[0] // Today's date
      
      // Automatically mark credit and exam as completed if required by completion type
      if (requiresCredit(subject.completion_type)) {
        updates.credit_completed = true
      }
      if (requiresExam(subject.completion_type)) {
        updates.exam_completed = true
      }
    }

    // If changing away from completed, clear completion-related fields
    if (newState !== "completed") {
      updates.final_date = null
      updates.exam_completed = false
      updates.credit_completed = false
    }

    const { error } = await supabase
      .from("subjects")
      .update(updates)
      .eq("id", subjectId)

    if (!error) {
      onUpdate()
    }

    setActionLoading({ ...actionLoading, [subjectId]: false })
  }

  const handleCheckboxChange = (subject: Subject, field: "credit_completed" | "exam_completed", checked: boolean) => {
    // Show completion modal when checking a checkbox
    setCompletionModalSubject(subject)
    setCompletionModalType(field === "credit_completed" ? "credit" : "exam")
    setCompletionModalOpen(true)
  }

  const getSubjectTypeBadge = (type: string) => {
    const config = getSubjectTypeConfig(type)
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline">{config.shortCode}</Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.fullText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }


  const getCompletionBadge = (type: string) => {
    const config = getCompletionBadgeConfig(type)
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={config.className} style={config.style}>
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

  const handleEditClick = (subject: Subject) => {
    setEditingSubject(subject)
    setEditFormOpen(true)
  }

  const handleEditClose = () => {
    setEditingSubject(null)
    setEditFormOpen(false)
  }

  const handleEditSuccess = () => {
    setEditingSubject(null)
    setEditFormOpen(false)
    onUpdate()
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Načítání předmětů...
      </div>
    )
  }

  if (sortedSubjects.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Žádné předměty nenalezeny.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sortedSubjects.map((subject) => {
        const subjectState = getSubjectStatus(subject)
        const availableActions = getAvailableActions(subjectState, subject.completion_type)

        return (
          <div 
            key={subject.id}
            className={`bg-white rounded-lg border p-4 space-y-3 ${
              isSubjectFailed(subject) ? "bg-red-50 border-red-200" : ""
            }`}
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-gray-900 truncate">
                    {subject.abbreviation || subject.name}
                  </h3>
                  {getSubjectTypeBadge(subject.subject_type)}
                </div>
                {subject.abbreviation && (
                  <p className="text-sm text-gray-600 mb-2">{subject.name}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>{subject.semester}</span>
                  <span>•</span>
                  <span>
                    {(() => {
                      const display = getCreditsAndHoursDisplayMobile(subject.credits, subject.hours)
                      
                      if (display.type === 'none') return "-"
                      
                      if (display.type === 'both') {
                        return (
                          <>
                            <span className="font-medium text-gray-700">{display.credits} {display.creditsText}</span>
                            <span className="text-gray-400 ml-1">({display.hours} {display.hoursText})</span>
                          </>
                        )
                      }
                      
                      if (display.type === 'credits') {
                        return <span className="font-medium text-gray-700">{display.credits} {display.creditsText}</span>
                      }
                      
                      if (display.type === 'hours') {
                        return <span className="text-gray-400">{display.hours} {display.hoursText}</span>
                      }
                    })()}
                  </span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-1 ml-2">
                {availableActions.includes("makeActive") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStateChange(subject.id, "active")}
                    disabled={actionLoading[subject.id]}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                
                {availableActions.includes("markCompleted") && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionLoading[subject.id]}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Označit předmět jako dokončený?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Předmět &quot;{subject.name}&quot; bude označen jako dokončený s dnešním datem.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Zrušit</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleStateChange(subject.id, "completed")}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Označit jako dokončený
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                
                {availableActions.includes("edit") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditClick(subject)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Detail Info */}
            {(subject.department || subject.lecturer) && (
              <div className="text-sm text-gray-600">
                {[subject.department, subject.lecturer].filter(Boolean).join(' • ')}
              </div>
            )}

            {/* Completion and Grades */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Ukončení:</span>
                <div className="mt-1">{getCompletionBadge(subject.completion_type)}</div>
              </div>
              
              {isFieldVisibleForState("grade", subjectState) && subject.grade && (
                <div>
                  <span className="text-gray-500">Hodnocení:</span>
                  <div className="mt-1 flex items-center gap-2 whitespace-nowrap">
                    {(() => {
                      const gradeConfig = getGradeBadgeConfig(subject.grade, subject)
                      return (
                        <span className={`px-2 py-1 rounded text-sm font-medium ${gradeConfig.className}`} style={gradeConfig.style}>
                          {subject.grade}
                        </span>
                      )
                    })()}
                    {isFieldVisibleForState("points", subjectState) && subject.points && (
                      <span className="text-sm text-gray-600">
                        ({subject.points} {getCzechPointsWord(subject.points)})
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {!isFieldVisibleForState("grade", subjectState) && isFieldVisibleForState("points", subjectState) && subject.points && (
                <div>
                  <span className="text-gray-500">Body:</span>
                  <div className="mt-1">
                    <span className="text-sm text-gray-600">
                      {subject.points} {getCzechPointsWord(subject.points)}
                    </span>
                  </div>
                </div>
              )}
              
              
              {isFieldVisibleForState("final_date", subjectState) && subject.final_date && (
                <div>
                  <span className="text-gray-500">Datum ukončení:</span>
                  <div className="mt-1 whitespace-nowrap">{formatDateCzech(subject.final_date)}</div>
                </div>
              )}
            </div>

            {/* Completion Checkboxes */}
            {(requiresCredit(subject.completion_type) || requiresExam(subject.completion_type)) && (
              <div className="flex gap-4 pt-2 border-t">
                {requiresCredit(subject.completion_type) && (
                  <div className="flex items-center space-x-2">
                    {availableActions.includes("toggleCredit") ? (
                      <Checkbox
                        key={`${subject.id}-credit-${subject.credit_completed}`}
                        checked={subject.credit_completed}
                        onCheckedChange={(checked) => {
                          if (checked && !subject.credit_completed) {
                            handleCheckboxChange(subject, "credit_completed", checked as boolean)
                          }
                        }}
                        disabled={actionLoading[`${subject.id}_credit_completed`] || subject.credit_completed}
                      />
                    ) : (
                      subject.credit_completed ? (isSubjectFailed(subject) ? <span className="text-sm">-</span> : <CheckCircle className="h-4 w-4 text-green-600" />) : <div className="w-4 h-4" />
                    )}
                    <span className="text-sm text-gray-600">Zápočet</span>
                  </div>
                )}
                
                {requiresExam(subject.completion_type) && (
                  <div className="flex items-center space-x-2">
                    {availableActions.includes("toggleExam") ? (
                      <Checkbox
                        key={`${subject.id}-exam-${subject.exam_completed}`}
                        checked={subject.exam_completed}
                        onCheckedChange={(checked) => {
                          if (checked && !subject.exam_completed) {
                            handleCheckboxChange(subject, "exam_completed", checked as boolean)
                          }
                        }}
                        disabled={actionLoading[`${subject.id}_exam_completed`] || subject.exam_completed}
                      />
                    ) : (
                      subject.exam_completed ? (isSubjectFailed(subject) ? <span className="text-sm">-</span> : <CheckCircle className="h-4 w-4 text-green-600" />) : <div className="w-4 h-4" />
                    )}
                    <span className="text-sm text-gray-600">Zkouška</span>
                  </div>
                )}
              </div>
            )}

            {/* Status Badge */}
            <div className="flex justify-end">
              <Badge className={getSubjectStateColor(subjectState, subject, true)}>
                {getSubjectStateText(subjectState, subject)}
              </Badge>
            </div>
          </div>
        )
      })}
      
      {/* Edit Modal */}
      {editingSubject && (
        <SubjectEditForm
          subject={editingSubject}
          open={editFormOpen}
          onClose={handleEditClose}
          onSuccess={handleEditSuccess}
        />
      )}
      
      {/* Completion Modal */}
      {completionModalSubject && (
        <SubjectCompletionModal
          subject={completionModalSubject}
          completionType={completionModalType}
          open={completionModalOpen}
          onClose={() => {
            setCompletionModalOpen(false)
            setCompletionModalSubject(null)
          }}
          onSuccess={() => {
            setCompletionModalOpen(false)
            setCompletionModalSubject(null)
            onUpdate()
          }}
        />
      )}
    </div>
  )
}