"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Edit, Play, CheckCircle } from "lucide-react"
import { SubjectEditForm } from "./subject-edit-form"
import { SubjectCompletionModal } from "./subject-completion-modal"
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
  getCompletionBadgeConfig
} from "@/lib/status-utils"
import { getSubjectTypeConfig } from "@/lib/constants"

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

interface SubjectTableProps {
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

export function SubjectTable({ subjects, loading, onUpdate }: SubjectTableProps) {
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

  const getSubjectTypeShort = (type: string) => {
    return getSubjectTypeConfig(type).shortCode
  }

  const getSemesterShort = (semester: string) => {
    // Convert "1. ročník ZS" to "1/ZS", "2. ročník LS" to "2/LS", etc.
    const match = semester.match(/(\d+)\.\s*ročník\s*(ZS|LS)/i)
    if (match) {
      return `${match[1]}/${match[2]}`
    }
    return semester
  }

  const getCompletionBadge = (type: string) => {
    const config = getCompletionBadgeConfig(type)
    return (
      <Badge variant="outline" className={config.className}>
        {config.text}
      </Badge>
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

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Semestr</TableHead>
            <TableHead>Předmět</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Ukončení</TableHead>
            <TableHead>Kredity</TableHead>
            <TableHead>Hodiny</TableHead>
            <TableHead>Body</TableHead>
            <TableHead>Známka</TableHead>
            <TableHead>Datum ukončení</TableHead>
            <TableHead>Zápočet</TableHead>
            <TableHead>Zkouška</TableHead>
            <TableHead>Akce</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={12} className="text-center py-8 text-gray-500">
                Načítání předmětů...
              </TableCell>
            </TableRow>
          ) : sortedSubjects.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="text-center py-8 text-gray-500">
                Žádné předměty nenalezeny.
              </TableCell>
            </TableRow>
          ) : (
            sortedSubjects.map((subject) => {
              const subjectState = getSubjectStatus(subject)
              const availableActions = getAvailableActions(subjectState, subject.completion_type)

              return (
                <TableRow 
                  key={subject.id}
                  className={isSubjectFailed(subject) ? "bg-red-50" : ""}
                >
                  {/* Semester */}
                  <TableCell className="font-medium whitespace-nowrap">{subject.semester}</TableCell>

                  {/* Subject */}
                  <TableCell>
                    <div>
                      <div className="font-medium">{subject.abbreviation || subject.name}</div>
                      {subject.abbreviation && (
                        <div className="text-sm text-gray-600">{subject.name}</div>
                      )}
                    </div>
                  </TableCell>

                  {/* Type */}
                  <TableCell>
                    <Badge variant="outline">{getSubjectTypeShort(subject.subject_type)}</Badge>
                  </TableCell>

                  {/* Completion Type */}
                  <TableCell>{getCompletionBadge(subject.completion_type)}</TableCell>

                  {/* Credits */}
                  <TableCell>{subject.credits}</TableCell>

                  {/* Hours */}
                  <TableCell>{subject.hours || "-"}</TableCell>

                  {/* Points */}
                  <TableCell>
                    {isFieldVisibleForState("points", subjectState) ? (subject.points || "-") : "-"}
                  </TableCell>

                  {/* Grade */}
                  <TableCell>
                    {isFieldVisibleForState("grade", subjectState) ? (
                      subject.grade ? (
                        <span className={isSubjectFailed(subject) ? "font-semibold text-red-700" : ""}>
                          {subject.grade}
                        </span>
                      ) : "-"
                    ) : "-"}
                  </TableCell>

                  {/* Final Date */}
                  <TableCell>
                    {isFieldVisibleForState("final_date", subjectState) ? (subject.final_date || "-") : "-"}
                  </TableCell>

                  {/* Credit Completion */}
                  <TableCell>
                    {requiresCredit(subject.completion_type) ? (
                      availableActions.includes("toggleCredit") ? (
                        <Checkbox
                          key={`${subject.id}-credit-${subject.credit_completed}`}
                          checked={subject.credit_completed}
                          onCheckedChange={(checked) => {
                            // Only allow checking if not already completed
                            if (checked && !subject.credit_completed) {
                              handleCheckboxChange(subject, "credit_completed", checked as boolean)
                            }
                          }}
                          disabled={actionLoading[`${subject.id}_credit_completed`] || subject.credit_completed}
                          className="peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          style={subject.credit_completed ? {
                            backgroundColor: 'rgb(37, 99, 235)',
                            borderColor: 'rgb(37, 99, 235)',
                            color: 'white'
                          } : {}}
                        />
                      ) : (
                        subject.credit_completed ? <CheckCircle className="h-4 w-4 text-green-600" /> : "-"
                      )
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </TableCell>

                  {/* Exam Completion */}
                  <TableCell>
                    {requiresExam(subject.completion_type) ? (
                      availableActions.includes("toggleExam") ? (
                        <Checkbox
                          key={`${subject.id}-exam-${subject.exam_completed}`}
                          checked={subject.exam_completed}
                          onCheckedChange={(checked) => {
                            // Only allow checking if not already completed
                            if (checked && !subject.exam_completed) {
                              handleCheckboxChange(subject, "exam_completed", checked as boolean)
                            }
                          }}
                          disabled={actionLoading[`${subject.id}_exam_completed`] || subject.exam_completed}
                          className="peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          style={subject.exam_completed ? {
                            backgroundColor: 'rgb(37, 99, 235)',
                            borderColor: 'rgb(37, 99, 235)',
                            color: 'white'
                          } : {}}
                        />
                      ) : (
                        subject.exam_completed ? <CheckCircle className="h-4 w-4 text-green-600" /> : "-"
                      )
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <div className="flex gap-1">
                      {/* Make Active */}
                      {availableActions.includes("makeActive") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStateChange(subject.id, "active")}
                          disabled={actionLoading[subject.id]}
                          title="Aktivovat předmět"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Mark Completed */}
                      {availableActions.includes("markCompleted") && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionLoading[subject.id]}
                              title="Označit jako dokončený"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Označit předmět jako dokončený?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Předmět "{subject.name}" bude označen jako dokončený s dnešním datem.
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

                      {/* Edit */}
                      {availableActions.includes("edit") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(subject)}
                          title="Upravit předmět"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      
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