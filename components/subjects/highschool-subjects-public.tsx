"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen } from "lucide-react"
import { derivePeriods } from "@/lib/highschool/grades"
import { HighSchoolGradeMatrix } from "./highschool-grade-matrix"
import type { HighSchoolSubject } from "./highschool-subject-form"
import type { StudySubjectsPublicProps } from "./types"

export function HighSchoolSubjectsPublic({ study, subjects }: StudySubjectsPublicProps) {
  const hsSubjects = subjects as unknown as HighSchoolSubject[]
  const periods = useMemo(() => derivePeriods(study, hsSubjects), [study, hsSubjects])
  const sortedSubjects = useMemo(
    () => [...hsSubjects].sort((a, b) => a.name.localeCompare(b.name, "cs")),
    [hsSubjects],
  )

  return (
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
  )
}
