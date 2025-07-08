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
  semester: number
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
  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      loadAvailableSubjects()
      setSelectedSubjects(new Set())
      setError(null)
    }
  }, [isOpen])

  const loadAvailableSubjects = async () => {
    try {
      // Get the primary subject to find its study_id
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

      const studyId = subjectData.study_id
      const studyName = subjectData.studies?.name || "Neznámé studium"

      // Get all subjects from the same study
      const { data: allSubjects, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, name, study_id, semester, completed, planned, subject_type")
        .eq("study_id", studyId)

      if (subjectsError) throw subjectsError

      // Get already linked subjects
      const { data: linkedSubjects, error: linkedError } = await supabase
        .from("study_note_subjects")
        .select("subject_id")
        .eq("study_note_id", note.id)

      if (linkedError && linkedError.code !== 'PGRST116') throw linkedError

      const linkedSubjectIds = new Set(linkedSubjects?.map(ls => ls.subject_id) || [])

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
      const available = (allSubjects || [])
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
          semester: subject.semester
        }))

      setAvailableSubjects(available)
    } catch (err) {
      console.error("Failed to load available subjects:", err)
      setError("Nepodařilo se načíst dostupné předměty")
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

      // Link to each selected subject using direct insert
      for (const subjectId of selectedSubjects) {
        const { error } = await supabase
          .from("study_note_subjects")
          .insert({
            study_note_id: note.id,
            subject_id: subjectId,
            is_primary: false,
            linked_by: user.id
          })

        if (error && error.code !== '23505') throw error // Ignore duplicate key errors
      }

      onUpdate()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se propojit s předměty")
    } finally {
      setLoading(false)
    }
  }

  const handleUnlink = async (subjectId: string) => {
    if (!confirm("Opravdu chcete odpojit tento zápis od vybraného předmětu?")) return

    setLoading(true)
    setError(null)

    try {
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

      // Delete the link directly
      const { error } = await supabase
        .from("study_note_subjects")
        .delete()
        .eq("study_note_id", note.id)
        .eq("subject_id", subjectId)

      if (error) throw error
      
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

  const primarySubject = note.subjects?.find(s => s.is_primary)
  const linkedSubjects = note.subjects?.filter(s => !s.is_primary) || []

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

          {/* Current subject (primary) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Hlavní předmět</Label>
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Badge variant="default" className="bg-blue-600">
                {primarySubject?.name || "Neznámý předmět"}
              </Badge>
              <span className="text-sm text-gray-600">(nelze změnit)</span>
            </div>
          </div>

          {/* Linked subjects */}
          {linkedSubjects.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Propojené předměty</Label>
              <div className="space-y-2">
                {linkedSubjects.map(subject => (
                  <div key={subject.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <Badge variant="outline">{subject.name}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnlink(subject.id)}
                      disabled={loading}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Unlink className="h-4 w-4 mr-1" />
                      Odpojit
                    </Button>
                  </div>
                ))}
              </div>
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
                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:text-white border-gray-300"
                      />
                      <Label
                        htmlFor={subject.id}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {subject.name}
                        <span className="text-gray-500 ml-2">
                          ({subject.semester}. semestr)
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {availableSubjects.length === 0 && linkedSubjects.length === 0 && (
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
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
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