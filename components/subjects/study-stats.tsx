"use client"

/**
 * Statistics dispatcher — picks the per-kind stats cards. University studies
 * keep the credit/GPA/hours cards; high-school studies show the unweighted
 * study average. Container components render `<StudyStatsCards />` and never
 * branch on study type.
 */

import type { ComponentType } from "react"
import { STUDY_KIND, resolveStudyKind, type StudyKind } from "@/lib/study-kind"
import { StudyStatisticsCards } from "@/components/study-statistics-cards"
import { HighSchoolStatsCards } from "./highschool-stats-cards"

interface StudyStatsCardsProps {
  study: { type: string }
  subjects: any[]
  variant?: "full" | "simple"
}

interface KindStatsProps {
  subjects: any[]
  variant?: "full" | "simple"
}

const STATS_VIEWS: Record<StudyKind, ComponentType<KindStatsProps>> = {
  [STUDY_KIND.UNIVERSITY]: StudyStatisticsCards,
  [STUDY_KIND.HIGH_SCHOOL]: HighSchoolStatsCards,
}

export function StudyStatsCards({ study, subjects, variant = "full" }: StudyStatsCardsProps) {
  const View = STATS_VIEWS[resolveStudyKind(study.type)]
  return <View subjects={subjects} variant={variant} />
}
