"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ChevronRight, FileText, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { StudyNoteOverviewCard } from "@/components/study-note-overview-card"
import type { StudyNoteWithSubjects } from "@/lib/types/study-notes"

interface Study {
  id: string
  name: string
  is_public?: boolean
  public_slug?: string
}

interface PublicStudyNotesSectionProps {
  studyId: string
  study?: Study
}

export function PublicStudyNotesSection({ studyId, study }: PublicStudyNotesSectionProps) {
  const [studyNotes, setStudyNotes] = useState<StudyNoteWithSubjects[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const loadStudyNotes = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Get all public study notes for this study with their subject and final exam links
        const { data: notesData, error: notesError } = await supabase
          .from("study_notes")
          .select(`
            *,
            study_note_subjects (
              id,
              is_primary,
              subject_id
            ),
            study_note_final_exams (
              id,
              is_primary,
              final_exam_id
            )
          `)
          .eq("study_id", studyId)
          .eq("is_public", true)
          .order("last_modified_onedrive", { ascending: false, nullsFirst: false })

        if (notesError) throw notesError

        // Get all unique subject and final exam IDs
        const subjectIds = new Set<string>()
        const finalExamIds = new Set<string>()
        notesData?.forEach(note => {
          note.study_note_subjects?.forEach((link: any) => {
            subjectIds.add(link.subject_id)
          })
          note.study_note_final_exams?.forEach((link: any) => {
            finalExamIds.add(link.final_exam_id)
          })
        })

        // Fetch subject details
        let subjectsMap = new Map<string, any>()
        if (subjectIds.size > 0) {
          const { data: subjectsData, error: subjectsError } = await supabase
            .from("subjects")
            .select("id, name, study_id")
            .in("id", Array.from(subjectIds))

          if (subjectsError) throw subjectsError
          
          subjectsData?.forEach(subject => {
            subjectsMap.set(subject.id, subject)
          })
        }

        // Fetch final exam details
        let finalExamsMap = new Map<string, any>()
        if (finalExamIds.size > 0) {
          const { data: finalExamsData, error: finalExamsError } = await supabase
            .from("final_exams")
            .select("id, name, shortcut, study_id")
            .in("id", Array.from(finalExamIds))

          if (finalExamsError) throw finalExamsError
          
          finalExamsData?.forEach(exam => {
            finalExamsMap.set(exam.id, exam)
          })
        }

        // Transform the data to include subject and final exam information
        const transformedNotes: StudyNoteWithSubjects[] = notesData?.map(note => ({
          ...note,
          subjects: [
            ...(note.study_note_subjects?.map((link: any) => {
              const subject = subjectsMap.get(link.subject_id)
              return subject ? {
                ...subject,
                is_primary: link.is_primary
              } : null
            }).filter(Boolean) || []),
            ...(note.study_note_final_exams?.map((link: any) => {
              const exam = finalExamsMap.get(link.final_exam_id)
              return exam ? {
                ...exam,
                name: `${exam.shortcut ? `${exam.shortcut} - ` : ""}${exam.name}`,
                is_primary: link.is_primary,
                is_final_exam: true
              } : null
            }).filter(Boolean) || [])
          ]
        })) || []

        setStudyNotes(transformedNotes)
      } catch (err) {
        setError("Nepodařilo se načíst studijní zápisy")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    loadStudyNotes()
  }, [studyId, supabase])

  // Show only first 8 study notes in preview mode
  const displayedNotes = showAll ? studyNotes : studyNotes.slice(0, 8)

  if (studyNotes.length === 0 && !loading) {
    return null // Don't show the section if there are no public study notes
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <div>
          <CardTitle className="text-xl font-bold text-gray-900">Studijní zápisy</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Veřejně dostupné studijní zápisy
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-32 bg-primary-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !showAll ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {displayedNotes.map((note) => (
                <StudyNoteOverviewCard
                  key={note.id}
                  note={note}
                  studySlug={study?.public_slug}
                />
              ))}
            </div>
            {studyNotes.length > 8 && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAll(true)}
                  className="text-gray-700"
                >
                  Zobrazit všechny zápisy ({studyNotes.length})
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => setShowAll(false)}
              size="sm"
              className="mb-4"
            >
              Zobrazit méně
            </Button>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {studyNotes.map((note) => (
                <StudyNoteOverviewCard
                  key={note.id}
                  note={note}
                  studySlug={study?.public_slug}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}