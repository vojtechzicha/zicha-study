// Single source of truth for enum-like values; import from here instead of hardcoding them.

// Reserved routes that should not be accessible as public study slugs
const RESERVED_ROUTES_TUPLE = [
  'auth',
  'studies',
  'api',
  'admin',
  'dashboard',
  'settings',
  'profile',
  'help',
  'about',
  'contact',
  'terms',
  'privacy',
  'public'
] as const

export type ReservedRoute = (typeof RESERVED_ROUTES_TUPLE)[number]

// Widened to readonly string[] so .includes() accepts any string
export const RESERVED_ROUTES: readonly string[] = RESERVED_ROUTES_TUPLE

// 'word'     → legacy notes backed by a OneDrive DOCX file (Mammoth → HTML)
// 'markdown' → native Markdown notes edited in the in-app WYSIWYG editor
// 'obsidian' → read-only Markdown notes backed by a OneDrive .md file
//              (Obsidian vault is the source of truth; converted → HTML)
export const NOTE_TYPES = {
  WORD: 'word',
  MARKDOWN: 'markdown',
  OBSIDIAN: 'obsidian',
} as const

export type NoteType = (typeof NOTE_TYPES)[keyof typeof NOTE_TYPES]

// Notes without an explicit note_type are legacy OneDrive Word notes.
export const getNoteType = (note: { note_type?: string | null } | null | undefined): NoteType =>
  note?.note_type === NOTE_TYPES.MARKDOWN
    ? NOTE_TYPES.MARKDOWN
    : note?.note_type === NOTE_TYPES.OBSIDIAN
      ? NOTE_TYPES.OBSIDIAN
      : NOTE_TYPES.WORD

// Effective "last change" timestamp for a note, regardless of type.
// OneDrive-backed notes (Word, Obsidian) track changes via OneDrive; Markdown notes via content edits.
export const getNoteEffectiveDate = (note: {
  last_modified_onedrive?: string | null
  content_updated_at?: string | null
  updated_at?: string | null
  created_at?: string | null
}): string | null =>
  note.last_modified_onedrive ||
  note.content_updated_at ||
  note.updated_at ||
  note.created_at ||
  null

// Maximum number of historical versions retained per Markdown note.
export const MARKDOWN_NOTE_MAX_VERSIONS = 50

export const STUDY_TYPES = {
  HIGH_SCHOOL: 'Střední škola',
  BACHELOR: 'Bakalářské',
  MASTER: 'Magisterské',
  DOCTORAL: 'Doktorské',
  PROFESSIONAL: 'Profesní',
  OTHER: 'Jiné',
} as const

export type StudyType = (typeof STUDY_TYPES)[keyof typeof STUDY_TYPES]

export const STUDY_FORMS = {
  FULL_TIME: 'prezenční',
  PART_TIME: 'kombinovaný',
  DISTANCE: 'distanční',
} as const

export type StudyForm = (typeof STUDY_FORMS)[keyof typeof STUDY_FORMS]

export const STUDY_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  PAUSED: 'paused',
  ABANDONED: 'abandoned',
  PLANNED: 'planned',
  INTENDED: 'intended',
} as const

export type StudyStatus = (typeof STUDY_STATUS)[keyof typeof STUDY_STATUS]

export const SUBJECT_TYPES = {
  MANDATORY: 'Povinný',
  MANDATORY_ELECTIVE: 'Povinně volitelný',
  ELECTIVE: 'Volitelný',
  OTHER: 'Ostatní',
} as const

export type SubjectType = (typeof SUBJECT_TYPES)[keyof typeof SUBJECT_TYPES]

export const COMPLETION_TYPES = {
  EXAM: 'Zk',
  CREDIT: 'Zp',
  CREDIT_EXAM: 'KZp',
  ASSESSMENT: 'Kl',
  OTHER: '-',
} as const

export type CompletionType = (typeof COMPLETION_TYPES)[keyof typeof COMPLETION_TYPES]

// ECTS to US GPA conversion
export const ECTS_GPA_POINTS = {
  A: 4.0,
  B: 3.5,
  C: 3.0,
  D: 2.5,
  E: 2.0,
  FX: 0.0,
  F: 0.0,
} as const

export const GPA_GRADE_ALIASES = {
  '1': 'A',
  '1-': 'B',
  '2': 'C',
  '2-': 'D',
  '3': 'E',
  '0': 'F',
} as const

export const GPA_EXCLUDED_GRADES = ['Z', 'ZP', 'P', 'W', '-'] as const

// Full completion-type labels → short codes
export const COMPLETION_TYPE_MAPPING = {
  // Form values (used when creating new subjects)
  'Zápočet (Zp)': COMPLETION_TYPES.CREDIT,
  'Klasifikovaný zápočet (KZp)': COMPLETION_TYPES.CREDIT_EXAM,
  'Zkouška (Zk)': COMPLETION_TYPES.EXAM,
  'Zápočet + Zkouška (Zp+Zk)': 'Zp+Zk',
  'Ostatní': COMPLETION_TYPES.OTHER,
  
  // Database values, stored with line breaks
  'Zápočet\n(Zp)': COMPLETION_TYPES.CREDIT,
  'Klasifikovaný zápočet\n(KZp)': COMPLETION_TYPES.CREDIT_EXAM, 
  'Zkouška\n(Zk)': COMPLETION_TYPES.EXAM,
  'Zápočet +\nZkouška\n(Zp+Zk)': 'Zp+Zk',
} as const

