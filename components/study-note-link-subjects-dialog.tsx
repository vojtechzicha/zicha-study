"use client"

import { useState, useEffect } from "react"
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
import { createClient } from "@/lib/supabase/client"
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
  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      loadData()
      setSelectedSubjects(new Set())
      setError(null)
    }
  }, [isOpen])

  const loadData = async () => {
    await loadLinkedFinalExams()
    await loadAvailableSubjects()
  }

  const loadAvailableSubjects = async () => {
    try {
      let studyId: string
      let studyName: string
      
      // Check if the primary is a final exam or subject
      const { data: finalExamLinks } = await supabase
        .from("study_note_final_exams")
        .select("final_exam_id, is_primary")
        .eq("study_note_id", note.id)
        .eq("is_primary", true)
        .single()
      
      if (finalExamLinks) {
        // Primary is a final exam, get study_id from final_exams table
        const { data: examData, error: examError } = await supabase
          .from("final_exams")
          .select("study_id, studies(id, name)")
          .eq("id", finalExamLinks.final_exam_id)
          .single()
          
        if (examError) throw examError
        if (!examData?.study_id) {
          setError("Nepodařilo se najít studium pro státní zkoušku")
          return
        }
        
        studyId = examData.study_id
        studyName = examData.studies?.name || "Neznámé studium"
      } else {
        // Primary is a regular subject
        const primarySubject = note.subjects?.find(s => s.is_primary)
        if (!primarySubject) {
          setError("Hlavní předmět nebyl nalezen")
          return
        }

        // Get the study info for the primary subject
        const { data: subjectData, error: subjectError } = await supabase
          .from("subjects")
          .select("study_id, studies(id, name)")
          .eq("id", primarySubject.id)
          .single()

        if (subjectError) throw subjectError
        if (!subjectData?.study_id) {
          setError("Nepodařilo se najít studium pro hlavní předmět")
          return
        }

        studyId = subjectData.study_id
        studyName = subjectData.studies?.name || "Neznámé studium"
      }

      // Get all subjects from the same study (excluding repeated subjects)
      const { data: allSubjects, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, name, study_id, semester, completed, planned, subject_type")
        .eq("study_id", studyId)
        .eq("is_repeat", false)

      if (subjectsError) throw subjectsError
      
      // Get all final exams from the same study
      const { data: allFinalExams, error: finalExamsError } = await supabase
        .from("final_exams")
        .select("id, name, shortcut, study_id")
        .eq("study_id", studyId)

      if (finalExamsError) throw finalExamsError

      // Get already linked subjects
      const { data: linkedSubjects, error: linkedError } = await supabase
        .from("study_note_subjects")
        .select("subject_id")
        .eq("study_note_id", note.id)

      if (linkedError && linkedError.code !== 'PGRST116') throw linkedError

      // Get already linked final exams
      const { data: linkedFinalExams, error: linkedFinalError } = await supabase
        .from("study_note_final_exams")
        .select("final_exam_id")
        .eq("study_note_id", note.id)

      if (linkedFinalError && linkedFinalError.code !== 'PGRST116') throw linkedFinalError

      const linkedSubjectIds = new Set(linkedSubjects?.map(ls => ls.subject_id) || [])
      const linkedFinalExamIds = new Set(linkedFinalExams?.map(lf => lf.final_exam_id) || [])

      // Helper functions for sorting (matching study detail page)
      const getStatusPriority = (subject: any) => {
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

      // Filter out already linked subjects and sort them
      const availableSubjects = (allSubjects || [])
        .filter(subject => !linkedSubjectIds.has(subject.id))
        .sort((a, b) => {
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
        .map(subject => ({
          id: subject.id,
          name: subject.name,
          study_id: subject.study_id,
          study_name: studyName,
          semester: subject.semester,
          is_final_exam: false
        }))

      // Filter out already linked final exams
      const availableFinalExams = (allFinalExams || [])
        .filter(exam => !linkedFinalExamIds.has(exam.id))
        .sort((a, b) => a.name.localeCompare(b.name, "cs"))
        .map(exam => ({
          id: exam.id,
          name: `${exam.shortcut ? `${exam.shortcut  } - ` : ""}${exam.name}`,
          study_id: exam.study_id,
          study_name: studyName,
          semester: "Státní zkouška",
          is_final_exam: true
        }))

      // Combine subjects and final exams
      const available = [...availableSubjects, ...availableFinalExams]

      setAvailableSubjects(available)
    } catch (err) {
      console.error("Failed to load available subjects:", err)
      setError("Nepodařilo se načíst dostupné předměty")
    }
  }

  const loadLinkedFinalExams = async () => {
    try {
      // Get the linked final exams for this note
      const { data: links, error: linksError } = await supabase
        .from("study_note_final_exams")
        .select("final_exam_id, is_primary")
        .eq("study_note_id", note.id)

      if (linksError && linksError.code !== 'PGRST116') throw linksError

      if (links && links.length > 0) {
        // Get the final exam details
        const finalExamIds = links.map(l => l.final_exam_id)
        const { data: finalExams, error: examsError } = await supabase
          .from("final_exams")
          .select("id, name, shortcut")
          .in("id", finalExamIds)

        if (examsError) throw examsError

        const examsMap = new Map(finalExams?.map(e => [e.id, e]) || [])
        
        const linkedExams = links.map(link => {
          const exam = examsMap.get(link.final_exam_id)
          return exam ? {
            id: exam.id,
            name: `${exam.shortcut ? `${exam.shortcut} - ` : ""}${exam.name}`,
            study_id: "", // Not needed for display
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
  }

  const handleLink = async () => {
    if (selectedSubjects.size === 0) {
      setError("Vyberte alespoň jeden předmět")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Uživatel není přihlášen")

      // Link to each selected item (subject or final exam)
      for (const itemId of selectedSubjects) {
        // Find if this is a final exam or regular subject
        const selectedItem = availableSubjects.find(s => s.id === itemId)
        
        if (selectedItem?.is_final_exam) {
          // Link to final exam
          const { error } = await supabase
            .from("study_note_final_exams")
            .insert({
              study_note_id: note.id,
              final_exam_id: itemId,
              is_primary: false,
              linked_by: user.id
            })

          if (error && error.code !== '23505') throw error
        } else {
          // Link to regular subject
          const { error } = await supabase
            .from("study_note_subjects")
            .insert({
              study_note_id: note.id,
              subject_id: itemId,
              is_primary: false,
              linked_by: user.id
            })

          if (error && error.code !== '23505') throw error
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
        // Check if this is primary for final exam
        const { data: linkData } = await supabase
          .from("study_note_final_exams")
          .select("is_primary")
          .eq("study_note_id", note.id)
          .eq("final_exam_id", subjectId)
          .single()

        if (linkData?.is_primary) {
          throw new Error("Nelze odpojit hlavní státní zkoušku")
        }

        // Delete the final exam link
        const { error } = await supabase
          .from("study_note_final_exams")
          .delete()
          .eq("study_note_id", note.id)
          .eq("final_exam_id", subjectId)

        if (error) throw error
      } else {
        // Check if this is the primary subject
        const { data: linkData } = await supabase
          .from("study_note_subjects")
          .select("is_primary")
          .eq("study_note_id", note.id)
          .eq("subject_id", subjectId)
          .single()

        if (linkData?.is_primary) {
          throw new Error("Nelze odpojit hlavní předmět")
        }

        // Delete the subject link
        const { error } = await supabase
          .from("study_note_subjects")
          .delete()
          .eq("study_note_id", note.id)
          .eq("subject_id", subjectId)

        if (error) throw error
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