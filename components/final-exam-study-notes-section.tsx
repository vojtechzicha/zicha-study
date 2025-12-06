"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Plus, BookOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { StudyNoteCard } from "@/components/study-note-card"
import { AddStudyNoteDialog } from "@/components/add-study-note-dialog"
import type { StudyNoteWithSubjects } from "@/lib/types/study-notes"

interface RawStudyNoteResult {
  id: string
  study_id: string
  user_id: string
  name: string
  file_name: string
  file_extension: string | null
  onedrive_item_id: string | null
  onedrive_web_url: string | null
  onedrive_download_url: string | null
  is_public: boolean
  public_slug: string | null
  last_modified_onedrive: string | null
  created_at: string
  description: string | null
}

interface FinalExamStudyNotesSectionProps {
  studyId: string
  finalExamId: string
  studySlug?: string
  isStudyPublic?: boolean
  onUpdate?: () => void
}

export function FinalExamStudyNotesSection({ studyId, finalExamId, studySlug, isStudyPublic, onUpdate }: FinalExamStudyNotesSectionProps) {
  const [notes, setNotes] = useState<StudyNoteWithSubjects[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const supabase = createClient()

  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .rpc("get_final_exam_study_notes", { p_final_exam_id: finalExamId })

      if (error) throw error

      // Transform the data to match our interface
      const notesWithSubjects: StudyNoteWithSubjects[] = (data || []).map((note: RawStudyNoteResult) => ({
        ...note,
        subjects: [] // Final exam notes don't have subjects, but we need this for the interface
      }))

      setNotes(notesWithSubjects)
    } catch (err) {
      console.error("Failed to load study notes:", err)
    } finally {
      setLoading(false)
    }
  }, [finalExamId, supabase])

  useEffect(() => {
    if (!isStudyPublic) {
      loadNotes()
    }
  }, [finalExamId, isStudyPublic, loadNotes])

  // Don't show study notes in public view
  if (isStudyPublic) return null

  const handleNoteDeleted = (noteId: string) => {
    setNotes(notes.filter(note => note.id !== noteId))
    onUpdate?.()
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-32 bg-primary-100 rounded-lg animate-pulse" />
        <div className="h-32 bg-primary-100 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold">Studijní zápisy</h3>
          <span className="text-sm text-gray-500">({notes.length})</span>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          size="sm"
          className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Přidat zápis
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Zatím nebyly přidány žádné studijní zápisy</p>
          <Button
            onClick={() => setShowAddDialog(true)}
            variant="outline"
            size="sm"
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-1" />
            Přidat první zápis
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {notes.map((note) => (
            <StudyNoteCard
              key={note.id}
              note={note}
              onDelete={handleNoteDeleted}
              onUpdate={loadNotes}
              studySlug={studySlug}
              isStudyPublic={isStudyPublic}
              currentSubjectId={finalExamId}
              isFinalExam={true}
            />
          ))}
        </div>
      )}

      <AddStudyNoteDialog
        studyId={studyId}
        subjectId={finalExamId}
        isFinalExam={true}
        studySlug={studySlug}
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={() => {
          loadNotes()
          onUpdate?.()
        }}
      />
    </div>
  )
}