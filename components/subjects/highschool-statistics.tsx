"use client"

import { useMemo } from "react"
import { StudyHeader } from "@/components/study-header"
import { useLogoTheme } from "@/hooks/use-logo-theme"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen } from "lucide-react"
import { derivePeriods } from "@/lib/highschool/grades"
import { HighSchoolStatsCards } from "./highschool-stats-cards"
import { HighSchoolGradeMatrix } from "./highschool-grade-matrix"
import type { HighSchoolSubject } from "./highschool-subject-form"
import type { KindStatisticsProps } from "./study-statistics-view"

export function HighSchoolStatistics({ study, subjects, onBack }: KindStatisticsProps) {
  useLogoTheme(study.logo_url ?? undefined)

  const hsSubjects = subjects as unknown as HighSchoolSubject[]
  const periods = useMemo(() => derivePeriods(study, hsSubjects), [study, hsSubjects])
  const sortedSubjects = useMemo(
    () => [...hsSubjects].sort((a, b) => a.name.localeCompare(b.name, "cs")),
    [hsSubjects],
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <StudyHeader title={study.name} logoUrl={study.logo_url} onBack={onBack} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <HighSchoolStatsCards subjects={hsSubjects} variant="full" />

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary-600" />
              <CardTitle className="text-xl font-bold text-gray-900">Předměty a prospěch</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <HighSchoolGradeMatrix subjects={sortedSubjects} periods={periods} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
