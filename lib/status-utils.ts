// Study status types and utilities
import { STUDY_STATUS, StudyStatus, getStudyStatusLabel, getCompletionTypeShortCode } from './constants'

// Re-export the type for backward compatibility
export type { StudyStatus }

export interface Study {
  id: string
  name: string
  type: string
  form: string
  start_year: number
  end_year?: number
  status: StudyStatus
  logo_url?: string
  is_public?: boolean
  public_slug?: string
  is_url?: string
  created_at: string
}

export interface Subject {
  id: string
  study_id: string
  semester: string
  abbreviation: string | null
  name: string
  completion_type: string
  credits: number
  points?: number
  completed: boolean
  exam_completed: boolean
  credit_completed: boolean
  planned?: boolean
  final_date?: string
  subject_type: string
  hours?: number
  grade?: string
  lecturer?: string
  department?: string
  created_at: string
  is_repeat?: boolean
}

// Status styling utilities
export const getStatusColor = (status: StudyStatus): string => {
  switch (status) {
    case STUDY_STATUS.ACTIVE:
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-200 dark:border-green-800"
    case STUDY_STATUS.COMPLETED:
      return "bg-primary-100 text-primary-800 border-primary-200 dark:bg-primary-900/50 dark:text-primary-200 dark:border-primary-800"
    case STUDY_STATUS.PAUSED:
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-200 dark:border-yellow-800"
    case STUDY_STATUS.ABANDONED:
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800"
    case STUDY_STATUS.PLANNED:
      return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-800"
    case STUDY_STATUS.INTENDED:
      return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-800"
    default:
      return "bg-primary-100 text-primary-800 border-primary-200 dark:bg-primary-900/50 dark:text-primary-200 dark:border-primary-800"
  }
}

export const getStatusText = (status: StudyStatus): string => {
  return getStudyStatusLabel(status)
}

// Status priority for sorting (lower number = higher priority)
export const getStatusPriority = (status: StudyStatus): number => {
  switch (status) {
    case STUDY_STATUS.ACTIVE:
      return 1
    case STUDY_STATUS.PLANNED:
      return 2
    case STUDY_STATUS.INTENDED:
      return 3
    case STUDY_STATUS.COMPLETED:
      return 4
    case STUDY_STATUS.PAUSED:
      return 5
    case STUDY_STATUS.ABANDONED:
      return 6
    default:
      return 7
  }
}

// Subject state types
export type SubjectState = "planned" | "active" | "completed" | "failed"

// Check if a subject is failed (grade starts with F, 4, or -)
export const isSubjectFailed = (subject: Pick<Subject, 'completed' | 'grade'>): boolean => {
  if (!subject.completed || !subject.grade) return false
  const g = subject.grade.toUpperCase()
  return g.startsWith('F') || g.startsWith('4') || g.startsWith('-')
}

// Get grade badge configuration.
// The colours live in `className` (not inline styles) so they can carry `dark:`
// variants; `style` is kept for backwards compatibility with the consumers.
export const getGradeBadgeConfig = (grade: string, subject: Pick<Subject, 'completed' | 'grade'>) => {
  const style: Record<string, string> = {}

  // Failed state has precedence - darker red for failed
  if (isSubjectFailed(subject)) {
    return {
      className: "border bg-red-600 text-white border-red-700",
      style
    }
  }

  const gradeUpper = grade.toUpperCase()

  // Deep green for 1/A
  if (gradeUpper === '1' || gradeUpper === 'A') {
    return {
      className: "border bg-emerald-600 text-white border-emerald-700",
      style
    }
  }

  // Light green for 1-/B
  if (gradeUpper === '1-' || gradeUpper === 'B') {
    return {
      className:
        "border bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
      style
    }
  }

  // Yellow for 2, 2-/C
  if (gradeUpper === '2' || gradeUpper === '2-' || gradeUpper === 'C') {
    return {
      className:
        "border bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700",
      style
    }
  }

  // Orange for poor grades (D, E, 3-9) - different from failed
  if (/^[3-9]/.test(gradeUpper) || gradeUpper === 'D' || gradeUpper === 'E') {
    return {
      className:
        "border bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800",
      style
    }
  }

  // Blue for any other (including Z)
  return {
    className:
      "border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    style
  }
}

// Get Czech plural form for points
export const getCzechPointsWord = (points: number): string => {
  return points === 1 ? 'bod' : points >= 2 && points <= 4 ? 'body' : 'bodů'
}

// Get Czech plural form for hours
export const getCzechHoursWord = (hours: number): string => {
  return hours === 1 ? 'hodina' : hours >= 2 && hours <= 4 ? 'hodiny' : 'hodin'
}

// Get Czech plural form for credits
export const getCzechCreditsWord = (credits: number): string => {
  return credits === 1 ? 'kredit' : credits >= 2 && credits <= 4 ? 'kredity' : 'kreditů'
}

