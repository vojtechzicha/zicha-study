"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Plus, BookOpen } from "lucide-react"
import { fetchStudyNotesBySubjectId } from "@/lib/actions/study-notes"
import { StudyNoteCard } from "@/components/study-note-card"
import { AddStudyNoteDialog } from "@/components/add-study-note-dialog"
import type { StudyNoteWithSubjects, StudyNoteSubject } from "@/lib/types/study-notes"

interface LinkedSubjectEntry {
  subject_id: string
  is_primary: boolean
}

interface RawStudyNoteFromMongo {
  id: string
  study_id: string
  user_id: string
  name: string
  file_name: string
  file_extension: string | null
  onedrive_item_id?: string | null
  onedrive_web_url?: string | null
  onedrive_download_url?: string | null
  is_public: boolean
  public_slug?: string | null
  last_modified_onedrive?: string | null
  created_at: string
  description?: string | null
  linked_subjects?: LinkedSubjectEntry[]
  linked_final_exams?: Array<{ final_exam_id: string; is_primary: boolean }>
  [key: string]: unknown
}

interface StudyNotesSectionProps {
  studyId: string
  subjectId: string
  studySlug?: string
  isStudyPublic?: boolean
}

export function StudyNotesSection({ studyId, subjectId, studySlug, isStudyPublic }: StudyNotesSectionProps) {
  const [notes, setNotes] = useState<StudyNoteWithSubjects[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchStudyNotesBySubjectId(subjectId) as RawStudyNoteFromMongo[]

      // Transform the data to match our interface
      // The notes now have linked_subjects array embedded
      const notesWithSubjects: StudyNoteWithSubjects[] = (data || []).map((note) => {
        const subjects: StudyNoteSubject[] = (note.linked_subjects || []).map((link) => ({
          id: link.subject_id,
          name: "", // Name not available from denormalized data, but not needed here
          study_id: note.study_id,
          is_primary: link.is_primary
        }))

        return {
          ...note,
          subjects
        }
      })

      setNotes(notesWithSubjects)
    } catch (err) {
      console.error("Failed to load study notes:", err)
    } finally {
      setLoading(false)
    }
  }, [subjectId])

  useEffect(() => {
    loadNotes()
  }, [subjectId, loadNotes])

  const handleNoteDeleted = (noteId: string) => {
    setNotes(notes.filter(note => note.id !== noteId))
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
              currentSubjectId={subjectId}
            />
          ))}
        </div>
      )}

      <AddStudyNoteDialog
        studyId={studyId}
        subjectId={subjectId}
        studySlug={studySlug}
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={loadNotes}
      />
    </div>
  )
}
