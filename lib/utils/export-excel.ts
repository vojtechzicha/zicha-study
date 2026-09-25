import ExcelJS from 'exceljs'
import { fetchStudies } from '@/lib/actions/studies'
import { fetchSubjectsByStudyId } from '@/lib/actions/subjects'
import { fetchFinalExams } from '@/lib/actions/final-exams'
import { getStudyStatusLabel, getStudyFormLabel, getGraduationResultLabel, type StudyStatus } from '@/lib/constants'
import { sortStudiesByStatus, getCzechSubjectsWord } from '@/lib/status-utils'
import { getShareUrl } from '@/lib/utils/share-url'
import { STUDY_KIND, resolveStudyKind, getStudyTerminology } from '@/lib/study-kind'
import { calculateStudyStatistics, type StatisticsSubject } from '@/lib/utils/statistics-utils'
import {
  derivePeriods,
  getGrade,
  subjectAverage,
  periodAverage,
  overallAverage,
  type HighSchoolSubjectLike,
} from '@/lib/highschool/grades'

interface ExportStudy {
  id: string
  name: string
  type: string
  form?: string | null
  start_year?: number | string | null
  end_year?: number | string | null
  status: StudyStatus
  graduation_result?: string | null
  logo_url?: string | null
  is_public?: boolean
  public_slug?: string | null
  created_at?: string | Date | null
}

interface ExportSubject {
  id: string
  semester: string
  abbreviation: string | null
  name: string
  subject_type: string
  completion_type: string
  credits: number
  points?: number
  hours?: number
  completed: boolean
  exam_completed: boolean
  credit_completed: boolean
  planned?: boolean
  grade?: string
  final_date?: string
  lecturer?: string
  department?: string
  is_repeat?: boolean
  repeats_subject_id?: string | null
}

interface ExportFinalExam {
  id: string
  shortcut?: string
  name: string
  grade?: string
  exam_date?: string
  examiner?: string
  examination_committee_head?: string
}

// ARGB colours (ExcelJS format)
const C = {
  DARK: 'FF1B2A4A',
  ACCENT: 'FF2E86AB',
  LIGHT_ACCENT: 'FFD6EAF0',
  WHITE: 'FFFFFFFF',
  LIGHT_GRAY: 'FFF5F6F8',
  DARK_TEXT: 'FF1A1A2E',
  SUBTLE: 'FF6B7280',
  SUCCESS: 'FF059669',
  WARNING: 'FFD97706',
  DANGER: 'FFDC2626',
  COMPLETED_BG: 'FFECFDF5',
  BLUE: 'FF0369A1',
  AMBER: 'FFB45309',
  BORDER: 'FFD1D5DB',
  SZZ_HEADER: 'FF1E3A5F',
} as const

const STATUS_COLORS: Record<string, string> = {
  active: C.SUCCESS,
  completed: C.SUCCESS,
  paused: C.WARNING,
  abandoned: C.DANGER,
  planned: C.WARNING,
  intended: C.WARNING,
}

function compareSemesters(a: string, b: string): number {
  const parse = (s: string) => {
    const m = s.match(/^(\d+)\.\s*ročník\s*(ZS|LS)$/i)
    return m ? { year: parseInt(m[1], 10), type: m[2].toUpperCase() } : { year: 0, type: s }
  }
  const sa = parse(a), sb = parse(b)
  if (sa.year !== sb.year) return sa.year - sb.year
  if (sa.type === 'ZS' && sb.type === 'LS') return -1
  if (sa.type === 'LS' && sb.type === 'ZS') return 1
  return a.localeCompare(b)
}

function solidFill(color: string) {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: color } }
}

function bdr(style: 'thin' | 'medium', color: string) {
  return { style, color: { argb: color } }
}

const thinBdr = bdr('thin', C.BORDER)
const cellBorders = { top: thinBdr, bottom: thinBdr, left: thinBdr, right: thinBdr }

async function fetchLogoBuffer(logoUrl: string): Promise<{ buffer: ArrayBuffer; extension: 'png' | 'jpeg' | 'gif' } | null> {
  try {
    const response = await fetch(logoUrl)
    if (!response.ok) return null
    const contentType = response.headers.get('content-type') || 'image/png'
    let extension: 'png' | 'jpeg' | 'gif' = 'png'
    if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpeg'
    else if (contentType.includes('gif')) extension = 'gif'

    const buffer = await response.arrayBuffer()
    return buffer.byteLength > 0 ? { buffer, extension } : null
  } catch {
    return null
  }
}

