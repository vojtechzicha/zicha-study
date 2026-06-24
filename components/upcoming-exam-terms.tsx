"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Clock, Monitor, Lock } from "lucide-react"
import { StudyLogo } from "@/components/study-logo"

export interface UpcomingExamTerm {
  term: {
    id: string
    date: string
    start_time: string
    duration_minutes: number
    is_online: boolean
    note: string | null
  }
  study: { id: string; name: string; logo_url: string | null } | null
  subject: { id: string; name: string; abbreviation: string | null } | null
  period: { id: string; name: string } | null
}

interface UpcomingExamTermsProps {
  terms: UpcomingExamTerm[]
  onTermClick?: (_studyId: string) => void
}

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export function UpcomingExamTerms({ terms, onTermClick }: UpcomingExamTermsProps) {
  if (terms.length === 0) return null

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-bold text-gray-900">Nadcházející zkoušky</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{terms.length}</span>
      </div>
      <div className="space-y-2">
        {terms.map(({ term, study, subject, period }) => (
          <Card
            key={term.id}
            onClick={() => study && onTermClick?.(study.id)}
            className="bg-white/80 backdrop-blur-sm border-0 shadow hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <CardContent className="flex items-center gap-3 p-3">
              {study && <StudyLogo logoUrl={study.logo_url} studyName={study.name} size="sm" className="flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 truncate">
                    {subject ? (subject.abbreviation ? `[${subject.abbreviation}] ${subject.name}` : subject.name) : "Zkouška"}
                  </span>
                  <Badge variant="secondary" className="bg-primary-100 text-primary-700">
                    <Lock className="h-3 w-3 mr-1" />
                    {study?.name}
                  </Badge>
                  {term.is_online && (
                    <Badge variant="secondary" className="bg-green-200 text-green-800">
                      <Monitor className="h-3 w-3 mr-1" />
                      Online
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDate(term.date)} · {(term.start_time || "").substring(0, 5)}
                  </span>
                  {period && <span className="text-gray-400">• {period.name}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
