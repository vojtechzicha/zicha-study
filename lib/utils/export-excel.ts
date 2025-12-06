import * as XLSX from 'xlsx'
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
  const workbook = XLSX.utils.book_new()
  
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
    const metadataSheetName = `${study.public_slug}_info`
    
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
    
    const metadataWS = XLSX.utils.aoa_to_sheet(metadataData)
    
    // Set column widths for better readability
    metadataWS['!cols'] = [{ wch: 25 }, { wch: 60 }]
    
    XLSX.utils.book_append_sheet(workbook, metadataWS, metadataSheetName.substring(0, 31))
    
    // Sheet 2: Subjects table
    const subjectsSheetName = `${study.public_slug}_subjects`
    
    if (subjects && subjects.length > 0) {
      // Create header section and subjects data
      const subjectsData = [
        ['🎓 SLEDOVÁNÍ STUDIÍ - EXPORT DAT'],
        [''],
        ['📚 PŘEDMĚTY STUDIA'],
        ['====================================='],
        [''],
        ['📚 Studium', `${study.name} (${studyInitials})`],
        ['📅 Exportováno', new Date().toLocaleString('cs-CZ')],
        [''],
        [''],
        // Headers row
        [
          'Semestr', 'Zkratka', 'Název', 'Typ', 'Zakončení', 'Kredity', 'Body', 'Hodiny',
          'Dokončeno', 'Zkouška', 'Zápočet', 'Plánováno', 'Známka', 'Datum', 'Vyučující', 'Katedra'
        ],
        // Data rows
        ...(subjects as ExportSubject[]).map((subject: ExportSubject) => [
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
      ]
      
      const subjectsWS = XLSX.utils.aoa_to_sheet(subjectsData)
      
      // Set column widths for better readability
      const columnWidths = [
        { wch: 8 },   // Semestr
        { wch: 12 },  // Zkratka
        { wch: 35 },  // Název
        { wch: 15 },  // Typ
        { wch: 12 },  // Zakončení
        { wch: 8 },   // Kredity
        { wch: 8 },   // Body
        { wch: 8 },   // Hodiny
        { wch: 10 },  // Dokončeno
        { wch: 10 },  // Zkouška
        { wch: 10 },  // Zápočet
        { wch: 10 },  // Plánováno
        { wch: 8 },   // Známka
        { wch: 12 },  // Datum
        { wch: 25 },  // Vyučující
        { wch: 20 }   // Katedra
      ]
      subjectsWS['!cols'] = columnWidths
      
      XLSX.utils.book_append_sheet(workbook, subjectsWS, subjectsSheetName.substring(0, 31))
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
      
      const subjectsWS = XLSX.utils.aoa_to_sheet(emptySubjectsData)
      subjectsWS['!cols'] = [{ wch: 50 }]
      XLSX.utils.book_append_sheet(workbook, subjectsWS, subjectsSheetName.substring(0, 31))
    }
  }
  
  // Generate and download file with branded name
  const fileName = `sledovani_studii_export_${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(workbook, fileName)
}