const COLS = [
  { header: '#',               width: 5,  align: 'center' as const, wrap: false },
  { header: 'Zkratka',        width: 12, align: 'left'   as const, wrap: false },
  { header: 'Název předmětu', width: 48, align: 'left'   as const, wrap: true },
  { header: 'Typ',            width: 20, align: 'left'   as const, wrap: false },
  { header: 'Zakončení',      width: 16, align: 'center' as const, wrap: true  },
  { header: 'Kr.',            width: 5,  align: 'center' as const, wrap: false },
  { header: 'Body',           width: 6,  align: 'center' as const, wrap: false },
  { header: 'Hodiny',         width: 7,  align: 'center' as const, wrap: false },
  { header: 'Stav',           width: 6,  align: 'center' as const, wrap: false },
  { header: 'Zk.',            width: 5,  align: 'center' as const, wrap: false },
  { header: 'Zp.',            width: 5,  align: 'center' as const, wrap: false },
  { header: 'Plán',           width: 5,  align: 'center' as const, wrap: false },
  { header: 'Známka',         width: 7,  align: 'center' as const, wrap: false },
  { header: 'Datum',          width: 12, align: 'center' as const, wrap: false },
  { header: 'Vyučující',      width: 35, align: 'left'   as const, wrap: true },
  { header: 'Katedra',        width: 32, align: 'left'   as const, wrap: true },
]

const NUM_COLS = COLS.length
const MAX_WORKSHEET_NAME_LENGTH = 31

function getGradeColor(grade: string): string {
  if (['A', '1'].includes(grade)) return C.SUCCESS
  if (['B', '2'].includes(grade)) return C.BLUE
  if (['C', '3'].includes(grade)) return C.WARNING
  if (['D', '4'].includes(grade)) return C.AMBER
  if (['E'].includes(grade)) return C.AMBER
  if (['F', 'FN', '5'].includes(grade)) return C.DANGER
  return C.DARK_TEXT
}

function sanitizeWorksheetName(name: string): string {
  return name
    .replace(/[\[\]*?:/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^'+|'+$/g, '')
    .trim()
}

function humanizeSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\p{L}/gu, (char) => char.toLocaleUpperCase('cs-CZ'))
}

function truncateWorksheetName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name

  const hardTrimmed = name.slice(0, maxLength).trim()
  const lastSpace = hardTrimmed.lastIndexOf(' ')

  if (lastSpace >= Math.floor(maxLength * 0.6)) {
    return hardTrimmed.slice(0, lastSpace).trim()
  }

  return hardTrimmed
}

function getWorksheetBaseName(study: ExportStudy): string {
  const fromName = sanitizeWorksheetName(study.name)
  if (fromName) return truncateWorksheetName(fromName, MAX_WORKSHEET_NAME_LENGTH)

  const fromSlug = study.public_slug ? sanitizeWorksheetName(humanizeSlug(study.public_slug)) : ''
  if (fromSlug) return truncateWorksheetName(fromSlug, MAX_WORKSHEET_NAME_LENGTH)

  return 'Studium'
}

function getUniqueWorksheetName(study: ExportStudy, usedNames: Set<string>): string {
  const baseName = getWorksheetBaseName(study)
  let name = baseName
  let suffix = 2

  while (usedNames.has(name.toLocaleLowerCase('cs-CZ'))) {
    const suffixText = ` ${suffix}`
    name = `${truncateWorksheetName(baseName, MAX_WORKSHEET_NAME_LENGTH - suffixText.length)}${suffixText}`
    suffix++
  }

  usedNames.add(name.toLocaleLowerCase('cs-CZ'))
  return name
}

function writeFooter(ws: ExcelJS.Worksheet, startRow: number, numCols: number, publicSlug?: string | null): number {
  let r = startRow
  ws.getRow(r).height = 8
  r++
  for (let c = 1; c <= numCols; c++) ws.getCell(r, c).fill = solidFill(C.DARK)
  ws.getRow(r).height = 4
  r++
  ws.mergeCells(r, 1, r, numCols)
  const footerCell = ws.getCell(r, 1)
  const exportedAt = new Date().toLocaleString('cs-CZ')
  footerCell.value = publicSlug
    ? `Export: ${exportedAt}  |  ${getShareUrl(publicSlug)}`
    : `Export: ${exportedAt}  |  Soukromé studium`
  footerCell.font = { name: 'Arial', size: 8, italic: true, color: { argb: C.SUBTLE } }
  footerCell.alignment = { horizontal: 'right', vertical: 'middle' }
  return r
}

