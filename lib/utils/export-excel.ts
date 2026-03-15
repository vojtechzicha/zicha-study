import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/client'

// Subject type for export
interface ExportSubject {
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
}

// Helper function to get study initials (matching StudyLogo component)
function getStudyInitials(studyName: string): string {
  return studyName
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export async function exportStudiesToExcel() {
  const supabase = createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  // Fetch all studies with public slugs
  const { data: studies, error: studiesError } = await supabase
    .from('studies')
    .select('*')
    .eq('user_id', user.id)
    .not('public_slug', 'is', null)
    .order('created_at', { ascending: false })

  if (studiesError) throw studiesError
  if (!studies || studies.length === 0) {
    throw new Error('No studies with public slugs found')
  }

  // Create workbook
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sledování studií'
  workbook.created = new Date()

  // Process each study
  for (const study of studies) {
    // Fetch subjects for this study
    const { data: subjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('*')
      .eq('study_id', study.id)
      .order('semester', { ascending: true })
      .order('name', { ascending: true })

    if (subjectsError) {
      continue
    }

    // Sheet 1: Study metadata with branding
    const metadataSheetName = `${study.public_slug}_info`.substring(0, 31)
    const metadataSheet = workbook.addWorksheet(metadataSheetName)

    // Create metadata with enhanced structure
    const studyInitials = getStudyInitials(study.name)
    const metadataData = [
      ['🎓 SLEDOVÁNÍ STUDIÍ - EXPORT DAT'],
      [''],
      ['INFORMACE O STUDIU'],
      ['====================================='],
      [''],
      ['📚 Studium', `${study.name} (${studyInitials})`],
      ['🔗 Veřejný odkaz', `${window.location.origin}/${study.public_slug}`],
      ['📅 Exportováno', new Date().toLocaleString('cs-CZ')],
      [''],
      ['ZÁKLADNÍ ÚDAJE'],
      ['-------------------------------------'],
      ['ID studia', study.id],
      ['Název', study.name],
      ['Logo/Značka', studyInitials],
      ['Typ', study.type],
      ['Forma', study.form],
      ['Počáteční rok', study.start_year],
      ['Konečný rok', study.end_year || 'Probíhá'],
      ['Status', study.status],
      ['Veřejné', study.is_public ? 'Ano' : 'Ne'],
      ['Veřejný slug', study.public_slug],
      ['Vytvořeno', new Date(study.created_at).toLocaleString('cs-CZ')]
    ]

    metadataSheet.addRows(metadataData)

    // Set column widths for better readability
    metadataSheet.getColumn(1).width = 25
    metadataSheet.getColumn(2).width = 60

    // Sheet 2: Subjects table
    const subjectsSheetName = `${study.public_slug}_subjects`.substring(0, 31)
    const subjectsSheet = workbook.addWorksheet(subjectsSheetName)

    if (subjects && subjects.length > 0) {
      // Create header section and subjects data
      const headerRows = [
        ['🎓 SLEDOVÁNÍ STUDIÍ - EXPORT DAT'],
        [''],
        ['📚 PŘEDMĚTY STUDIA'],
        ['====================================='],
        [''],
        ['📚 Studium', `${study.name} (${studyInitials})`],
        ['📅 Exportováno', new Date().toLocaleString('cs-CZ')],
        [''],
        [''],
      ]

      subjectsSheet.addRows(headerRows)

      // Add table headers
      const tableHeaders = [
        'Semestr', 'Zkratka', 'Název', 'Typ', 'Zakončení', 'Kredity', 'Body', 'Hodiny',
        'Dokončeno', 'Zkouška', 'Zápočet', 'Plánováno', 'Známka', 'Datum', 'Vyučující', 'Katedra'
      ]
      const headerRow = subjectsSheet.addRow(tableHeaders)

      // Style header row
      headerRow.eachCell((cell) => {
        cell.font = { bold: true }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        }
      })

      // Add data rows
      const dataRows = (subjects as ExportSubject[]).map((subject: ExportSubject) => [
        subject.semester,
        subject.abbreviation || '',
        subject.name,
        subject.subject_type,
        subject.completion_type,
        subject.credits,
        subject.points || '',
        subject.hours || '',
        subject.completed ? 'Ano' : 'Ne',
        subject.exam_completed ? 'Ano' : 'Ne',
        subject.credit_completed ? 'Ano' : 'Ne',
        subject.planned ? 'Ano' : 'Ne',
        subject.grade || '',
        subject.final_date ? new Date(subject.final_date).toLocaleDateString('cs-CZ') : '',
        subject.lecturer || '',
        subject.department || ''
      ])

      subjectsSheet.addRows(dataRows)

      // Set column widths for better readability
      const columnWidths = [8, 12, 35, 15, 12, 8, 8, 8, 10, 10, 10, 10, 8, 12, 25, 20]
      columnWidths.forEach((width, index) => {
        subjectsSheet.getColumn(index + 1).width = width
      })
    } else {
      // Create empty subjects sheet
      const emptySubjectsData = [
        ['🎓 SLEDOVÁNÍ STUDIÍ - EXPORT DAT'],
        [''],
        ['ℹ️ ŽÁDNÉ PŘEDMĚTY'],
        ['====================================='],
        [''],
        ['Pro toto studium nebyly nalezeny žádné předměty.']
      ]

      subjectsSheet.addRows(emptySubjectsData)
      subjectsSheet.getColumn(1).width = 50
    }
  }

  // Generate and download file with branded name
  const fileName = `sledovani_studii_export_${new Date().toISOString().split('T')[0]}.xlsx`

  // Generate buffer and trigger download
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
