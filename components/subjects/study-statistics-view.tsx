"use client"

/**
 * Statistics page dispatcher. University studies keep the rich
 * semester/credit analytics; high-school studies get the average + grade
 * matrix. The page renders `<StudyStatisticsView />` and never branches.
 */

import type { ComponentType } from "react"
import { STUDY_KIND, resolveStudyKind, type StudyKind } from "@/lib/study-kind"
import { StudyStatistics } from "@/components/study-statistics"
import { HighSchoolStatistics } from "./highschool-statistics"

export interface StatisticsStudy {
  id: string
  name: string
  type: string
  logo_url?: string | null
  start_year: number
  end_year?: number | null
}

export interface KindStatisticsProps {
  study: StatisticsStudy
  subjects: any[]
  onBack: () => void
}

function UniversityStatisticsView({ study, subjects, onBack }: KindStatisticsProps) {
  return (
    <StudyStatistics
      subjects={subjects}
      studyName={study.name}
      studyLogoUrl={study.logo_url ?? undefined}
      onBack={onBack}
    />
  )
}

const VIEWS: Record<StudyKind, ComponentType<KindStatisticsProps>> = {
  [STUDY_KIND.UNIVERSITY]: UniversityStatisticsView,
  [STUDY_KIND.HIGH_SCHOOL]: HighSchoolStatistics,
}

export function StudyStatisticsView(props: KindStatisticsProps) {
  const View = VIEWS[resolveStudyKind(props.study.type)]
  return <View {...props} />
}
