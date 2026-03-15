"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { ChevronRight, ChevronDown, FileText, AlertCircle, Search } from "lucide-react"
import { fetchStudyNotes } from "@/lib/actions/study-notes"
import { fetchSubjectsByIds } from "@/lib/actions/subjects"
import { fetchFinalExamsByIds } from "@/lib/actions/final-exams"
import { StudyNoteOverviewCard } from "@/components/study-note-overview-card"
import type { StudyNoteWithSubjects, StudyNoteSubject } from "@/lib/types/study-notes"

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

interface LinkedSubjectEntry {
  subject_id: string
  is_primary: boolean
}

interface LinkedFinalExamEntry {
  final_exam_id: string
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
  onedrive_embed_url?: string | null
  is_public: boolean
  public_slug?: string | null
  last_modified_onedrive?: string | null
  created_at: string
  description?: string | null
  converted_html?: string | null
  converted_at?: string | null
  onedrive_ctag?: string | null
  linked_subjects?: LinkedSubjectEntry[]
  linked_final_exams?: LinkedFinalExamEntry[]
  [key: string]: unknown
}

export function StudyNotesOverviewSection({ studyId, study }: StudyNotesOverviewSectionProps) {
  const [studyNotes, setStudyNotes] = useState<StudyNoteWithSubjects[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const loadStudyNotes = useCallback(async (silent = false) => {
      if (!silent) {
        setLoading(true)
        setError(null)
      }

      try {
        const notesData = await fetchStudyNotes(studyId) as RawStudyNoteFromMongo[]

        // Get all unique subject and final exam IDs from denormalized arrays
        const subjectIds = new Set<string>()
        const finalExamIds = new Set<string>()
        notesData?.forEach((note) => {
          note.linked_subjects?.forEach((link) => {
            subjectIds.add(link.subject_id)
          })
          note.linked_final_exams?.forEach((link) => {
            finalExamIds.add(link.final_exam_id)
          })
        })

        // Fetch subject details
        type SubjectEntry = { id: string; name: string; study_id: string }
        const subjectsMap = new Map<string, SubjectEntry>()
        if (subjectIds.size > 0) {
          const subjectsData = await fetchSubjectsByIds(Array.from(subjectIds)) as SubjectEntry[]
          subjectsData?.forEach((subject) => {
            subjectsMap.set(subject.id, subject)
          })
        }

        // Fetch final exam details
        type FinalExamEntry = { id: string; name: string; shortcut?: string | null; study_id: string }
        const finalExamsMap = new Map<string, FinalExamEntry>()
        if (finalExamIds.size > 0) {
          const finalExamsData = await fetchFinalExamsByIds(Array.from(finalExamIds)) as FinalExamEntry[]
          finalExamsData?.forEach((exam) => {
            finalExamsMap.set(exam.id, exam)
          })
        }

        // Transform the data to include subject and final exam information
        const transformedNotes: StudyNoteWithSubjects[] = (notesData || []).map((note) => {
          const subjectItems = (note.linked_subjects || []).map((link) => {
            const subject = subjectsMap.get(link.subject_id)
            return subject ? {
              ...subject,
              is_primary: link.is_primary
            } : null
          }).filter((x): x is StudyNoteSubject => x !== null)

          const examItems = (note.linked_final_exams || []).map((link): StudyNoteSubject | null => {
            const exam = finalExamsMap.get(link.final_exam_id)
            return exam ? {
              id: exam.id,
              name: `${exam.shortcut ? `${exam.shortcut} - ` : ""}${exam.name}`,
              study_id: exam.study_id,
              is_primary: link.is_primary,
              is_final_exam: true
            } : null
          }).filter((x): x is StudyNoteSubject => x !== null)

          return {
            ...note,
            subjects: [...subjectItems, ...examItems]
          }
        })

        setStudyNotes(transformedNotes)
      } catch (err) {
        if (!silent) {
          setError("Nepodařilo se načíst studijní zápisy")
        }
        console.error(err)
      } finally {
        if (!silent) {
          setLoading(false)
        }
      }
  }, [studyId])

  useEffect(() => {
    loadStudyNotes()
  }, [loadStudyNotes])

  // Refresh periodically when page is visible
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    const startPolling = () => {
      // Poll every 5 seconds when visible
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
        // Refresh immediately when page becomes visible
        loadStudyNotes(true) // silent refresh
        startPolling()
      }
    }

    // Start polling if page is visible
    if (!document.hidden) {
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadStudyNotes])


  // Filter notes based on search query
  const filteredNotes = studyNotes.filter(note => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      note.name.toLowerCase().includes(query) ||
      note.description?.toLowerCase().includes(query) ||
      note.subjects?.filter(Boolean).some(s => s.name.toLowerCase().includes(query))
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
