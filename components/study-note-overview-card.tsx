"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { BookOpen, Globe, Calendar } from "lucide-react"
import { useRouter } from "next/navigation"
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
}

export function StudyNoteOverviewCard({ 
  note, 
  studySlug,
  showPublicBadge = true,
  showSubjectNames = true
}: StudyNoteOverviewCardProps) {
  const router = useRouter()

  const handleCardClick = () => {
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
            <BookOpen className="h-8 w-8 text-indigo-600" />
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

            {/* OneDrive last modified date */}
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Calendar className="h-3 w-3" />
              <span>
                {formatDate(note.last_modified_onedrive)}
              </span>
            </div>

            {/* Linked subjects/exams */}
            {showSubjectNames && note.subjects && note.subjects.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {note.subjects.slice(0, 2).map(subject => (
                  <Badge key={subject.id} variant="outline" className="text-xs py-0 px-1.5">
                    {subject.name}
                    {subject.is_final_exam && <span className="ml-0.5 text-gray-500">(SZZ)</span>}
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