export const getStudyTypeOptions = () => Object.values(STUDY_TYPES)
export const getStudyFormOptions = () => Object.values(STUDY_FORMS)
export const getStudyStatusOptions = () => Object.values(STUDY_STATUS)
export const getSubjectTypeOptions = () => Object.values(SUBJECT_TYPES)
export const getCompletionTypeOptions = () => Object.values(COMPLETION_TYPES)

export const getCompletionTypeShortCode = (completionType: string): string => {
  const exactMatch = COMPLETION_TYPE_MAPPING[completionType as keyof typeof COMPLETION_TYPE_MAPPING]
  if (exactMatch) {
    return exactMatch
  }
  
  // Fallback for unmapped variants: take the code in parentheses
  const regexMatch = completionType.match(/\(([^)]+)\)/)
  if (regexMatch && regexMatch[1]) {
    return regexMatch[1]
  }
  
  return completionType
}

export const SUBJECT_TYPE_CONFIG = {
  [SUBJECT_TYPES.MANDATORY]: {
    color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    shortCode: 'P',
    order: 1,
    fullText: 'Povinný',
  },
  [SUBJECT_TYPES.MANDATORY_ELECTIVE]: {
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800',
    shortCode: 'PV',
    order: 2,
    fullText: 'Povinně volitelný',
  },
  [SUBJECT_TYPES.ELECTIVE]: {
    color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800',
    shortCode: 'V',
    order: 3,
    fullText: 'Volitelný',
  },
  [SUBJECT_TYPES.OTHER]: {
    color: 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-950 dark:text-primary-300 dark:border-primary-800',
    shortCode: '-',
    order: 5,
    fullText: 'Ostatní',
  },
} as const

export const getSubjectTypeConfig = (type: string) => {
  return (
    SUBJECT_TYPE_CONFIG[type as keyof typeof SUBJECT_TYPE_CONFIG] || {
      color: 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-950 dark:text-primary-300 dark:border-primary-800',
      shortCode: type.charAt(0).toUpperCase(),
      order: 999,
      fullText: type,
    }
  )
}

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

// Graduation Result (výsledek studia – platí pro dokončená studia)
// "prospěl" → standardní diplom, "prospěl s vyznamenáním" → červený diplom
export const GRADUATION_RESULTS = {
  PASSED: 'prospěl',
  PASSED_WITH_HONORS: 'prospěl s vyznamenáním',
} as const

export type GraduationResult = (typeof GRADUATION_RESULTS)[keyof typeof GRADUATION_RESULTS]

export const getGraduationResultOptions = () => Object.values(GRADUATION_RESULTS)

// True when the study was completed with distinction (the "red diploma")
export const isGraduationWithHonors = (result?: string | null): boolean =>
  result === GRADUATION_RESULTS.PASSED_WITH_HONORS

// Values are stored lowercase (the official wording); capitalise for display
export const getGraduationResultLabel = (result?: string | null): string => {
  if (!result) return ''
  return result.charAt(0).toUpperCase() + result.slice(1)
}

export const MATERIAL_CATEGORIES = {
  SYLLABUS: 'Sylabus',
  STUDY_MATERIALS: 'Studijní materiály',
  MY_WORK: 'Moje práce',
  EVALUATION: 'Hodnocení',
  THESIS: 'Závěrečná práce',
  DOCUMENTS: 'Dokumenty',
  OTHER: 'Ostatní',
} as const

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[keyof typeof MATERIAL_CATEGORIES]

export const getMaterialCategoryOptions = () => Object.values(MATERIAL_CATEGORIES)

// Státní závěrečná zkouška (state final exam)
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
  exam_scheduler_enabled: boolean
  transit_duration_hours: number
  transit_cost_one_way: number
  accommodation_cost_per_night: number
  prefer_free_day_exams?: boolean
  pto_day_cost?: number
  working_days?: number[]
  is_url?: string
  created_at: string
  updated_at: string
}

export const EXAM_SCHEDULER_DEFAULTS = {
  TRANSIT_DURATION_HOURS: 4,
  TRANSIT_COST_ONE_WAY: 200,
  ACCOMMODATION_COST_PER_NIGHT: 2000,
  DEFAULT_EXAM_DURATION_MINUTES: 120,
  // Cost of a single PTO/vacation day, used to penalize in-person exams that
  // fall on a working day when "prefer free-day exams" is enabled.
  PTO_DAY_COST: 5500,
  // Whether the free-day preference is on by default for new studies.
  PREFER_FREE_DAY_EXAMS: false,
  // Minimum break (minutes) inserted on top of both studies' transit time when
  // two in-person exams of different studies fall on the same day. Stored once
  // globally in app_settings.inter_study_break_minutes.
  INTER_STUDY_BREAK_MINUTES: 60,
} as const