interface HighSchoolSheetCtx {
  ws: ExcelJS.Worksheet
  study: ExportStudy
  subjects: ExportSubject[]
  finalExams: ExportFinalExam[]
  publicSlug?: string | null
  logoImageId?: number
}

function buildHighSchoolSheet({ ws, study, subjects, finalExams, publicSlug, logoImageId }: HighSchoolSheetCtx) {
  const hsSubjects = subjects as unknown as HighSchoolSubjectLike[]
  const periods = derivePeriods(
    {
      start_year: Number(study.start_year) || new Date().getFullYear(),
      end_year: study.end_year != null ? Number(study.end_year) : null,
    },
    hsSubjects,
  )
  const sorted = [...hsSubjects].sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  const term = getStudyTerminology(study.type)

  // Column layout: Předmět | <pololetí…> | Ø | Vyučující
  const SUBJECT_COL = 1
  const FIRST_PERIOD_COL = 2
  const AVG_COL = FIRST_PERIOD_COL + periods.length
  const TEACHER_COL = AVG_COL + 1
  const numCols = TEACHER_COL

  ws.getColumn(SUBJECT_COL).width = 34
  periods.forEach((_, i) => { ws.getColumn(FIRST_PERIOD_COL + i).width = 7 })
  ws.getColumn(AVG_COL).width = 8
  ws.getColumn(TEACHER_COL).width = 28

  const hasLogo = logoImageId !== undefined

  // Row 1: dark accent bar
  let r = 1
  for (let c = 1; c <= numCols; c++) ws.getCell(r, c).fill = solidFill(C.DARK)
  ws.getRow(r).height = 6

  // Row 2: study name
  r = 2
  ws.mergeCells(r, 1, r, numCols)
  const nameCell = ws.getCell(r, 1)
  nameCell.value = study.name
  nameCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: C.DARK_TEXT } }
  nameCell.alignment = { horizontal: 'left', vertical: 'middle', indent: hasLogo ? 5 : 0 }
  ws.getRow(r).height = 32
  if (hasLogo && logoImageId !== undefined) {
    ws.addImage(logoImageId, { tl: { col: 0.1, row: 0.8 }, ext: { width: 44, height: 44 } })
  }

  // Row 3: subtitle + status badge
  r = 3
  const subtitleParts = [
    study.type,
    getStudyFormLabel(study.form || ''),
    `${study.start_year}–${study.end_year || '…'}`,
    study.graduation_result ? getGraduationResultLabel(study.graduation_result) : null,
  ].filter(Boolean)
  const statusSpan = Math.min(2, numCols - 1)
  ws.mergeCells(r, 1, r, numCols - statusSpan)
  const subtitleCell = ws.getCell(r, 1)
  subtitleCell.value = subtitleParts.join('  •  ')
  subtitleCell.font = { name: 'Arial', size: 10, color: { argb: C.SUBTLE } }
  subtitleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: hasLogo ? 7 : 0 }
  ws.mergeCells(r, numCols - statusSpan + 1, r, numCols)
  const statusCell = ws.getCell(r, numCols - statusSpan + 1)
  statusCell.value = getStudyStatusLabel(study.status)
  statusCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: C.WHITE } }
  statusCell.fill = solidFill(STATUS_COLORS[study.status] || C.SUBTLE)
  statusCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(r).height = 24

  // Row 4: accent divider, row 5: spacer
  r = 4
  for (let c = 1; c <= numCols; c++) ws.getCell(r, c).border = { bottom: bdr('medium', C.ACCENT) }
  ws.getRow(r).height = 8

  r = 5
  ws.getRow(r).height = 6

  // Row 6: public URL
  r = 6
  if (publicSlug) {
    const url = getShareUrl(publicSlug)
    ws.mergeCells(r, 1, r, numCols)
    const urlCell = ws.getCell(r, 1)
    urlCell.value = { text: url, hyperlink: url }
    urlCell.font = { name: 'Arial', size: 9, color: { argb: C.ACCENT }, underline: true }
    urlCell.alignment = { horizontal: 'left', vertical: 'middle' }
  }
  ws.getRow(r).height = 20

  // Row 7: summary (study average), row 8: spacer
  r = 7
  const avg = overallAverage(hsSubjects)
  ws.mergeCells(r, 1, r, numCols)
  const statsCell = ws.getCell(r, 1)
  statsCell.value = `${sorted.length} ${getCzechSubjectsWord(sorted.length)}  •  studijní průměr ${avg !== null ? avg.toFixed(2) : '–'}`
  statsCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.ACCENT } }
  statsCell.fill = solidFill(C.LIGHT_ACCENT)
  statsCell.alignment = { horizontal: 'center', vertical: 'middle' }
  statsCell.border = { top: bdr('thin', C.ACCENT), bottom: bdr('thin', C.ACCENT) }
  ws.getRow(r).height = 24

  r = 8
  ws.getRow(r).height = 8

  // Row 9: table header (frozen pane below it)
  r = 9
  const darkBdr = bdr('thin', C.DARK)
  const headerCells: { col: number; text: string; align: 'left' | 'center' }[] = [
    { col: SUBJECT_COL, text: 'Předmět', align: 'left' },
    ...periods.map((p, i) => ({ col: FIRST_PERIOD_COL + i, text: p.shortLabel, align: 'center' as const })),
    { col: AVG_COL, text: 'Ø', align: 'center' },
    { col: TEACHER_COL, text: 'Vyučující', align: 'left' },
  ]
  headerCells.forEach(({ col, text, align }) => {
    const cell = ws.getCell(r, col)
    cell.value = text
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.WHITE } }
    cell.fill = solidFill(C.DARK)
    cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true }
    cell.border = { top: darkBdr, bottom: darkBdr, left: darkBdr, right: darkBdr }
  })
  ws.getRow(r).height = 24

  let nextRow = 10
  if (sorted.length > 0) {
    sorted.forEach((subj, i) => {
      const row = 10 + i
      const bg = i % 2 === 1 ? C.LIGHT_GRAY : C.WHITE

      const nameC = ws.getCell(row, SUBJECT_COL)
      nameC.value = subj.abbreviation ? `${subj.abbreviation} – ${subj.name}` : subj.name
      nameC.font = { name: 'Arial', size: 9, color: { argb: C.DARK_TEXT } }
      nameC.fill = solidFill(bg)
      nameC.border = cellBorders
      nameC.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }

      periods.forEach((p, pi) => {
        const cell = ws.getCell(row, FIRST_PERIOD_COL + pi)
        const g = getGrade(subj, p.year, p.half)
        cell.value = g || ''
        cell.fill = solidFill(bg)
        cell.border = cellBorders
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.font = g
          ? { name: 'Arial', size: 9, bold: true, color: { argb: getGradeColor(g) } }
          : { name: 'Arial', size: 9, color: { argb: C.DARK_TEXT } }
      })

      const avgC = ws.getCell(row, AVG_COL)
      const sAvg = subjectAverage(subj)
      avgC.value = sAvg !== null ? Number(sAvg.toFixed(2)) : ''
      avgC.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.DARK_TEXT } }
      avgC.fill = solidFill(bg)
      avgC.border = cellBorders
      avgC.alignment = { horizontal: 'center', vertical: 'middle' }

      const tC = ws.getCell(row, TEACHER_COL)
      tC.value = subj.lecturer || ''
      tC.font = { name: 'Arial', size: 9, color: { argb: C.DARK_TEXT } }
      tC.fill = solidFill(bg)
      tC.border = cellBorders
      tC.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }

      ws.getRow(row).height = 24
    })

    nextRow = 10 + sorted.length

    const avgRow = nextRow
    const labelC = ws.getCell(avgRow, SUBJECT_COL)
    labelC.value = 'Průměr pololetí'
    labelC.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.ACCENT } }
    labelC.fill = solidFill(C.LIGHT_ACCENT)
    labelC.border = cellBorders
    labelC.alignment = { horizontal: 'left', vertical: 'middle' }
    periods.forEach((p, pi) => {
      const cell = ws.getCell(avgRow, FIRST_PERIOD_COL + pi)
      const pa = periodAverage(hsSubjects, p.year, p.half)
      cell.value = pa !== null ? Number(pa.toFixed(2)) : ''
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.ACCENT } }
      cell.fill = solidFill(C.LIGHT_ACCENT)
      cell.border = cellBorders
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })
    const ovC = ws.getCell(avgRow, AVG_COL)
    ovC.value = avg !== null ? Number(avg.toFixed(2)) : ''
    ovC.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.ACCENT } }
    ovC.fill = solidFill(C.LIGHT_ACCENT)
    ovC.border = cellBorders
    ovC.alignment = { horizontal: 'center', vertical: 'middle' }
    const trailC = ws.getCell(avgRow, TEACHER_COL)
    trailC.fill = solidFill(C.LIGHT_ACCENT)
    trailC.border = cellBorders
    ws.getRow(avgRow).height = 22
    nextRow = avgRow + 1
  } else {
    ws.mergeCells(nextRow, 1, nextRow, numCols)
    const emptyCell = ws.getCell(nextRow, 1)
    emptyCell.value = 'Studium nemá žádné předměty.'
    emptyCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: C.SUBTLE } }
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(nextRow).height = 30
    nextRow++
  }

  // Maturita (final exams) section
  if (finalExams.length > 0) {
    const GRADE_COL = FIRST_PERIOD_COL
    const DATE_COL = FIRST_PERIOD_COL + 1

    r = nextRow
    ws.getRow(r).height = 12
    r++

    ws.mergeCells(r, 1, r, numCols)
    const titleCell = ws.getCell(r, 1)
    titleCell.value = `  ${term.finalExamsSectionTitle}`
    titleCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: C.WHITE } }
    titleCell.fill = solidFill(C.SZZ_HEADER)
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    ws.getRow(r).height = 26
    r++

    const subHeaders: Record<number, string> = {
      [SUBJECT_COL]: 'Předmět',
      [GRADE_COL]: 'Hodnocení',
      [DATE_COL]: 'Datum',
      [TEACHER_COL]: 'Zkoušející',
    }
    for (let c = 1; c <= numCols; c++) {
      const cell = ws.getCell(r, c)
      cell.value = subHeaders[c] || ''
      cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: C.DARK_TEXT } }
      cell.fill = solidFill(C.LIGHT_ACCENT)
      cell.border = { bottom: bdr('thin', C.ACCENT) }
      cell.alignment = { horizontal: c === SUBJECT_COL || c === TEACHER_COL ? 'left' : 'center', vertical: 'middle' }
    }
    ws.getRow(r).height = 22
    r++

    finalExams.forEach((exam, i) => {
      const bg = i % 2 === 1 ? C.LIGHT_GRAY : C.WHITE
      for (let c = 1; c <= numCols; c++) {
        const cell = ws.getCell(r, c)
        cell.fill = solidFill(bg)
        cell.border = cellBorders
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      }
      const nameC = ws.getCell(r, SUBJECT_COL)
      nameC.value = exam.shortcut ? `${exam.shortcut} – ${exam.name}` : exam.name
      nameC.font = { name: 'Arial', size: 9, color: { argb: C.DARK_TEXT } }
      nameC.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }

      const gC = ws.getCell(r, GRADE_COL)
      gC.value = exam.grade || ''
      gC.font = exam.grade
        ? { name: 'Arial', size: 9, bold: true, color: { argb: getGradeColor(exam.grade) } }
        : { name: 'Arial', size: 9, color: { argb: C.DARK_TEXT } }

      const dC = ws.getCell(r, DATE_COL)
      dC.value = exam.exam_date ? new Date(exam.exam_date).toLocaleDateString('cs-CZ') : ''
      dC.font = { name: 'Arial', size: 9, color: { argb: C.DARK_TEXT } }

      const tC = ws.getCell(r, TEACHER_COL)
      tC.value = exam.examiner || ''
      tC.font = { name: 'Arial', size: 9, color: { argb: C.DARK_TEXT } }
      tC.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }

      ws.getRow(r).height = 26
      r++
    })
    nextRow = r
  }

  writeFooter(ws, nextRow, numCols, publicSlug)
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 9, topLeftCell: 'B10', activeCell: 'B10' }]
  ws.pageSetup.orientation = 'landscape'
  ws.pageSetup.fitToPage = true
  ws.pageSetup.fitToWidth = 1
  ws.pageSetup.fitToHeight = 0
}

