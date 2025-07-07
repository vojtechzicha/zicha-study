import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'

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
    
    // Sheet 1: Study metadata
    const metadataSheetName = `${study.public_slug}_info`
    const metadataData = [
      ['Field', 'Value'],
      ['Study ID', study.id],
      ['Name', study.name],
      ['Type', study.type],
      ['Form', study.form],
      ['Start Year', study.start_year],
      ['End Year', study.end_year || 'Ongoing'],
      ['Status', study.status],
      ['Public', study.is_public ? 'Yes' : 'No'],
      ['Public Slug', study.public_slug],
      ['Created At', new Date(study.created_at).toLocaleString()],
      ['Public URL', `${window.location.origin}/${study.public_slug}`]
    ]
    
    const metadataWS = XLSX.utils.aoa_to_sheet(metadataData)
    // Auto-size columns
    metadataWS['!cols'] = [{ wch: 20 }, { wch: 50 }]
    XLSX.utils.book_append_sheet(workbook, metadataWS, metadataSheetName.substring(0, 31))
    
    // Sheet 2: Subjects table
    const subjectsSheetName = `${study.public_slug}_subjects`
    if (subjects && subjects.length > 0) {
      const subjectsData = subjects.map(subject => ({
        'Semester': subject.semester,
        'Abbreviation': subject.abbreviation || '',
        'Name': subject.name,
        'Type': subject.subject_type,
        'Completion': subject.completion_type,
        'Credits': subject.credits,
        'Points': subject.points || '',
        'Hours': subject.hours || '',
        'Completed': subject.completed ? 'Yes' : 'No',
        'Exam Completed': subject.exam_completed ? 'Yes' : 'No',
        'Credit Completed': subject.credit_completed ? 'Yes' : 'No',
        'Planned': subject.planned ? 'Yes' : 'No',
        'Grade': subject.grade || '',
        'Final Date': subject.final_date ? new Date(subject.final_date).toLocaleDateString() : '',
        'Lecturer': subject.lecturer || '',
        'Department': subject.department || '',
        'Created At': new Date(subject.created_at).toLocaleString()
      }))
      
      const subjectsWS = XLSX.utils.json_to_sheet(subjectsData)
      // Auto-size columns
      const maxWidth = 50
      const cols = Object.keys(subjectsData[0]).map(key => {
        const maxLength = Math.max(
          key.length,
          ...subjectsData.map(row => String(row[key as keyof typeof row]).length)
        )
        return { wch: Math.min(maxLength + 2, maxWidth) }
      })
      subjectsWS['!cols'] = cols
      
      XLSX.utils.book_append_sheet(workbook, subjectsWS, subjectsSheetName.substring(0, 31))
    } else {
      // Create empty subjects sheet with headers
      const emptySubjectsData = [['No subjects found for this study']]
      const subjectsWS = XLSX.utils.aoa_to_sheet(emptySubjectsData)
      XLSX.utils.book_append_sheet(workbook, subjectsWS, subjectsSheetName.substring(0, 31))
    }
  }
  
  // Generate and download file
  const fileName = `university_studies_export_${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(workbook, fileName)
}