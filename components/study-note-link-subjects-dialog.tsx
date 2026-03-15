"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  linkSubjectToNoteAction,
  linkFinalExamToNoteAction,
  unlinkSubjectFromNoteAction,
  unlinkFinalExamFromNoteAction,
  fetchLinkedSubjectIds,
  fetchLinkedFinalExamIds,
} from "@/lib/actions/study-notes"
import { fetchSubjectsByStudyId, fetchSubject } from "@/lib/actions/subjects"
import { fetchFinalExams, fetchFinalExamsByIds } from "@/lib/actions/final-exams"
import { Link, Unlink, AlertCircle } from "lucide-react"
import type { StudyNoteWithSubjects } from "@/lib/types/study-notes"

interface StudyNoteLinkSubjectsDialogProps {
  note: StudyNoteWithSubjects
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

interface AvailableSubject {
  id: string
  name: string
  study_id: string
  study_name: string
  semester: number | string
  is_final_exam?: boolean
  is_primary?: boolean
}

interface DbSubject {
  id: string
  name: string
  study_id: string
  semester: string
  completed: boolean
  planned: boolean
  subject_type: string
  is_repeat?: boolean
  [key: string]: unknown
}

interface DbFinalExam {
  id: string
  name: string
  shortcut: string
  study_id: string
  [key: string]: unknown
}

export function StudyNoteLinkSubjectsDialog({
  note,
  isOpen,
  onClose,
  onUpdate
}: StudyNoteLinkSubjectsDialogProps) {
  const [availableSubjects, setAvailableSubjects] = useState<AvailableSubject[]>([])
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkedFinalExams, setLinkedFinalExams] = useState<AvailableSubject[]>([])

