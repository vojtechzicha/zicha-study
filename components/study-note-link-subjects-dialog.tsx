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
      const { data, error } = await supabase
        .rpc("get_available_subjects_for_note", { p_study_note_id: note.id })

      if (error) throw error
      setAvailableSubjects(data || [])
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
      // Link to each selected subject
      for (const subjectId of selectedSubjects) {
        const { error } = await supabase
          .rpc("link_study_note_to_subject", {
            p_study_note_id: note.id,
            p_subject_id: subjectId
          })

        if (error) throw error
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
      const { error } = await supabase
        .rpc("unlink_study_note_from_subject", {
          p_study_note_id: note.id,
          p_subject_id: subjectId
        })

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

  // Group subjects by study
  const subjectsByStudy = availableSubjects.reduce((acc, subject) => {
    if (!acc[subject.study_id]) {
      acc[subject.study_id] = {
        studyName: subject.study_name,
        subjects: []
      }
    }
    acc[subject.study_id].subjects.push(subject)
    return acc
  }, {} as Record<string, { studyName: string; subjects: AvailableSubject[] }>)

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
              <Label className="text-sm font-medium">Dostupné předměty pro propojení</Label>
              <ScrollArea className="h-[300px] border rounded-lg p-4">
                {Object.entries(subjectsByStudy).map(([studyId, { studyName, subjects }]) => (
                  <div key={studyId} className="mb-4">
                    <h4 className="font-medium text-sm mb-2 text-gray-700">{studyName}</h4>
                    <div className="space-y-2 pl-4">
                      {subjects.map(subject => (
                        <div key={subject.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={subject.id}
                            checked={selectedSubjects.has(subject.id)}
                            onCheckedChange={() => toggleSubject(subject.id)}
                            disabled={loading}
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
                  </div>
                ))}
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