// Get Czech plural form for subjects
export const getCzechSubjectsWord = (count: number): string => {
  return count === 1 ? 'předmět' : count >= 2 && count <= 4 ? 'předměty' : 'předmětů'
}

// Get credits and hours display data
export const getCreditsAndHoursDisplay = (credits: number, hours?: number) => {
  const hasCredits = credits !== undefined && credits !== null
  const hasHours = hours !== undefined && hours !== null && hours > 0
  
  if (!hasCredits && !hasHours) {
    return { type: 'none' as const }
  }
  
  if (hasCredits && hasHours) {
    return {
      type: 'both' as const,
      credits,
      hours,
      hoursText: getCzechHoursWord(hours)
    }
  }
  
  if (hasCredits) {
    return {
      type: 'credits' as const,
      credits
    }
  }
  
  if (hasHours) {
    return {
      type: 'hours' as const,
      hours,
      hoursText: getCzechHoursWord(hours)
    }
  }
  
  return { type: 'none' as const }
}

// Get credits and hours display for mobile (with labels)
export const getCreditsAndHoursDisplayMobile = (credits: number, hours?: number) => {
  const hasCredits = credits !== undefined && credits !== null
  const hasHours = hours !== undefined && hours !== null && hours > 0
  
  if (!hasCredits && !hasHours) {
    return { type: 'none' as const }
  }
  
  if (hasCredits && hasHours) {
    return {
      type: 'both' as const,
      credits,
      hours,
      creditsText: getCzechCreditsWord(credits),
      hoursText: getCzechHoursWord(hours)
    }
  }
  
  if (hasCredits) {
    return {
      type: 'credits' as const,
      credits,
      creditsText: getCzechCreditsWord(credits)
    }
  }
  
  if (hasHours) {
    return {
      type: 'hours' as const,
      hours,
      hoursText: getCzechHoursWord(hours)
    }
  }
  
  return { type: 'none' as const }
}

// Subject status utilities
export const getSubjectStatus = (subject: Subject): SubjectState => {
  if (subject.planned) return "planned"
  if (subject.completed) return "completed"
  return "active"
}

export const getSubjectStatusPriority = (subject: Subject): number => {
  const status = getSubjectStatus(subject)
  switch (status) {
    case "active":
      return 1
    case "completed":
      return 2
    case "planned":
      return 3
    default:
      return 4
  }
}

export const getSubjectStateText = (state: SubjectState, subject?: Subject): string => {
  // Check if subject is failed (completed with grade starting with F)
  if (state === "completed" && subject && isSubjectFailed(subject)) {
    return "Neúspěšný"
  }
  
  switch (state) {
    case "planned":
      return "Plánovaný"
    case "active":
      return "Aktivní"
    case "completed":
      return "Dokončený"
    default:
      return state
  }
}

export const getSubjectStateColor = (state: SubjectState, subject?: Subject, isPublic: boolean = false): string => {
  // Check if subject is failed (completed with grade starting with F)
  if (state === "completed" && subject && isSubjectFailed(subject)) {
    // More subtle styling for public views
    if (isPublic) {
      return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800"
    }
    return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800"
  }
  
  switch (state) {
    case "planned":
      return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-800"
    case "active":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-200 dark:border-green-800"
    case "completed":
      return "bg-primary-100 text-primary-800 border-primary-200 dark:bg-primary-900/50 dark:text-primary-200 dark:border-primary-800"
    default:
      return "bg-primary-100 text-primary-800 border-primary-200 dark:bg-primary-900/50 dark:text-primary-200 dark:border-primary-800"
  }
}

// Field visibility based on subject state
export const isFieldVisibleForState = (field: string, state: SubjectState): boolean => {
  switch (state) {
    case "planned":
      // Planned subjects cannot have points, grade, or final_date
      return !["points", "grade", "final_date"].includes(field)
    case "active":
      // Active subjects can have points but not final_date (until completed)
      return field !== "final_date"
    case "completed":
      // Completed subjects can have all fields
      return true
    default:
      return true
  }
}

// Completion type utilities
export const requiresCredit = (completionType: string): boolean => {
  if (completionType === "Ostatní") return false
  return completionType.includes("Zápočet") || completionType.includes("Zp")
}

export const requiresExam = (completionType: string): boolean => {
  if (completionType === "Ostatní") return false
  return completionType.includes("Zkouška") || completionType.includes("Zk")
}

