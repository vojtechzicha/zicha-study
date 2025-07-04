// Study status types and utilities
export type StudyStatus = "active" | "completed" | "paused" | "abandoned" | "planned"

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
}

// Status styling utilities
export const getStatusColor = (status: StudyStatus): string => {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 border-green-200"
    case "completed":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "paused":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "abandoned":
      return "bg-red-100 text-red-800 border-red-200"
    case "planned":
      return "bg-purple-100 text-purple-800 border-purple-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

export const getStatusText = (status: StudyStatus): string => {
  switch (status) {
    case "active":
      return "Aktivní"
    case "completed":
      return "Dokončené"
    case "paused":
      return "Pozastavené"
    case "abandoned":
      return "Zanechané"
    case "planned":
      return "Plánované"
    default:
      return status
  }
}

// Status priority for sorting (lower number = higher priority)
export const getStatusPriority = (status: StudyStatus): number => {
  switch (status) {
    case "active":
      return 1
    case "planned":
      return 2
    case "completed":
      return 3
    case "paused":
      return 4
    case "abandoned":
      return 5
    default:
      return 6
  }
}

// Subject state types
export type SubjectState = "planned" | "active" | "completed"

// Check if a subject is failed (grade starts with F)
export const isSubjectFailed = (subject: Subject): boolean => {
  return subject.completed && subject.grade?.toUpperCase().startsWith('F') === true
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
      return "bg-blue-100 text-blue-800 border-blue-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
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
  const shortType = completionType.match(/\(([^)]+)\)$/)?.[1] || completionType
  
  switch (shortType) {
    case "Zp":
      return {
        text: "Zp",
        className: "bg-green-50 text-green-700 border-green-200"
      }
    case "KZp":
      return {
        text: "KZp", 
        className: "bg-blue-50 text-blue-700 border-blue-200"
      }
    case "Zk":
      return {
        text: "Zk",
        className: "bg-purple-50 text-purple-700 border-purple-200"
      }
    case "Zp+Zk":
      return {
        text: "Zp+Zk",
        className: "bg-orange-50 text-orange-700 border-orange-200"
      }
    case "Ostatní":
      return {
        text: "-",
        className: "bg-gray-50 text-gray-700 border-gray-200"
      }
    default:
      return {
        text: shortType,
        className: ""
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
export const sortStudiesByStatus = (studies: Study[]): Study[] => {
  return studies.sort((a, b) => {
    const priorityA = getStatusPriority(a.status)
    const priorityB = getStatusPriority(b.status)
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    
    // If same priority, sort by created_at descending
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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