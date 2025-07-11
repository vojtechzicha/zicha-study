/**
 * Application Constants
 *
 * This file contains all enum values, constants, and configuration options
 * used throughout the application. This ensures consistency and makes
 * maintenance easier by having a single source of truth.
 */

// Study Types
export const STUDY_TYPES = {
  BACHELOR: 'Bakalářské',
  MASTER: 'Magisterské',
  DOCTORAL: 'Doktorské',
  PROFESSIONAL: 'Profesní',
  OTHER: 'Jiné',
} as const

export type StudyType = (typeof STUDY_TYPES)[keyof typeof STUDY_TYPES]

// Study Forms
export const STUDY_FORMS = {
  FULL_TIME: 'prezenční',
  PART_TIME: 'kombinovaný',
  DISTANCE: 'distanční',
} as const

export type StudyForm = (typeof STUDY_FORMS)[keyof typeof STUDY_FORMS]

// Study Status
export const STUDY_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  PAUSED: 'paused',
  ABANDONED: 'abandoned',
  PLANNED: 'planned',
  INTENDED: 'intended',
} as const

export type StudyStatus = (typeof STUDY_STATUS)[keyof typeof STUDY_STATUS]

// Subject Types
export const SUBJECT_TYPES = {
  MANDATORY: 'Povinný',
  MANDATORY_ELECTIVE: 'Povinně volitelný',
  ELECTIVE: 'Volitelný',
  OTHER: 'Ostatní',
} as const

export type SubjectType = (typeof SUBJECT_TYPES)[keyof typeof SUBJECT_TYPES]

// Subject Completion Types
export const COMPLETION_TYPES = {
  EXAM: 'Zk',
  CREDIT: 'Zp',
  CREDIT_EXAM: 'KZp',
  ASSESSMENT: 'Kl',
  OTHER: '-',
} as const

export type CompletionType = (typeof COMPLETION_TYPES)[keyof typeof COMPLETION_TYPES]

// Completion Type Mapping - maps full completion type strings to short codes
export const COMPLETION_TYPE_MAPPING = {
  // Form values (used when creating new subjects)
  'Zápočet (Zp)': COMPLETION_TYPES.CREDIT,
  'Klasifikovaný zápočet (KZp)': COMPLETION_TYPES.CREDIT_EXAM,
  'Zkouška (Zk)': COMPLETION_TYPES.EXAM,
  'Zápočet + Zkouška (Zp+Zk)': 'Zp+Zk',
  'Ostatní': COMPLETION_TYPES.OTHER,
  
  // Database values (what's actually stored, including multi-line strings)
  'Zápočet\n(Zp)': COMPLETION_TYPES.CREDIT,
  'Klasifikovaný zápočet\n(KZp)': COMPLETION_TYPES.CREDIT_EXAM, 
  'Zkouška\n(Zk)': COMPLETION_TYPES.EXAM,
  'Zápočet +\nZkouška\n(Zp+Zk)': 'Zp+Zk',
} as const

// Helper functions to get arrays for form options
export const getStudyTypeOptions = () => Object.values(STUDY_TYPES)
export const getStudyFormOptions = () => Object.values(STUDY_FORMS)
export const getStudyStatusOptions = () => Object.values(STUDY_STATUS)
export const getSubjectTypeOptions = () => Object.values(SUBJECT_TYPES)
export const getCompletionTypeOptions = () => Object.values(COMPLETION_TYPES)

// Helper function to get short code from full completion type string
export const getCompletionTypeShortCode = (completionType: string): string => {
  // First try exact match with the mapping
  const exactMatch = COMPLETION_TYPE_MAPPING[completionType as keyof typeof COMPLETION_TYPE_MAPPING]
  if (exactMatch) {
    return exactMatch
  }
  
  // Fallback: try to extract short code from parentheses (handles variations)
  const regexMatch = completionType.match(/\(([^)]+)\)/)
  if (regexMatch && regexMatch[1]) {
    return regexMatch[1]
  }
  
  // If no match found, return the original string
  return completionType
}

// Subject type configuration for UI rendering
export const SUBJECT_TYPE_CONFIG = {
  [SUBJECT_TYPES.MANDATORY]: {
    color: 'bg-red-50 text-red-700 border-red-200',
    shortCode: 'P',
    order: 1,
    fullText: 'Povinný',
  },
  [SUBJECT_TYPES.MANDATORY_ELECTIVE]: {
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    shortCode: 'PV',
    order: 2,
    fullText: 'Povinně volitelný',
  },
  [SUBJECT_TYPES.ELECTIVE]: {
    color: 'bg-green-50 text-green-700 border-green-200',
    shortCode: 'V',
    order: 3,
    fullText: 'Volitelný',
  },
  [SUBJECT_TYPES.OTHER]: {
    color: 'bg-primary-50 text-primary-700 border-primary-200',
    shortCode: '-',
    order: 5,
    fullText: 'Ostatní',
  },
} as const

// Helper function to get subject type config
export const getSubjectTypeConfig = (type: string) => {
  return (
    SUBJECT_TYPE_CONFIG[type as keyof typeof SUBJECT_TYPE_CONFIG] || {
      color: 'bg-primary-50 text-primary-700 border-primary-200',
      shortCode: type.charAt(0).toUpperCase(),
      order: 999,
      fullText: type,
    }
  )
}

// Helper functions to get display labels
export const getStudyTypeLabel = (type: string): string => {
  return Object.values(STUDY_TYPES).includes(type as StudyType) ? type : STUDY_TYPES.OTHER
}

export const getStudyFormLabel = (form: string): string => {
  const labels = {
    [STUDY_FORMS.FULL_TIME]: 'Prezenční',
    [STUDY_FORMS.PART_TIME]: 'Kombinovaný',
    [STUDY_FORMS.DISTANCE]: 'Distanční',
  }
  return labels[form as StudyForm] || form
}

export const getStudyStatusLabel = (status: string): string => {
  const labels = {
    [STUDY_STATUS.ACTIVE]: 'Aktivní',
    [STUDY_STATUS.COMPLETED]: 'Dokončené',
    [STUDY_STATUS.PAUSED]: 'Pozastavené',
    [STUDY_STATUS.ABANDONED]: 'Zanechané',
    [STUDY_STATUS.PLANNED]: 'Plánované',
    [STUDY_STATUS.INTENDED]: 'Zamýšlené',
  }
  return labels[status as StudyStatus] || status
}

// Material Categories
export const MATERIAL_CATEGORIES = {
  LECTURE: 'Přednáška',
  EXERCISE: 'Cvičení',
  ASSIGNMENT: 'Úkol',
  EXAM: 'Zkouška',
  PROJECT: 'Projekt',
  NOTES: 'Zápisy',
  LITERATURE: 'Literatura',
  OTHER: 'Ostatní',
} as const

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[keyof typeof MATERIAL_CATEGORIES]

// Helper function to get material category options
export const getMaterialCategoryOptions = () => Object.values(MATERIAL_CATEGORIES)

// Final Exam (Státní závěrečná zkouška) related types
export interface FinalExam {
  id: string
  study_id: string
  shortcut?: string
  name: string
  grade?: string
  exam_date?: string
  examiner?: string
  examination_committee_head?: string
  created_at: string
  updated_at: string
}

// Extended Study interface to include final_exams_enabled
export interface StudyWithFinalExams {
  id: string
  user_id: string
  name: string
  type: string
  form: string
  start_year: number
  end_year?: number
  status: StudyStatus
  logo_url?: string
  is_public: boolean
  public_slug?: string
  final_exams_enabled: boolean
  created_at: string
  updated_at: string
}
