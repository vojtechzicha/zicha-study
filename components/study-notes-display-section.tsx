"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { ChevronRight, ChevronDown, FileText, AlertCircle, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { StudyNoteOverviewCard } from "@/components/study-note-overview-card"
import type { StudyNoteWithSubjects, RawStudyNoteSubjectLink, RawStudyNoteFinalExamLink, SubjectInfo, FinalExamInfo, StudyNoteSubject } from "@/lib/types/study-notes"

interface Study {
  id: string
  name: string
  is_public?: boolean
  public_slug?: string
}

interface StudyNotesDisplaySectionProps {
  studyId: string
  study?: Study
  isPublicView?: boolean
  showSubtitle?: boolean
  showPublicBadge?: boolean
  showSubjectNames?: boolean
}

interface RawStudyNote {
  id: string
  study_id: string
  user_id: string
  name: string
  file_name: string
  file_extension: string | null
  onedrive_item_id: string | null
  onedrive_web_url: string | null
  onedrive_download_url: string | null
  onedrive_embed_url: string | null
  is_public: boolean
  public_slug: string | null
  last_modified_onedrive: string | null
  created_at: string
  description: string | null
  converted_html: string | null
  converted_at: string | null
  onedrive_ctag: string | null
  study_note_subjects?: RawStudyNoteSubjectLink[]
  study_note_final_exams?: RawStudyNoteFinalExamLink[]
}

export function StudyNotesDisplaySection({ 
  studyId, 
  study, 
  isPublicView = false,
  showSubtitle = false,
  showPublicBadge = true,
  showSubjectNames = false
}: StudyNotesDisplaySectionProps) {
  const [studyNotes, setStudyNotes] = useState<StudyNoteWithSubjects[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const supabase = createClient()

  const loadStudyNotes = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    
    try {
      // Build query based on whether it's public view or not
      let query = supabase
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
      
      // Only filter by public status if in public view
      if (isPublicView) {
        query = query.eq("is_public", true)
      }
      
      query = query.order("last_modified_onedrive", { ascending: false, nullsFirst: false })

      const { data: notesData, error: notesError } = await query

      if (notesError) throw notesError

      // Get all unique subject and final exam IDs
      const subjectIds = new Set<string>()
      const finalExamIds = new Set<string>()
      ;(notesData as RawStudyNote[] | null)?.forEach((note: RawStudyNote) => {
        note.study_note_subjects?.forEach((link: RawStudyNoteSubjectLink) => {
          subjectIds.add(link.subject_id)
        })
        note.study_note_final_exams?.forEach((link: RawStudyNoteFinalExamLink) => {
          finalExamIds.add(link.final_exam_id)
        })
      })

      // Fetch subject details
      const subjectsMap = new Map<string, SubjectInfo>()
      if (subjectIds.size > 0) {
        const { data: subjectsData, error: subjectsError } = await supabase
          .from("subjects")
          .select("id, name, study_id")
          .in("id", Array.from(subjectIds))

        if (subjectsError) throw subjectsError

        subjectsData?.forEach((subject: SubjectInfo) => {
          subjectsMap.set(subject.id, subject)
        })
      }

      // Fetch final exam details
      const finalExamsMap = new Map<string, FinalExamInfo>()
      if (finalExamIds.size > 0) {
        const { data: finalExamsData, error: finalExamsError } = await supabase
          .from("final_exams")
          .select("id, name, shortcut, study_id")
          .in("id", Array.from(finalExamIds))

        if (finalExamsError) throw finalExamsError

        finalExamsData?.forEach((exam: FinalExamInfo) => {
          finalExamsMap.set(exam.id, exam)
        })
      }

      // Transform the data to include subject and final exam information
      const transformedNotes: StudyNoteWithSubjects[] = (notesData as RawStudyNote[] | null)?.map((note: RawStudyNote) => {
        if (!showSubjectNames) {
          return { ...note, subjects: [] }
        }

        const subjectItems = note.study_note_subjects?.map((link: RawStudyNoteSubjectLink) => {
          const subject = subjectsMap.get(link.subject_id)
          return subject ? {
            ...subject,
            is_primary: link.is_primary
          } : null
        }).filter((x): x is StudyNoteSubject => x !== null) || []

        const examItems = note.study_note_final_exams?.map((link: RawStudyNoteFinalExamLink): StudyNoteSubject | null => {
          const exam = finalExamsMap.get(link.final_exam_id)
          return exam ? {
            id: exam.id,
            name: `${exam.shortcut ? `${exam.shortcut} - ` : ""}${exam.name}`,
            study_id: exam.study_id,
            is_primary: link.is_primary,
            is_final_exam: true
          } : null
        }).filter((x): x is StudyNoteSubject => x !== null) || []

        return {
          ...note,
          subjects: [...subjectItems, ...examItems]
        }
      }) || []

      setStudyNotes(transformedNotes)
    } catch {
      if (!silent) {
        setError("Nepodařilo se načíst studijní zápisy")
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [studyId, supabase, isPublicView, showSubjectNames])

  useEffect(() => {
    loadStudyNotes()
    
    // Skip realtime subscriptions and polling for public view
    if (isPublicView) return
    
    // Set up realtime subscription for private views
    const channel = supabase
      .channel('study-notes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'study_notes',
          filter: `study_id=eq.${studyId}`
        },
        () => {
          loadStudyNotes(true) // silent refresh
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'study_note_subjects'
        },
        () => {
          loadStudyNotes(true) // silent refresh
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [studyId, supabase, isPublicView, showSubjectNames, loadStudyNotes])

  // Refresh periodically when page is visible (only for private views)
  useEffect(() => {
    if (isPublicView) return
    
    let intervalId: NodeJS.Timeout | null = null

    const startPolling = () => {
      intervalId = setInterval(() => {
        if (!document.hidden) {
          loadStudyNotes(true) // silent refresh
        }
      }, 5000)
    }

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        loadStudyNotes(true) // silent refresh
        startPolling()
      }
    }

    if (!document.hidden) {
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isPublicView, loadStudyNotes])

  // Filter notes based on search query
  const filteredNotes = studyNotes.filter(note => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      note.name.toLowerCase().includes(query) ||
      note.description?.toLowerCase().includes(query) ||
      (showSubjectNames && note.subjects?.filter(Boolean).some(s => s.name.toLowerCase().includes(query)))
    )
  })

  // Show only first 8 study notes in preview mode
  const displayedNotes = showAll ? filteredNotes : filteredNotes.slice(0, 8)

  // Don't show the section if there are no notes and it's public view
  if (isPublicView && studyNotes.length === 0 && !loading) {
    return null
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <CardTitle className="text-xl font-bold text-gray-900">Studijní zápisy</CardTitle>
            {showSubtitle && (
              <p className="text-sm text-gray-600 mt-1">
                {isPublicView ? "Veřejně dostupné studijní zápisy" : "Všechny studijní zápisy napříč předměty"}
              </p>
            )}
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
                  showPublicBadge={showPublicBadge}
                  showSubjectNames={showSubjectNames}
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
                  showPublicBadge={showPublicBadge}
                  showSubjectNames={showSubjectNames}
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