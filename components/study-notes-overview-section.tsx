"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { ChevronRight, ChevronDown, FileText, AlertCircle, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { StudyNoteOverviewCard } from "@/components/study-note-overview-card"
import type { StudyNoteWithSubjects } from "@/lib/types/study-notes"

interface Study {
  id: string
  name: string
  is_public?: boolean
  public_slug?: string
}

interface StudyNotesOverviewSectionProps {
  studyId: string
  study?: Study
}

export function StudyNotesOverviewSection({ studyId, study }: StudyNotesOverviewSectionProps) {
  const [studyNotes, setStudyNotes] = useState<StudyNoteWithSubjects[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const supabase = createClient()

  useEffect(() => {
    const loadStudyNotes = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // First get all study notes for this study with their subject and final exam links
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
                name: `${exam.shortcut ? `${exam.shortcut  } - ` : ""}${exam.name}`,
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

  const fetchStudyNotes = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // First get all study notes for this study with their subject and final exam links
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
              name: `${exam.shortcut ? `${exam.shortcut  } - ` : ""}${exam.name}`,
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

  const handleDelete = async (noteId: string) => {
    setStudyNotes(studyNotes.filter(n => n.id !== noteId))
  }

  const handleNoteUpdate = () => {
    fetchStudyNotes()
  }

  // Filter notes based on search query
  const filteredNotes = studyNotes.filter(note => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      note.name.toLowerCase().includes(query) ||
      note.description?.toLowerCase().includes(query) ||
      note.subjects?.some(s => s.name.toLowerCase().includes(query))
    )
  })

  // Show only first 8 study notes in preview mode
  const displayedNotes = showAll ? filteredNotes : filteredNotes.slice(0, 8)

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <CardTitle className="text-xl font-bold text-gray-900">Studijní zápisy</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Všechny studijní zápisy napříč předměty
            </p>
          </div>
          {studyNotes.length > 0 && (
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Hledat zápisy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          )}
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
        ) : studyNotes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Zatím nejsou přidány žádné studijní zápisy
            </h3>
            <p className="text-gray-600">
              Studijní zápisy můžete přidat v jednotlivých předmětech
            </p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Žádné zápisy neodpovídají vyhledávání
            </h3>
            <p className="text-gray-600">
              Zkuste změnit vyhledávací dotaz
            </p>
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
            {filteredNotes.length > 8 && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAll(true)}
                  className="text-gray-700"
                >
                  Zobrazit všechny zápisy ({filteredNotes.length})
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ) : (
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
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAll(false)}
                className="text-gray-700"
              >
                Zobrazit méně
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}