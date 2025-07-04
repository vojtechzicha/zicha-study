/**
 * Application Constants
 * 
 * This file contains all enum values, constants, and configuration options
 * used throughout the application. This ensures consistency and makes
 * maintenance easier by having a single source of truth.
 */

// Study Types
export const STUDY_TYPES = {
  BACHELOR: "Bakalářské",
  MASTER: "Magisterské", 
  DOCTORAL: "Doktorské",
  OTHER: "Jiné"
} as const

export type StudyType = typeof STUDY_TYPES[keyof typeof STUDY_TYPES]

// Study Forms
export const STUDY_FORMS = {
  FULL_TIME: "prezenční",
  PART_TIME: "kombinovaný", 
  DISTANCE: "distanční"
} as const

export type StudyForm = typeof STUDY_FORMS[keyof typeof STUDY_FORMS]

// Study Status
export const STUDY_STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  PAUSED: "paused",
  ABANDONED: "abandoned",
  PLANNED: "planned"
} as const

export type StudyStatus = typeof STUDY_STATUS[keyof typeof STUDY_STATUS]

// Subject Types
export const SUBJECT_TYPES = {
  MANDATORY: "Povinný",
  MANDATORY_ELECTIVE: "Povinně volitelný",
  ELECTIVE: "Volitelný", 
  OTHER: "Ostatní"
} as const

export type SubjectType = typeof SUBJECT_TYPES[keyof typeof SUBJECT_TYPES]

// Subject Completion Types
export const COMPLETION_TYPES = {
  EXAM: "Zk",
  CREDIT: "Zp", 
  CREDIT_EXAM: "KZp",
  ASSESSMENT: "Kl"
} as const

export type CompletionType = typeof COMPLETION_TYPES[keyof typeof COMPLETION_TYPES]

// Helper functions to get arrays for form options
export const getStudyTypeOptions = () => Object.values(STUDY_TYPES)
export const getStudyFormOptions = () => Object.values(STUDY_FORMS)
export const getStudyStatusOptions = () => Object.values(STUDY_STATUS)
export const getSubjectTypeOptions = () => Object.values(SUBJECT_TYPES)
export const getCompletionTypeOptions = () => Object.values(COMPLETION_TYPES)

// Helper functions to get display labels
export const getStudyTypeLabel = (type: string): string => {
  return Object.values(STUDY_TYPES).includes(type as StudyType) ? type : STUDY_TYPES.OTHER
}

export const getStudyFormLabel = (form: string): string => {
  const labels = {
    [STUDY_FORMS.FULL_TIME]: "Prezenční",
    [STUDY_FORMS.PART_TIME]: "Kombinovaný", 
    [STUDY_FORMS.DISTANCE]: "Distanční"
  }
  return labels[form as StudyForm] || form
}

export const getStudyStatusLabel = (status: string): string => {
  const labels = {
    [STUDY_STATUS.ACTIVE]: "Aktivní",
    [STUDY_STATUS.COMPLETED]: "Dokončené",
    [STUDY_STATUS.PAUSED]: "Pozastavené",
    [STUDY_STATUS.ABANDONED]: "Ukončené",
    [STUDY_STATUS.PLANNED]: "Plánované"
  }
  return labels[status as StudyStatus] || status
}