  const loadAvailableSubjects = useCallback(async () => {
    try {
      let studyId: string
      let studyName: string = ""

      // Determine the study from the note's linked data
      // Check if the primary is a final exam or subject using denormalized arrays
      const linkedFinalExamEntries = (note as any).linked_final_exams || []
      const primaryFinalExamEntry = linkedFinalExamEntries.find((e: { is_primary: boolean }) => e.is_primary)

      if (primaryFinalExamEntry) {
        // Primary is a final exam, get study_id from final_exams
        const finalExamIds = [primaryFinalExamEntry.final_exam_id]
        const examData = await fetchFinalExamsByIds(finalExamIds)
        if (!examData || examData.length === 0) {
          setError("Nepodařilo se najít studium pro státní zkoušku")
          return
        }
        studyId = examData[0].study_id
        studyName = "" // We'll use study_id to fetch the study name if needed
      } else {
        // Primary is a regular subject
        const primarySubject = note.subjects?.find(s => s.is_primary)
        if (!primarySubject) {
          setError("Hlavní předmět nebyl nalezen")
          return
        }

        // Get the study info for the primary subject
        const subjectData = await fetchSubject(primarySubject.id)
        if (!subjectData?.study_id) {
          setError("Nepodařilo se najít studium pro hlavní předmět")
          return
        }

        studyId = subjectData.study_id
        studyName = "" // Study name not critical for this UI
      }

      // Get all subjects from the same study (excluding repeated subjects)
      const allSubjects = await fetchSubjectsByStudyId(studyId) as DbSubject[]

      // Get all final exams from the same study
      const allFinalExams = await fetchFinalExams(studyId) as DbFinalExam[]

      // Get already linked subject IDs and final exam IDs
      const linkedSubjectIdsList = await fetchLinkedSubjectIds(note.id)
      const linkedFinalExamIdsList = await fetchLinkedFinalExamIds(note.id)

      const linkedSubjectIdsSet = new Set(linkedSubjectIdsList || [])
      const linkedFinalExamIdsSet = new Set(linkedFinalExamIdsList || [])

      // Helper functions for sorting (matching study detail page)
      const getStatusPriority = (subject: DbSubject) => {
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

      const getTypeOrder = (type: string) => {
        const typeOrders: { [key: string]: number } = {
          "mandatory": 1,
          "mandatory_elective": 2,
          "elective": 3,
          "other": 4
        }
        return typeOrders[type] || 5
      }

      // Filter out already linked subjects and repeated subjects, then sort them
      const availableSubjectsList = (allSubjects || [])
        .filter((subject: DbSubject) => !linkedSubjectIdsSet.has(subject.id) && !subject.is_repeat)
        .sort((a: DbSubject, b: DbSubject) => {
          // First sort by status priority
          const aStatusPriority = getStatusPriority(a)
          const bStatusPriority = getStatusPriority(b)
          if (aStatusPriority !== bStatusPriority) {
            return aStatusPriority - bStatusPriority
          }

          // Then sort by semester
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
        .map((subject: DbSubject) => ({
          id: subject.id,
          name: subject.name,
          study_id: subject.study_id,
          study_name: studyName,
          semester: subject.semester,
          is_final_exam: false
        }))

      // Filter out already linked final exams
      const availableFinalExamsList = (allFinalExams || [])
        .filter((exam: DbFinalExam) => !linkedFinalExamIdsSet.has(exam.id))
        .sort((a: DbFinalExam, b: DbFinalExam) => a.name.localeCompare(b.name, "cs"))
        .map((exam: DbFinalExam) => ({
          id: exam.id,
          name: `${exam.shortcut ? `${exam.shortcut  } - ` : ""}${exam.name}`,
          study_id: exam.study_id,
          study_name: studyName,
          semester: "Státní zkouška",
          is_final_exam: true
        }))

      // Combine subjects and final exams
      const available = [...availableSubjectsList, ...availableFinalExamsList]

      setAvailableSubjects(available)
    } catch (err) {
      console.error("Failed to load available subjects:", err)
      setError("Nepodařilo se načíst dostupné předměty")
    }
  }, [note])

  const loadLinkedFinalExams = useCallback(async () => {
    try {
      // Get the linked final exam IDs for this note from denormalized data
      const linkedFinalExamEntries = (note as any).linked_final_exams || []

      if (linkedFinalExamEntries.length > 0) {
        // Get the final exam details
        const finalExamIds = linkedFinalExamEntries.map((l: { final_exam_id: string }) => l.final_exam_id)
        const finalExams = await fetchFinalExamsByIds(finalExamIds)

        type FinalExamRow = { id: string; name: string; shortcut?: string | null; study_id: string }
        const examsMap = new Map<string, FinalExamRow>()
        ;(finalExams as FinalExamRow[] || []).forEach((e) => { examsMap.set(e.id, e) })

        const linkedExams = linkedFinalExamEntries.map((link: { final_exam_id: string; is_primary: boolean }) => {
          const exam = examsMap.get(link.final_exam_id)
          return exam ? {
            id: exam.id,
            name: `${exam.shortcut ? `${exam.shortcut} - ` : ""}${exam.name}`,
            study_id: exam.study_id || "",
            study_name: "",
            semester: "Státní zkouška",
            is_final_exam: true,
            is_primary: link.is_primary
          } : null
        }).filter(Boolean) as AvailableSubject[]

        setLinkedFinalExams(linkedExams)
      } else {
        setLinkedFinalExams([])
      }
    } catch (err) {
      console.error("Failed to load linked final exams:", err)
    }
  }, [note])

  const loadData = useCallback(async () => {
    await loadLinkedFinalExams()
    await loadAvailableSubjects()
  }, [loadLinkedFinalExams, loadAvailableSubjects])

  useEffect(() => {
    if (isOpen) {
      loadData()
      setSelectedSubjects(new Set())
      setError(null)
    }
  }, [isOpen, loadData])

  const handleLink = async () => {
    if (selectedSubjects.size === 0) {
      setError("Vyberte alespoň jeden předmět")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Link to each selected item (subject or final exam)
      for (const itemId of selectedSubjects) {
        // Find if this is a final exam or regular subject
        const selectedItem = availableSubjects.find(s => s.id === itemId)

        if (selectedItem?.is_final_exam) {
          await linkFinalExamToNoteAction(note.id, itemId, false)
        } else {
          await linkSubjectToNoteAction(note.id, itemId, false)
        }
      }

      onUpdate()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se propojit s předměty")
    } finally {
      setLoading(false)
    }
  }

  const handleUnlink = async (subjectId: string, isFinalExam: boolean = false) => {
    if (!confirm("Opravdu chcete odpojit tento zápis od vybraného předmětu?")) return

    setLoading(true)
    setError(null)

    try {
      if (isFinalExam) {
        // Check if this is primary for final exam using denormalized data
        const linkedFinalExamEntries = (note as any).linked_final_exams || []
        const linkData = linkedFinalExamEntries.find((l: { final_exam_id: string }) => l.final_exam_id === subjectId)

        if (linkData?.is_primary) {
          throw new Error("Nelze odpojit hlavní státní zkoušku")
        }

        await unlinkFinalExamFromNoteAction(note.id, subjectId)
      } else {
        // Check if this is the primary subject using denormalized data
        const linkedSubjectEntries = (note as any).linked_subjects || []
        const linkData = linkedSubjectEntries.find((l: { subject_id: string }) => l.subject_id === subjectId)

        if (linkData?.is_primary) {
          throw new Error("Nelze odpojit hlavní předmět")
        }

        await unlinkSubjectFromNoteAction(note.id, subjectId)
      }

      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se odpojit od předmětu")
    } finally {
      setLoading(false)
    }
  }

  const toggleSubject = (subjectId: string) => {
    const newSelected = new Set(selectedSubjects)
    if (newSelected.has(subjectId)) {
      newSelected.delete(subjectId)
    } else {
      newSelected.add(subjectId)
    }
    setSelectedSubjects(newSelected)
  }

  // Since all subjects are from the same study, we don't need to group them
  const studyName = availableSubjects[0]?.study_name || ""

  // Check if the primary item is a final exam or a regular subject
  const primaryFinalExam = linkedFinalExams.find(fe => fe.is_primary)
  const primarySubject = note.subjects?.find(s => s.is_primary)
  const linkedSubjects = note.subjects?.filter(s => !s.is_primary) || []
  const linkedNonPrimaryFinalExams = linkedFinalExams.filter(fe => !fe.is_primary)
  const allLinkedItems = [...linkedSubjects, ...linkedNonPrimaryFinalExams]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Propojení studijního zápisu s předměty</DialogTitle>
          <DialogDescription>
            Propojte tento zápis s dalšími předměty, aby se zobrazoval v jejich seznamech
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Current primary item (subject or final exam) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {primaryFinalExam ? "Hlavní státní zkouška" : "Hlavní předmět"}
            </Label>
            <div className="flex items-center gap-2 p-3 bg-primary-50 rounded-lg border border-primary-200">
              <Badge variant="default" className="bg-primary-600">
                {primaryFinalExam?.name || primarySubject?.name || "Neznámý předmět"}
              </Badge>
              <span className="text-sm text-gray-600">(nelze změnit)</span>
            </div>
          </div>

          {/* Linked subjects and final exams */}
          {allLinkedItems.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Propojené předměty</Label>
              <ScrollArea className="h-[200px] rounded-md border p-2">
                <div className="space-y-2">
                  {allLinkedItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-primary-50 rounded-lg border mr-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.name}</Badge>
                        {item.is_final_exam && (
                          <span className="text-xs text-gray-500">(Státní zkouška)</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnlink(item.id, item.is_final_exam)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Unlink className="h-4 w-4 mr-1" />
                        Odpojit
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Available subjects */}
          {availableSubjects.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Dostupné předměty pro propojení
                {studyName && <span className="text-gray-500 font-normal ml-2">({studyName})</span>}
              </Label>
              <ScrollArea className="h-[300px] border rounded-lg p-4">
                <div className="space-y-2">
                  {availableSubjects.map(subject => (
                    <div key={subject.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={subject.id}
                        checked={selectedSubjects.has(subject.id)}
                        onCheckedChange={() => toggleSubject(subject.id)}
                        disabled={loading}
                        className="data-[state=checked]:bg-primary-600 data-[state=checked]:text-white border-gray-300"
                      />
                      <Label
                        htmlFor={subject.id}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {subject.name}
                        <span className="text-gray-500 ml-2">
                          {subject.is_final_exam ? "(Státní zkouška)" : `(${subject.semester}. semestr)`}
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {availableSubjects.length === 0 && allLinkedItems.length === 0 && (
            <Alert>
              <AlertDescription>
                Nejsou dostupné žádné další předměty pro propojení.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Zavřít
          </Button>
          {availableSubjects.length > 0 && (
            <Button
              onClick={handleLink}
              disabled={loading || selectedSubjects.size === 0}
              className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
            >
              <Link className="h-4 w-4 mr-2" />
              Propojit vybrané předměty
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
