"use client"

import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Edit, Play, CheckCircle, FolderOpen, ChevronLeft, ChevronRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { SubjectEditForm } from "./subject-edit-form"
import { SubjectCompletionModal } from "./subject-completion-modal"
import { SubjectTableMobile } from "./subject-table-mobile"
import { SubjectMaterialsDialog } from "./subject-materials-dialog"
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
  getAvailableActions,
  isFieldVisibleForState,
  requiresCredit,
  isSubjectFailed,
  requiresExam,
  getCompletionBadgeConfig,
  getGradeBadgeConfig,
  getCzechPointsWord,
  getCreditsAndHoursDisplay
} from "@/lib/status-utils"
import { getSubjectTypeConfig } from "@/lib/constants"
import { formatDateCzech } from "@/lib/utils"
import { sortSubjects } from "@/lib/utils/subject-utils"

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

interface Study {
  id: string
  name: string
  is_public?: boolean
  public_slug?: string
  exam_scheduler_enabled?: boolean
}

interface SubjectTableProps {
  subjects: Subject[]
  loading: boolean
  onUpdate: () => void
  hideFilters?: boolean
  study?: Study
  examSchedulerEnabled?: boolean
}

type FilterType = "all" | "active"

export function SubjectTable({ subjects, loading, onUpdate, hideFilters = false, study, examSchedulerEnabled = false }: SubjectTableProps) {
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({})
  const [editFormOpen, setEditFormOpen] = useState(false)
  const [completionModalOpen, setCompletionModalOpen] = useState(false)
  const [completionModalSubject, setCompletionModalSubject] = useState<Subject | null>(null)
  const [completionModalType, setCompletionModalType] = useState<"credit" | "exam">("credit")
  const [materialsDialogSubject, setMaterialsDialogSubject] = useState<Subject | null>(null)
  const [materialsDialogOpen, setMaterialsDialogOpen] = useState(false)
  const [filter, setFilter] = useState<FilterType>("all")
  const [showLeftIndicator, setShowLeftIndicator] = useState(false)
  const [showRightIndicator, setShowRightIndicator] = useState(false)
  const [showScrollHint, setShowScrollHint] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Filter subjects based on selected filter
  const filteredSubjects = filter === "active" 
    ? subjects.filter(s => !s.completed && !s.planned)
    : subjects
    
  const sortedSubjects = sortSubjects(filteredSubjects)
  
  // Check if any subject has department or lecturer info
  const hasDetailInfo = subjects.some(s => s.department || s.lecturer)

  // Check scroll position and update indicators
  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      setShowLeftIndicator(scrollLeft > 0)
      setShowRightIndicator(scrollLeft < scrollWidth - clientWidth - 1)
      
      // Hide scroll hint after user has scrolled
      if (scrollLeft > 0) {
        setShowScrollHint(false)
      }
    }
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (container) {
      checkScroll()
      container.addEventListener('scroll', checkScroll)
      window.addEventListener('resize', checkScroll)
      
      // Hide scroll hint after 5 seconds
      const timer = setTimeout(() => {
        setShowScrollHint(false)
      }, 5000)
      
      return () => {
        container.removeEventListener('scroll', checkScroll)
        window.removeEventListener('resize', checkScroll)
        clearTimeout(timer)
      }
    }
  }, [subjects])

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

  const handleCheckboxChange = (subject: Subject, field: "credit_completed" | "exam_completed", _checked: boolean) => {
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

  const handleMaterialsClick = (subject: Subject) => {
    setMaterialsDialogSubject(subject)
    setMaterialsDialogOpen(true)
  }

  return (
    <div>
      {/* Filter Buttons - only show when not hidden */}
      {!hideFilters && (
        <div className="flex gap-2 p-4 border-b">
          <Button 
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            Všechny ({subjects.length})
          </Button>
          <Button 
            variant={filter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("active")}
          >
            Aktivní ({subjects.filter(s => !s.completed && !s.planned).length})
          </Button>
        </div>
      )}
      
      {/* Mobile Card View */}
      <div className="lg:hidden">
        <div className="p-4">
          <SubjectTableMobile subjects={hideFilters ? subjects : filteredSubjects} loading={loading} onUpdate={onUpdate} study={study} examSchedulerEnabled={examSchedulerEnabled || study?.exam_scheduler_enabled} />
        </div>
      </div>
      
      {/* Desktop Table View */}
      <div className="hidden lg:block relative">
        {/* Scroll indicators - only show when scrolling is possible */}
        {showLeftIndicator && (
          <div className="absolute left-[370px] top-0 bottom-0 w-16 flex items-center pointer-events-none z-30">
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent" />
            <ChevronLeft className="relative ml-2 h-5 w-5 text-gray-400" />
          </div>
        )}
        {showRightIndicator && (
          <div className="absolute right-[100px] top-0 bottom-0 w-16 flex items-center justify-end pointer-events-none z-30">
            <div className="absolute inset-0 bg-gradient-to-l from-white via-white/90 to-transparent" />
            <ChevronRight className="relative mr-2 h-5 w-5 text-gray-400" />
          </div>
        )}
        
        {/* Scroll hint that appears briefly */}
        {showScrollHint && showRightIndicator && (
          <div className="absolute right-[116px] top-1/2 -translate-y-1/2 animate-pulse pointer-events-none z-40">
            <div className="bg-primary-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1 shadow-lg">
              <span>Posunout pro více</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        )}
        
        <div 
          className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400" 
          ref={scrollContainerRef}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#d1d5db #f3f4f6'
          }}
        >
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-white w-[120px]">Semestr</TableHead>
              <TableHead className="sticky left-[120px] z-20 bg-white min-w-[250px]">Předmět</TableHead>
              {hasDetailInfo && <TableHead className="w-[200px]">Detail</TableHead>}
              <TableHead>Typ</TableHead>
              <TableHead>Ukončení</TableHead>
              <TableHead>Kredity</TableHead>
              <TableHead>Hodnocení</TableHead>
              <TableHead>Datum ukončení</TableHead>
              <TableHead>Zápočet</TableHead>
              <TableHead>Zkouška</TableHead>
              <TableHead className="sticky right-0 z-10 bg-white w-[100px] text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
        <TableBody>
          {loading ? (
            // Skeleton loading rows
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={`skeleton-${index}`}>
                <TableCell className="sticky left-0 z-10 bg-white">
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell className="sticky left-[120px] z-20 bg-white min-w-[250px]">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </TableCell>
                {hasDetailInfo && (
                  <TableCell>
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </TableCell>
                )}
                <TableCell><Skeleton className="h-5 w-8 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-10 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-6 w-8 rounded" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
                <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
                <TableCell className="sticky right-0 z-10 bg-white">
                  <div className="flex gap-1 justify-end">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (hideFilters ? subjects : sortedSubjects).length === 0 ? (
            <TableRow>
              <TableCell colSpan={hasDetailInfo ? 11 : 10} className="text-center py-8 text-gray-500">
                Žádné předměty nenalezeny.
              </TableCell>
            </TableRow>
          ) : (
            (hideFilters ? sortSubjects(subjects) : sortedSubjects).map((subject) => {
              const subjectState = getSubjectStatus(subject)
              const availableActions = getAvailableActions(subjectState, subject.completion_type)

              return (
                <TableRow 
                  key={subject.id}
                  className={isSubjectFailed(subject) ? "group bg-red-50 hover:bg-red-100" : "group"}
                >
                  {/* Semester */}
                  <TableCell className={`font-medium whitespace-nowrap sticky left-0 z-10 ${isSubjectFailed(subject) ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-muted/50'}`}>{subject.semester}</TableCell>

                  {/* Subject */}
                  <TableCell className={`sticky left-[120px] z-20 min-w-[250px] ${isSubjectFailed(subject) ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-muted/50'}`}>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {subject.abbreviation || subject.name}
                        {subject.is_repeat && (
                          <Badge variant="secondary" className="text-xs">
                            Opakovaný
                          </Badge>
                        )}
                      </div>
                      {subject.abbreviation && (
                        <div className="text-sm text-gray-600">{subject.name}</div>
                      )}
                    </div>
                  </TableCell>

                  {/* Detail - Department and Lecturer */}
                  {hasDetailInfo && (
                    <TableCell className={`text-xs text-gray-600 max-w-[200px] overflow-hidden pl-6 ${isSubjectFailed(subject) ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-muted/50'}`}>
                      {(subject.department || subject.lecturer) ? (
                        <TooltipProvider>
                          <div className="space-y-0.5">
                            {subject.department && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="truncate cursor-help">
                                    {subject.department}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{subject.department}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {subject.lecturer && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="truncate text-gray-500 cursor-help">
                                    {subject.lecturer}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{subject.lecturer}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TooltipProvider>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  )}

                  {/* Type */}
                  <TableCell>
                    {getSubjectTypeBadge(subject.subject_type)}
                  </TableCell>

                  {/* Completion Type */}
                  <TableCell>{getCompletionBadge(subject.completion_type)}</TableCell>

                  {/* Credits and Hours Combined */}
                  <TableCell className="whitespace-nowrap">
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

                  {/* Grade and Points Combined */}
                  <TableCell className="whitespace-nowrap">
                    {(() => {
                      const hasGrade = isFieldVisibleForState("grade", subjectState) && subject.grade
                      const hasPoints = isFieldVisibleForState("points", subjectState) && subject.points
                      
                      if (!hasGrade && !hasPoints) return "-"
                      
                      
                      if (hasGrade && hasPoints) {
                        const gradeConfig = getGradeBadgeConfig(subject.grade!, subject)
                        return (
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-sm font-medium ${gradeConfig.className}`} style={gradeConfig.style}>
                              {subject.grade}
                            </span>
                            <span className="text-sm text-gray-600">({subject.points} {getCzechPointsWord(subject.points!)})</span>
                          </div>
                        )
                      }

                      if (hasGrade) {
                        const gradeConfig = getGradeBadgeConfig(subject.grade!, subject)
                        return (
                          <span className={`px-2 py-1 rounded text-sm font-medium ${gradeConfig.className}`} style={gradeConfig.style}>
                            {subject.grade}
                          </span>
                        )
                      }

                      if (hasPoints) {
                        return <span className="text-sm text-gray-600">{subject.points} {getCzechPointsWord(subject.points!)}</span>
                      }
                    })()}
                  </TableCell>

                  {/* Final Date */}
                  <TableCell className="whitespace-nowrap">
                    {isFieldVisibleForState("final_date", subjectState) ? (formatDateCzech(subject.final_date) || "-") : "-"}
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
                            backgroundColor: 'var(--primary-600)',
                            borderColor: 'var(--primary-600)',
                            color: 'white'
                          } : {}}
                        />
                      ) : (
                        subject.credit_completed ? (isSubjectFailed(subject) ? "-" : <CheckCircle className="h-4 w-4 text-green-600" />) : "-"
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
                            backgroundColor: 'var(--primary-600)',
                            borderColor: 'var(--primary-600)',
                            color: 'white'
                          } : {}}
                        />
                      ) : (
                        subject.exam_completed ? (isSubjectFailed(subject) ? "-" : <CheckCircle className="h-4 w-4 text-green-600" />) : "-"
                      )
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className={`sticky right-0 z-10 text-right ${isSubjectFailed(subject) ? 'bg-red-50 group-hover:bg-red-100' : 'bg-white group-hover:bg-muted/50'}`}>
                    <div className="flex gap-1 justify-end">
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
                                Předmět &quot;{subject.name}&quot; bude označen jako dokončený s dnešním datem.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Zrušit</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleStateChange(subject.id, "completed")}
                                className="bg-primary-600 hover:bg-primary-700 text-white"
                              >
                                Označit jako dokončený
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      {/* Materials */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMaterialsClick(subject)}
                        title="Materiály předmětu"
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Button>

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
        </div>
      </div>
      
      {/* Edit Modal */}
      {editingSubject && (
        <SubjectEditForm
          subject={editingSubject}
          open={editFormOpen}
          onClose={handleEditClose}
          onSuccess={handleEditSuccess}
          examSchedulerEnabled={examSchedulerEnabled || study?.exam_scheduler_enabled}
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

      {/* Subject Materials Dialog */}
      <SubjectMaterialsDialog
        subject={materialsDialogSubject}
        study={study}
        isOpen={materialsDialogOpen}
        onClose={() => {
          setMaterialsDialogOpen(false)
          setMaterialsDialogSubject(null)
        }}
      />
    </div>
  )
}