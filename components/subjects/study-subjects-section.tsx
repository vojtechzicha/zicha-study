"use client"

/**
 * Subjects section dispatcher.
 *
 * The ONLY place that forks on study kind for the subjects area. Each kind
 * registers its admin/public view; the container components just render
 * `<StudySubjectsAdmin />` / `<StudySubjectsPublic />` and never branch.
 */

import type { ComponentType } from "react"
import { STUDY_KIND, resolveStudyKind, type StudyKind } from "@/lib/study-kind"
import { UniversitySubjectsAdmin } from "./university-subjects-admin"
import { UniversitySubjectsPublic } from "./university-subjects-public"
import { HighSchoolSubjectsAdmin } from "./highschool-subjects-admin"
import { HighSchoolSubjectsPublic } from "./highschool-subjects-public"
import type { StudySubjectsAdminProps, StudySubjectsPublicProps } from "./types"

const ADMIN_VIEWS: Record<StudyKind, ComponentType<StudySubjectsAdminProps>> = {
  [STUDY_KIND.UNIVERSITY]: UniversitySubjectsAdmin,
  [STUDY_KIND.HIGH_SCHOOL]: HighSchoolSubjectsAdmin,
}

const PUBLIC_VIEWS: Record<StudyKind, ComponentType<StudySubjectsPublicProps>> = {
  [STUDY_KIND.UNIVERSITY]: UniversitySubjectsPublic,
  [STUDY_KIND.HIGH_SCHOOL]: HighSchoolSubjectsPublic,
}

export function StudySubjectsAdmin(props: StudySubjectsAdminProps) {
  const View = ADMIN_VIEWS[resolveStudyKind(props.study.type)]
  return <View {...props} />
}

export function StudySubjectsPublic(props: StudySubjectsPublicProps) {
  const View = PUBLIC_VIEWS[resolveStudyKind(props.study.type)]
  return <View {...props} />
}
