/**
 * Study Kind Strategy
 *
 * A single discriminator (`StudyKind`) derived from `study.type`, plus the
 * per-kind configuration (terminology) that lets shared components render
 * kind-specific copy *as data* instead of branching on study type inline.
 *
 * Components either:
 *   1. dispatch through a kind → component registry (see components/subjects/*), or
 *   2. receive a `StudyTerminology` object and render its strings.
 *
 * This keeps `if (isHighSchool)` out of the UI layer.
 */

import { STUDY_TYPES } from './constants'

export const STUDY_KIND = {
  UNIVERSITY: 'university',
  HIGH_SCHOOL: 'high_school',
} as const

export type StudyKind = (typeof STUDY_KIND)[keyof typeof STUDY_KIND]

/** Resolve the kind from a study's `type` string. Anything that is not an
 *  explicit high-school study is treated as a (university-style) study. */
export function resolveStudyKind(type: string | null | undefined): StudyKind {
  return type === STUDY_TYPES.HIGH_SCHOOL ? STUDY_KIND.HIGH_SCHOOL : STUDY_KIND.UNIVERSITY
}

export function isHighSchool(type: string | null | undefined): boolean {
  return resolveStudyKind(type) === STUDY_KIND.HIGH_SCHOOL
}

/**
 * Kind-specific copy for the "final exams" feature, which exists for both
 * university (Státní závěrečná zkouška / SZZ) and high school (Maturitní
 * zkouška / Maturita) studies. Shared components read these strings.
 */
export interface StudyTerminology {
  finalExamsSectionTitle: string
  finalExamAddButton: string
  finalExamEmptyText: string
  finalExamLoadingText: string
  finalExamDeleteTitle: string
  finalExamDialogAddTitle: string
  finalExamDialogEditTitle: string
  finalExamDialogAddDescription: string
  finalExamDialogEditDescription: string
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
  finalExamEmptyText: 'Zatím nejsou přidány žádné předměty státní závěrečné zkoušky',
  finalExamLoadingText: 'Načítání státních zkoušek...',
  finalExamDeleteTitle: 'Smazat předmět SZZ?',
  finalExamDialogAddTitle: 'Přidat předmět SZZ',
  finalExamDialogEditTitle: 'Upravit předmět SZZ',
  finalExamDialogAddDescription: 'Vyplňte informace o novém předmětu státní závěrečné zkoušky',
  finalExamDialogEditDescription: 'Upravte informace o předmětu státní závěrečné zkoušky',
  finalExamShortcutPlaceholder: 'SZZ1',
  finalExamNamePlaceholder: 'např. Obhajoba diplomové práce',
  finalExamToggleLabel: 'Státní závěrečné zkoušky',
  finalExamToggleDescription: 'Zobrazit sekci pro státní závěrečné zkoušky v tomto studiu',
  finalExamNoteBadge: 'SZZ',
  finalExamGrades: ['A', 'B', 'C', 'D', 'E', 'F', 'N'],
  diplomaNoun: 'Diplom',
  diplomaGenitive: 'diplomu',
  diplomaConferred: 'Udělený diplom',
}

const HIGH_SCHOOL_TERMINOLOGY: StudyTerminology = {
  finalExamsSectionTitle: 'Maturitní zkouška',
  finalExamAddButton: 'Přidat maturitní předmět',
  finalExamEmptyText: 'Zatím nejsou přidány žádné maturitní předměty',
  finalExamLoadingText: 'Načítání maturitní zkoušky...',
  finalExamDeleteTitle: 'Smazat maturitní předmět?',
  finalExamDialogAddTitle: 'Přidat maturitní předmět',
  finalExamDialogEditTitle: 'Upravit maturitní předmět',
  finalExamDialogAddDescription: 'Vyplňte informace o novém maturitním předmětu',
  finalExamDialogEditDescription: 'Upravte informace o maturitním předmětu',
  finalExamShortcutPlaceholder: 'ČJL',
  finalExamNamePlaceholder: 'např. Český jazyk a literatura',
  finalExamToggleLabel: 'Maturitní zkouška',
  finalExamToggleDescription: 'Zobrazit sekci maturitní zkoušky v tomto studiu',
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
