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
      return "bg-green-100 text-green-800 border-green-200"
    case STUDY_STATUS.COMPLETED:
      return "bg-primary-100 text-primary-800 border-primary-200"
    case STUDY_STATUS.PAUSED:
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case STUDY_STATUS.ABANDONED:
      return "bg-red-100 text-red-800 border-red-200"
    case STUDY_STATUS.PLANNED:
      return "bg-purple-100 text-purple-800 border-purple-200"
    case STUDY_STATUS.INTENDED:
      return "bg-indigo-100 text-indigo-800 border-indigo-200"
    default:
      return "bg-primary-100 text-primary-800 border-primary-200"
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

// Get grade badge configuration with inline styles
export const getGradeBadgeConfig = (grade: string, subject: Pick<Subject, 'completed' | 'grade'>) => {
  // Failed state has precedence - darker red for failed
  if (isSubjectFailed(subject)) {
    return {
      className: "border",
      style: { color: "white", backgroundColor: "rgb(220, 38, 38)", borderColor: "rgb(185, 28, 28)" }
    }
  }
  
  const gradeUpper = grade.toUpperCase()
  
  // Deep green for 1/A
  if (gradeUpper === '1' || gradeUpper === 'A') {
    return {
      className: "border",
      style: { color: "white", backgroundColor: "rgb(5, 150, 105)", borderColor: "rgb(4, 120, 87)" }
    }
  }
  
  // Light green for 1-/B
  if (gradeUpper === '1-' || gradeUpper === 'B') {
    return {
      className: "border",
      style: { color: "rgb(21, 128, 61)", backgroundColor: "rgb(240, 253, 244)", borderColor: "rgb(187, 247, 208)" }
    }
  }
  
  // Yellow for 2, 2-/C
  if (gradeUpper === '2' || gradeUpper === '2-' || gradeUpper === 'C') {
    return {
      className: "border",
      style: { color: "rgb(161, 98, 7)", backgroundColor: "rgb(254, 249, 195)", borderColor: "rgb(253, 224, 71)" }
    }
  }
  
  // Orange for poor grades (D, E, 3-9) - different from failed
  if (/^[3-9]/.test(gradeUpper) || gradeUpper === 'D' || gradeUpper === 'E') {
    return {
      className: "border",
      style: { color: "rgb(194, 65, 12)", backgroundColor: "rgb(255, 237, 213)", borderColor: "rgb(254, 215, 170)" }
    }
  }
  
  // Blue for any other (including Z)
  return {
    className: "border", 
    style: { color: "rgb(29, 78, 216)", backgroundColor: "rgb(239, 246, 255)", borderColor: "rgb(191, 219, 254)" }
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
      return "bg-orange-50 text-orange-700 border-orange-200"
    }
    return "bg-red-100 text-red-800 border-red-200"
  }
  
  switch (state) {
    case "planned":
      return "bg-purple-100 text-purple-800 border-purple-200"
    case "active":
      return "bg-green-100 text-green-800 border-green-200"
    case "completed":
      return "bg-primary-100 text-primary-800 border-primary-200"
    default:
      return "bg-primary-100 text-primary-800 border-primary-200"
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

// Get completion type badge configuration
export const getCompletionBadgeConfig = (completionType: string) => {
  // Convert database/form values to short codes using the centralized mapping
  const shortType = getCompletionTypeShortCode(completionType)
  
  switch (shortType) {
    case "Zp":
      return {
        text: "Zp",
        className: "border-green-200",
        style: { color: "rgb(21, 128, 61)", backgroundColor: "rgb(240, 253, 244)" },
        fullText: "Zápočet"
      }
    case "KZp":
      return {
        text: "KZp", 
        className: "border-blue-200",
        style: { color: "rgb(29, 78, 216)", backgroundColor: "rgb(239, 246, 255)" },
        fullText: "Klasifikovaný zápočet"
      }
    case "Zk":
      return {
        text: "Zk",
        className: "border-orange-200",
        style: { color: "rgb(194, 65, 12)", backgroundColor: "rgb(255, 247, 237)" },
        fullText: "Zkouška"
      }
    case "Zp+Zk":
      return {
        text: "Zp+Zk",
        className: "border-red-200",
        style: { color: "rgb(185, 28, 28)", backgroundColor: "rgb(254, 242, 242)" },
        fullText: "Zápočet + Zkouška"
      }
    case "-":
      return {
        text: "-",
        className: "border-gray-200",
        style: { color: "rgb(55, 65, 81)", backgroundColor: "rgb(249, 250, 251)" },
        fullText: "Ostatní"
      }
    default:
      return {
        text: shortType,
        className: "border-gray-200",
        style: { color: "rgb(55, 65, 81)", backgroundColor: "rgb(249, 250, 251)" },
        fullText: shortType
      }
  }
}

// Get subject state badge configuration with inline styles
export const getSubjectStateBadgeConfig = (state: SubjectState, subject?: Pick<Subject, 'completed' | 'grade'>, isPublic: boolean = false) => {
  // Check if subject is failed (completed with grade starting with F)
  if (state === "completed" && subject && isSubjectFailed(subject)) {
    // More subtle styling for public views
    if (isPublic) {
      return {
        text: "Neúspěšný",
        className: "border-orange-200",
        style: { color: "rgb(194, 65, 12)", backgroundColor: "rgb(255, 247, 237)" }
      }
    }
    return {
      text: "Neúspěšný",
      className: "border-red-200",
      style: { color: "rgb(185, 28, 28)", backgroundColor: "rgb(254, 242, 242)" }
    }
  }
  
  switch (state) {
    case "planned":
      return {
        text: "Plánovaný",
        className: "border-purple-200",
        style: { color: "rgb(107, 33, 168)", backgroundColor: "rgb(250, 245, 255)" }
      }
    case "active":
      return {
        text: "Aktivní",
        className: "border-green-200",
        style: { color: "rgb(21, 128, 61)", backgroundColor: "rgb(240, 253, 244)" }
      }
    case "completed":
      return {
        text: "Dokončený",
        className: "border-blue-200",
        style: { color: "rgb(29, 78, 216)", backgroundColor: "rgb(239, 246, 255)" }
      }
    default:
      return {
        text: state,
        className: "border-gray-200",
        style: { color: "rgb(55, 65, 81)", backgroundColor: "rgb(249, 250, 251)" }
      }
  }
}

// Actions available based on subject state
export const getAvailableActions = (state: SubjectState, completionType: string = ""): string[] => {
  const baseActions = ["edit", "delete"]
  
  switch (state) {
    case "planned":
      return ["makeActive", ...baseActions]
    case "active":
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
