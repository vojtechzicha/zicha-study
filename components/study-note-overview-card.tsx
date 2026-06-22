"use client"

import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { BookOpen, Globe, Calendar, FileText } from "lucide-react"
import { NOTE_TYPES, getNoteType, getNoteEffectiveDate } from "@/lib/constants"
import type { StudyNoteWithSubjects } from "@/lib/types/study-notes"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface StudyNoteOverviewCardProps {
  note: StudyNoteWithSubjects
  studySlug?: string
  showPublicBadge?: boolean
  showSubjectNames?: boolean
  /** Tag shown next to final-exam links (e.g. "SZZ" / "Maturita"). */
  finalExamBadge?: string
  /** Logged-in study view: open the editor for Markdown notes instead of the public page. */
  ownerView?: boolean
}

export function StudyNoteOverviewCard({
  note,
  studySlug,
  showPublicBadge = true,
  showSubjectNames = true,
  finalExamBadge = "SZZ",
  ownerView = false
}: StudyNoteOverviewCardProps) {
  const router = useRouter()
  const isMarkdown = getNoteType(note) === NOTE_TYPES.MARKDOWN

  const handleCardClick = () => {
    // In the logged-in study view, Markdown notes open the in-app editor;
    // everything else (and the public page) opens the public note URL.
    if (ownerView && isMarkdown) {
      router.push(`/studies/${note.study_id}/notes/${note.id}`)
      return
    }
    if (studySlug && note.public_slug) {
      window.open(`/${studySlug}/${note.public_slug}`, '_blank', 'noopener,noreferrer')
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Neznámé datum"
    return new Date(dateString).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "short",
      year: "numeric"
    })
  }

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full" onClick={handleCardClick}>
      <CardContent className="p-4 h-full flex flex-col">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-shrink-0">
            {isMarkdown ? (
              <FileText className="h-8 w-8 text-primary-600" />
            ) : (
              <BookOpen className="h-8 w-8 text-indigo-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {/* Name with tooltip - always show tooltip on hover */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="font-semibold text-base mb-2 line-clamp-2 leading-tight cursor-help">
                    {note.name}
                  </h3>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{note.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Last change (OneDrive for Word notes, content edit for Markdown) */}
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Calendar className="h-3 w-3" />
              <span>
                {formatDate(getNoteEffectiveDate(note))}
              </span>
            </div>

            {/* Linked subjects/exams */}
            {showSubjectNames && note.subjects && note.subjects.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {note.subjects.slice(0, 2).map(subject => (
                  <Badge key={subject.id} variant="outline" className="text-xs py-0 px-1.5">
                    {subject.name}
                    {subject.is_final_exam && <span className="ml-0.5 text-gray-500">({finalExamBadge})</span>}
                  </Badge>
                ))}
                {note.subjects.length > 2 && (
                  <Badge variant="outline" className="text-xs py-0 px-1.5 text-gray-500">
                    +{note.subjects.length - 2}
                  </Badge>
                )}
              </div>
            )}

            {/* Public status */}
            {showPublicBadge && note.is_public && (
              <Badge variant="secondary" className="text-xs mt-2">
                <Globe className="h-3 w-3 mr-1" />
                Veřejné
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}