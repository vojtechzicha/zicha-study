"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, BookOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { StudyNoteCard } from "@/components/study-note-card"
import { AddStudyNoteDialog } from "@/components/add-study-note-dialog"
import type { StudyNote } from "@/lib/types/study-notes"

interface StudyNotesSectionProps {
  studyId: string
  subjectId: string
  studySlug?: string
  isStudyPublic?: boolean
}

export function StudyNotesSection({ studyId, subjectId, studySlug, isStudyPublic }: StudyNotesSectionProps) {
  const [notes, setNotes] = useState<StudyNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadNotes()
  }, [subjectId])

  const loadNotes = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("study_notes")
        .select("*")
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setNotes(data || [])
    } catch (err) {
      console.error("Failed to load study notes:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleNoteDeleted = (noteId: string) => {
    setNotes(notes.filter(note => note.id !== noteId))
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
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
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
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