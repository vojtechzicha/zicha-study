/**
 * `StudyKind` is derived from `study.type`; per-kind terminology lets shared components render
 * kind-specific copy as data instead of branching on study type inline.
 *
 * Components either dispatch through a kind → component registry (see components/subjects/*)
 * or receive a `StudyTerminology` object and render its strings, keeping `if (isHighSchool)`
 * out of the UI layer.
 */

import { STUDY_TYPES } from './constants'

export const STUDY_KIND = {
  UNIVERSITY: 'university',
  HIGH_SCHOOL: 'high_school',
} as const

export type StudyKind = (typeof STUDY_KIND)[keyof typeof STUDY_KIND]

/** Anything that is not explicitly a high-school study is treated as university-style. */
export function resolveStudyKind(type: string | null | undefined): StudyKind {
  return type === STUDY_TYPES.HIGH_SCHOOL ? STUDY_KIND.HIGH_SCHOOL : STUDY_KIND.UNIVERSITY
}

export function isHighSchool(type: string | null | undefined): boolean {
  return resolveStudyKind(type) === STUDY_KIND.HIGH_SCHOOL
}

/**
 * Kind-specific copy, mainly for the final-exams feature: Státní závěrečná zkouška (SZZ) at
 * university, Maturitní zkouška (Maturita) at high school.
 */
export interface StudyTerminology {
  finalExamsSectionTitle: string
  finalExamAddButton: string
  finalExamEmptyText: string
  finalExamLoadingText: string
  finalExamDeleteTitle: string
  /** Subject noun at the start of a sentence: "Předmět SZZ" / "Maturitní předmět". */
  finalExamSubjectNoun: string
  finalExamDialogAddTitle: string
  finalExamDialogEditTitle: string
  finalExamShortcutPlaceholder: string
  finalExamNamePlaceholder: string
  finalExamToggleLabel: string
  finalExamToggleDescription: string
  /** Short tag shown next to linked study notes, e.g. "SZZ" / "Maturita". */
  finalExamNoteBadge: string
  /** Grade options offered when grading a final-exam subject. */
  finalExamGrades: string[]
  /** Name of the graduation document: "Diplom" / "Vysvědčení". */
  diplomaNoun: string
  /** Genitive form for phrases like "Náhled nahraného …": "diplomu" / "vysvědčení". */
  diplomaGenitive: string
  /** "Conferred" heading: "Udělený diplom" / "Udělené vysvědčení". */
  diplomaConferred: string
}

const UNIVERSITY_TERMINOLOGY: StudyTerminology = {
  finalExamsSectionTitle: 'Státní závěrečné zkoušky',
  finalExamAddButton: 'Přidat předmět SZZ',
  finalExamEmptyText: 'Zatím žádné předměty SZZ',
  finalExamLoadingText: 'Načítání…',
  finalExamDeleteTitle: 'Smazat předmět SZZ?',
  finalExamSubjectNoun: 'Předmět SZZ',
  finalExamDialogAddTitle: 'Přidat předmět SZZ',
  finalExamDialogEditTitle: 'Upravit předmět SZZ',
  finalExamShortcutPlaceholder: 'SZZ1',
  finalExamNamePlaceholder: 'např. Obhajoba diplomové práce',
  finalExamToggleLabel: 'Státní závěrečné zkoušky',
  finalExamToggleDescription: 'Zobrazí ve studiu sekci s předměty SZZ.',
  finalExamNoteBadge: 'SZZ',
  finalExamGrades: ['A', 'B', 'C', 'D', 'E', 'F', 'N'],
  diplomaNoun: 'Diplom',
  diplomaGenitive: 'diplomu',
  diplomaConferred: 'Udělený diplom',
}

const HIGH_SCHOOL_TERMINOLOGY: StudyTerminology = {
  finalExamsSectionTitle: 'Maturitní zkouška',
  finalExamAddButton: 'Přidat maturitní předmět',
  finalExamEmptyText: 'Zatím žádné maturitní předměty',
  finalExamLoadingText: 'Načítání…',
  finalExamDeleteTitle: 'Smazat maturitní předmět?',
  finalExamSubjectNoun: 'Maturitní předmět',
  finalExamDialogAddTitle: 'Přidat maturitní předmět',
  finalExamDialogEditTitle: 'Upravit maturitní předmět',
  finalExamShortcutPlaceholder: 'ČJL',
  finalExamNamePlaceholder: 'např. Český jazyk a literatura',
  finalExamToggleLabel: 'Maturitní zkouška',
  finalExamToggleDescription: 'Zobrazí ve studiu sekci s maturitními předměty.',
  finalExamNoteBadge: 'Maturita',
  finalExamGrades: ['1', '2', '3', '4', '5'],
  diplomaNoun: 'Vysvědčení',
  diplomaGenitive: 'vysvědčení',
  diplomaConferred: 'Udělené vysvědčení',
}

const TERMINOLOGY_BY_KIND: Record<StudyKind, StudyTerminology> = {
  [STUDY_KIND.UNIVERSITY]: UNIVERSITY_TERMINOLOGY,
  [STUDY_KIND.HIGH_SCHOOL]: HIGH_SCHOOL_TERMINOLOGY,
}

export function getStudyTerminology(type: string | null | undefined): StudyTerminology {
  return TERMINOLOGY_BY_KIND[resolveStudyKind(type)]
}