// ─── Exam Periods & Terms (global exam scheduler) ────────────────────────────

// A period defines, for a single study, a date window in which one term must be
// chosen for each of its subjects. Periods may overlap (e.g. credits + orals).
export interface ExamPeriod {
  id: string
  study_id: string
  name: string
  start_date: string // YYYY-MM-DD
  due_date: string // YYYY-MM-DD
  created_at: string
  updated_at: string
}

// A candidate exam slot for one subject inside one period. The scheduler picks
// exactly one term per (period, subject) requirement. A locked term is forced
// into the official ("forced") schedule even when a cheaper option exists.
export interface ExamTerm {
  id: string
  period_id: string
  study_id: string
  subject_id: string
  date: string // YYYY-MM-DD
  start_time: string // HH:MM or HH:MM:SS
  duration_minutes: number
  is_online: boolean
  note: string | null
  locked: boolean
  created_at: string
  updated_at: string
}

// Days of week considered "working days" by default (Mon–Fri).
// Convention: 0 = Sunday, 1 = Monday, ... 6 = Saturday (matches JS getUTCDay()).
export const DEFAULT_WORKING_DAYS: number[] = [1, 2, 3, 4, 5]

// Weekday options for UI pickers (ordered Mon-first, Czech short labels)
export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Po' },
  { value: 2, label: 'Út' },
  { value: 3, label: 'St' },
  { value: 4, label: 'Čt' },
  { value: 5, label: 'Pá' },
  { value: 6, label: 'So' },
  { value: 0, label: 'Ne' },
] as const

export const EXAM_DURATION_OPTIONS = [
  { value: 60, label: '1 hodina' },
  { value: 90, label: '1,5 hodiny' },
  { value: 120, label: '2 hodiny' },
  { value: 150, label: '2,5 hodiny' },
  { value: 180, label: '3 hodiny' },
  { value: 240, label: '4 hodiny' },
] as const

export const getExamDurationOptions = () => [...EXAM_DURATION_OPTIONS]

// ─── Tasks ──────────────────────────────────────────────────────────────────

export interface Task {
  id: string
  study_id: string
  title: string
  description: string | null
  start_date: string | null
  deadline: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export const TASK_STATE = {
  OVERDUE: 'overdue',
  RUNNING: 'running',
  UPCOMING: 'upcoming',
  COMPLETED: 'completed',
} as const

export type TaskState = (typeof TASK_STATE)[keyof typeof TASK_STATE]

export const TASK_STATE_CONFIG: Record<TaskState, {
  label: string
  badgeClass: string
  cardClass: string
  dotClass: string
  accentClass: string
}> = {
  [TASK_STATE.OVERDUE]: {
    label: 'Po termínu',
    badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
    cardClass: 'border-red-300 bg-gradient-to-br from-red-50 via-card to-card shadow-red-100/50 dark:border-red-800 dark:from-red-950/40 dark:via-card dark:to-card dark:shadow-none',
    dotClass: 'bg-red-500',
    accentClass: 'text-red-600 dark:text-red-400',
  },
  [TASK_STATE.RUNNING]: {
    label: 'Probíhá',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
    cardClass: 'border-amber-200 bg-gradient-to-br from-amber-50 via-card to-card shadow-amber-100/40 dark:border-amber-800 dark:from-amber-950/40 dark:via-card dark:to-card dark:shadow-none',
    dotClass: 'bg-amber-500',
    accentClass: 'text-amber-700 dark:text-amber-300',
  },
  [TASK_STATE.UPCOMING]: {
    label: 'Nadcházející',
    badgeClass: 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-950 dark:text-primary-300 dark:border-primary-800',
    cardClass: 'border-primary-200 bg-card dark:border-primary-800',
    dotClass: 'bg-primary-500',
    accentClass: 'text-primary-700 dark:text-primary-300',
  },
  [TASK_STATE.COMPLETED]: {
    label: 'Hotovo',
    badgeClass: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
    cardClass: 'border-green-200 bg-green-50/40 dark:border-green-800 dark:bg-green-950/30',
    dotClass: 'bg-green-500',
    accentClass: 'text-green-700 dark:text-green-300',
  },
}

// Returns YYYY-MM-DD in local timezone (NOT UTC), matching how <input type="date"> values are stored.
export function todayLocalIso(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getTaskState(
  task: Pick<Task, 'start_date' | 'deadline' | 'completed_at'>,
  today: string = todayLocalIso(),
): TaskState {
  if (task.completed_at) return TASK_STATE.COMPLETED
  if (task.deadline && task.deadline < today) return TASK_STATE.OVERDUE
  if (task.start_date && task.start_date > today) return TASK_STATE.UPCOMING
  return TASK_STATE.RUNNING
}