export async function exportStudiesToExcel() {
  const studies = sortStudiesByStatus((await fetchStudies()) as ExportStudy[])
  if (!studies || studies.length === 0) {
    throw new Error('Nejsou žádná studia k exportu.')
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sledování studií'
  workbook.created = new Date()
  const usedWorksheetNames = new Set<string>()

  for (const study of studies) {
    let subjects: ExportSubject[] = []
    let finalExams: ExportFinalExam[] = []
    try {
      const raw = await fetchSubjectsByStudyId(study.id)
      subjects = (raw || []) as unknown as ExportSubject[]
    } catch {
      continue
    }

    try {
      const rawExams = await fetchFinalExams(study.id)
      finalExams = (rawExams || []) as unknown as ExportFinalExam[]
    } catch {
      // Final exams not available, continue without
    }

    const publicSlug = study.is_public ? study.public_slug : null
    const ws = workbook.addWorksheet(getUniqueWorksheetName(study, usedWorksheetNames))

    let logoImageId: number | undefined
    if (study.logo_url) {
      const logoData = await fetchLogoBuffer(study.logo_url)
      if (logoData) {
        logoImageId = workbook.addImage({
          buffer: logoData.buffer as any,
          extension: logoData.extension,
        })
      }
    }

    // High-school studies use a grade-matrix layout (subjects × pololetí)
    // instead of the semester/credit table.
    if (resolveStudyKind(study.type) === STUDY_KIND.HIGH_SCHOOL) {
      buildHighSchoolSheet({ ws, study, subjects, finalExams, publicSlug, logoImageId })
      continue
    }

    subjects.sort((a, b) => {
      const sc = compareSemesters(a.semester, b.semester)
      return sc !== 0 ? sc : a.name.localeCompare(b.name)
    })

    COLS.forEach((col, i) => { ws.getColumn(i + 1).width = col.width })

    let r: number

    // Row 1: dark accent bar
    r = 1
    for (let c = 1; c <= NUM_COLS; c++) ws.getCell(r, c).fill = solidFill(C.DARK)
    ws.getRow(r).height = 6

    // Row 2: study name
    r = 2
    const hasLogo = logoImageId !== undefined
    ws.mergeCells(r, 1, r, NUM_COLS)
    const nameCell = ws.getCell(r, 1)
    nameCell.value = study.name
    nameCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: C.DARK_TEXT } }
    nameCell.alignment = { horizontal: 'left', vertical: 'middle', indent: hasLogo ? 5 : 0 }
    ws.getRow(r).height = 32

    // Logo sits on the left over rows 1–3; the indents on rows 2–3 leave room for it
    if (hasLogo && logoImageId !== undefined) {
      ws.addImage(logoImageId, {
        tl: { col: 0.1, row: 0.8 },
        ext: { width: 44, height: 44 },
      })
    }

    // Row 3: subtitle + status badge
    r = 3
    const subtitleParts = [
      study.type,
      getStudyFormLabel(study.form || ''),
      `${study.start_year}–${study.end_year || '…'}`,
      study.graduation_result ? getGraduationResultLabel(study.graduation_result) : null,
    ].filter(Boolean)

    ws.mergeCells(r, 1, r, NUM_COLS - 3)
    const subtitleCell = ws.getCell(r, 1)
    subtitleCell.value = subtitleParts.join('  \u2022  ')
    subtitleCell.font = { name: 'Arial', size: 10, color: { argb: C.SUBTLE } }
    subtitleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: hasLogo ? 7 : 0 }

    ws.mergeCells(r, NUM_COLS - 2, r, NUM_COLS)
    const statusCell = ws.getCell(r, NUM_COLS - 2)
    statusCell.value = getStudyStatusLabel(study.status)
    statusCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: C.WHITE } }
    statusCell.fill = solidFill(STATUS_COLORS[study.status] || C.SUBTLE)
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(r).height = 24

    // Row 4: accent divider, row 5: spacer
    r = 4
    for (let c = 1; c <= NUM_COLS; c++) {
      ws.getCell(r, c).border = { bottom: bdr('medium', C.ACCENT) }
    }
    ws.getRow(r).height = 8

    r = 5
    ws.getRow(r).height = 6

    // Row 6: public URL + metadata
    r = 6
    if (publicSlug) {
      const url = getShareUrl(publicSlug)
      ws.mergeCells(r, 1, r, NUM_COLS - 4)
      const urlCell = ws.getCell(r, 1)
      urlCell.value = { text: url, hyperlink: url }
      urlCell.font = { name: 'Arial', size: 9, color: { argb: C.ACCENT }, underline: true }
      urlCell.alignment = { horizontal: 'left', vertical: 'middle' }
    }
    ws.mergeCells(r, NUM_COLS - 3, r, NUM_COLS)
    const metaCell = ws.getCell(r, NUM_COLS - 3)
    const createdDate = study.created_at ? new Date(study.created_at).toLocaleDateString('cs-CZ') : ''
    metaCell.value = `Vytvořeno: ${createdDate}  \u2022  ${study.is_public ? 'Veřejné' : 'Soukromé'}`
    metaCell.font = { name: 'Arial', size: 8, color: { argb: C.SUBTLE } }
    metaCell.alignment = { horizontal: 'right', vertical: 'middle' }
    ws.getRow(r).height = 20

    // Row 7: summary statistics bar, row 8: spacer
    r = 7
    // Same semantics as the web app (calculateStudyStatistics): superseded
    // repeat attempts and failed subjects don't count toward earned credits.
    const stats = calculateStudyStatistics(subjects as unknown as StatisticsSubject[])

    ws.mergeCells(r, 1, r, NUM_COLS)
    const statsCell = ws.getCell(r, 1)
    statsCell.value = `${stats.total} ${getCzechSubjectsWord(stats.total)}  \u2022  ${stats.completed} dokončeno  \u2022  ${stats.completedCredits}/${stats.totalCredits} kreditů`
    statsCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.ACCENT } }
    statsCell.fill = solidFill(C.LIGHT_ACCENT)
    statsCell.alignment = { horizontal: 'center', vertical: 'middle' }
    statsCell.border = { top: bdr('thin', C.ACCENT), bottom: bdr('thin', C.ACCENT) }
    ws.getRow(r).height = 24

    r = 8
    ws.getRow(r).height = 8

    // Row 9: table header (frozen pane below it)
    r = 9
    const darkBdr = bdr('thin', C.DARK)
    COLS.forEach((col, i) => {
      const cell = ws.getCell(r, i + 1)
      cell.value = col.header
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.WHITE } }
      cell.fill = solidFill(C.DARK)
      cell.alignment = { horizontal: col.align, vertical: 'middle', wrapText: true }
      cell.border = { top: darkBdr, bottom: darkBdr, left: darkBdr, right: darkBdr }
    })
    ws.getRow(r).height = 28

    let nextRow = 10

    if (subjects.length > 0) {
      let prevSemester: string | null = null
      let rowOffset = 0

      for (let i = 0; i < subjects.length; i++) {
        const subj = subjects[i]
        r = 10 + rowOffset

        // Semester separator row before the first subject of each semester
        if (subj.semester !== prevSemester && subj.semester) {
          ws.mergeCells(r, 1, r, NUM_COLS)
          const semCell = ws.getCell(r, 1)
          semCell.value = `  ${subj.semester}`
          semCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.ACCENT } }
          semCell.fill = solidFill(C.LIGHT_ACCENT)
          semCell.alignment = { horizontal: 'left', vertical: 'middle' }
          semCell.border = {
            top: bdr('thin', C.ACCENT),
            bottom: bdr('thin', C.ACCENT),
          }
          ws.getRow(r).height = 20
          prevSemester = subj.semester
          rowOffset++
          r++
        }

        rowOffset++

        // Alternating row background, with completion highlight
        const isAlt = rowOffset % 2 === 0
        let bgColor: string = isAlt ? C.LIGHT_GRAY : C.WHITE
        if (subj.completed && subj.grade && subj.grade !== 'FN' && subj.grade !== 'F') {
          bgColor = C.COMPLETED_BG
        }

        const values: (string | number)[] = [
          i + 1,
          subj.abbreviation || '',
          subj.name,
          subj.subject_type,
          subj.completion_type,
          subj.credits,
          subj.points || '',
          subj.hours || '',
          subj.completed ? '\u2713' : '\u2717',
          subj.exam_completed ? '\u2713' : '\u2013',
          subj.credit_completed ? '\u2713' : '\u2013',
          subj.planned ? '\u2713' : '\u2013',
          subj.grade || '',
          subj.final_date ? new Date(subj.final_date).toLocaleDateString('cs-CZ') : '',
          subj.lecturer || '',
          subj.department || '',
        ]

        values.forEach((v, ci) => {
          const col = COLS[ci]
          const cell = ws.getCell(r, ci + 1)
          cell.value = v
          cell.font = { name: 'Arial', size: 9, color: { argb: C.DARK_TEXT } }
          cell.fill = solidFill(bgColor)
          cell.border = cellBorders
          cell.alignment = { horizontal: col.align, vertical: 'middle', wrapText: col.wrap }

          // Grade coloring (column index 12)
          if (ci === 12 && subj.grade) {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: getGradeColor(subj.grade) } }
          }

          // Subject type coloring (column index 3)
          if (ci === 3) {
            if (subj.subject_type === 'Povinně volitelný') {
              cell.font = { name: 'Arial', size: 9, color: { argb: C.ACCENT } }
            } else if (subj.subject_type === 'Volitelný') {
              cell.font = { name: 'Arial', size: 9, color: { argb: C.SUBTLE } }
            }
          }

          // Completed status coloring (column index 8)
          if (ci === 8) {
            cell.font = {
              name: 'Arial', size: 9, bold: true,
              color: { argb: subj.completed ? C.SUCCESS : C.SUBTLE },
            }
          }
        })

        ws.getRow(r).height = 26
      }

      nextRow = 10 + rowOffset
    } else {
      ws.mergeCells(nextRow, 1, nextRow, NUM_COLS)
      const emptyCell = ws.getCell(nextRow, 1)
      emptyCell.value = 'Studium nemá žádné předměty.'
      emptyCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: C.SUBTLE } }
      emptyCell.alignment = { horizontal: 'center', vertical: 'middle' }
      ws.getRow(nextRow).height = 30
      nextRow++
    }

    // Final exams (SZZ) section
    if (finalExams.length > 0) {
      r = nextRow
      ws.getRow(r).height = 12
      r++

      ws.mergeCells(r, 1, r, NUM_COLS)
      const szzTitleCell = ws.getCell(r, 1)
      szzTitleCell.value = `  ${getStudyTerminology(study.type).finalExamsSectionTitle}`
      szzTitleCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: C.WHITE } }
      szzTitleCell.fill = solidFill(C.SZZ_HEADER)
      szzTitleCell.alignment = { horizontal: 'left', vertical: 'middle' }
      ws.getRow(r).height = 26
      r++

      // Aligned to the subject table's COLS; null leaves that column blank
      const szzHeaders: (string | null)[] = [
        '#', 'Zkratka', 'Předmět', null, null, null, null, null,
        null, null, null, null, 'Hodnocení', 'Datum', 'Zkoušející', 'Předseda komise',
      ]
      szzHeaders.forEach((h, i) => {
        const cell = ws.getCell(r, i + 1)
        cell.value = h || ''
        cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: C.DARK_TEXT } }
        cell.fill = solidFill(C.LIGHT_ACCENT)
        cell.border = { bottom: bdr('thin', C.ACCENT) }
        cell.alignment = { horizontal: COLS[i].align, vertical: 'middle' }
      })
      ws.getRow(r).height = 22
      r++

      for (let i = 0; i < finalExams.length; i++) {
        const exam = finalExams[i]
        const isAlt = i % 2 === 0
        const bgColor = isAlt ? C.WHITE : C.LIGHT_GRAY

        const szzValues: (string | number)[] = [
          i + 1,
          exam.shortcut || '',
          exam.name,
          '', '', '', '', '', '', '', '', '',
          exam.grade || '',
          exam.exam_date ? new Date(exam.exam_date).toLocaleDateString('cs-CZ') : '',
          exam.examiner || '',
          exam.examination_committee_head || '',
        ]

        szzValues.forEach((v, ci) => {
          const cell = ws.getCell(r, ci + 1)
          cell.value = v
          cell.font = { name: 'Arial', size: 9, color: { argb: C.DARK_TEXT } }
          cell.fill = solidFill(bgColor)
          cell.border = cellBorders
          cell.alignment = { horizontal: COLS[ci].align, vertical: 'middle', wrapText: COLS[ci].wrap }

          // Grade coloring (column index 12)
          if (ci === 12 && exam.grade) {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: getGradeColor(exam.grade) } }
          }
        })

        ws.getRow(r).height = 26
        r++
      }

      nextRow = r
    }

    writeFooter(ws, nextRow, NUM_COLS, publicSlug)

    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 9, topLeftCell: 'A10', activeCell: 'A10' }]
    ws.pageSetup.orientation = 'landscape'
    ws.pageSetup.fitToPage = true
    ws.pageSetup.fitToWidth = 1
    ws.pageSetup.fitToHeight = 0
  }

  const fileName = `sledovani_studii_export_${new Date().toISOString().split('T')[0]}.xlsx`
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