// Get completion type badge configuration.
// Colours are Tailwind classes (with `dark:` variants) rather than inline
// styles; `style` stays as an empty object for the existing consumers.
export const getCompletionBadgeConfig = (completionType: string) => {
  // Convert database/form values to short codes using the centralized mapping
  const shortType = getCompletionTypeShortCode(completionType)
  const style: Record<string, string> = {}

  const neutral =
    "border-border bg-muted/50 text-foreground/80"

  switch (shortType) {
    case "Zp":
      return {
        text: "Zp",
        className:
          "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300",
        style,
        fullText: "Zápočet"
      }
    case "KZp":
      return {
        text: "KZp",
        className:
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
        style,
        fullText: "Klasifikovaný zápočet"
      }
    case "Zk":
      return {
        text: "Zk",
        className:
          "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
        style,
        fullText: "Zkouška"
      }
    case "Zp+Zk":
      return {
        text: "Zp+Zk",
        className:
          "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
        style,
        fullText: "Zápočet + Zkouška"
      }
    case "-":
      return {
        text: "-",
        className: neutral,
        style,
        fullText: "Ostatní"
      }
    default:
      return {
        text: shortType,
        className: neutral,
        style,
        fullText: shortType
      }
  }
}

// Get subject state badge configuration.
// Colours are Tailwind classes (with `dark:` variants) rather than inline
// styles; `style` stays as an empty object for the existing consumers.
export const getSubjectStateBadgeConfig = (state: SubjectState, subject?: Pick<Subject, 'completed' | 'grade'>, isPublic: boolean = false) => {
  const style: Record<string, string> = {}

  // Check if subject is failed (completed with grade starting with F)
  if (state === "completed" && subject && isSubjectFailed(subject)) {
    // More subtle styling for public views
    if (isPublic) {
      return {
        text: "Neúspěšný",
        className:
          "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
        style
      }
    }
    return {
      text: "Neúspěšný",
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
      style
    }
  }

  switch (state) {
    case "planned":
      return {
        text: "Plánovaný",
        className:
          "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-200",
        style
      }
    case "active":
      return {
        text: "Aktivní",
        className:
          "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300",
        style
      }
    case "completed":
      return {
        text: "Dokončený",
        className:
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
        style
      }
    default:
      return {
        text: state,
        className: "border-border bg-muted/50 text-foreground/80",
        style
      }
  }
}

// Whether new subjects may be started (planned → active) given the study status.
// Only a running study can have subjects newly started; a paused, not-yet-started
// (planned/intended) or finished (completed/abandoned) study cannot.
export const canStartSubjectsInStudy = (studyStatus?: string): boolean =>
  studyStatus === undefined || studyStatus === STUDY_STATUS.ACTIVE

// Whether progress on already-started subjects may be recorded (markCompleted,
// toggleCredit, toggleExam). Allowed while the study runs, and also while it is
// paused — results of subjects started before the pause may still arrive.
export const canRecordSubjectProgressInStudy = (studyStatus?: string): boolean =>
  studyStatus === undefined ||
  studyStatus === STUDY_STATUS.ACTIVE ||
  studyStatus === STUDY_STATUS.PAUSED

// Actions available based on subject state and the study's own status.
//
//   study status       | start subject | record progress (complete/credit/exam)
//   -------------------|---------------|---------------------------------------
//   active             | yes           | yes
//   paused             | no            | yes
//   planned / intended | no            | no
//   completed          | no            | no
//   abandoned          | no            | no
//
// Edit/delete stay available in every combination so records can be corrected.
// An undefined studyStatus (caller without study context) keeps the permissive
// historical behavior.
export const getAvailableActions = (
  state: SubjectState,
  completionType: string = "",
  studyStatus?: string
): string[] => {
  const baseActions = ["edit", "delete"]

  switch (state) {
    case "planned":
      return canStartSubjectsInStudy(studyStatus) ? ["makeActive", ...baseActions] : baseActions
    case "active":
      if (!canRecordSubjectProgressInStudy(studyStatus)) return baseActions
      const activeActions = ["markCompleted"]
      if (requiresCredit(completionType)) activeActions.push("toggleCredit")
      if (requiresExam(completionType)) activeActions.push("toggleExam")
      return [...activeActions, ...baseActions]
    case "completed":
      return baseActions
    default:
      return baseActions
  }
}

// Sorting utilities
export const sortStudiesByStatus = <T extends Pick<Study, 'status' | 'name'>>(studies: T[]): T[] => {
  return studies.sort((a, b) => {
    const priorityA = getStatusPriority(a.status)
    const priorityB = getStatusPriority(b.status)
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    
    // If same priority, sort alphabetically by name
    return a.name.localeCompare(b.name)
  })
}

export const sortSubjectsByStatus = (subjects: Subject[]): Subject[] => {
  return subjects.sort((a, b) => {
    // First sort by status priority
    const priorityA = getSubjectStatusPriority(a)
    const priorityB = getSubjectStatusPriority(b)
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    
    // Then by semester
    if (a.semester !== b.semester) {
      return a.semester.localeCompare(b.semester)
    }
    
    // Then by subject type
    if (a.subject_type !== b.subject_type) {
      return a.subject_type.localeCompare(b.subject_type)
    }
    
    // Finally by name
    return a.name.localeCompare(b.name)
  })
}
