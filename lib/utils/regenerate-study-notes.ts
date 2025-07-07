import { createClient } from '@/lib/supabase/client'

export async function regenerateAllStudyNotes() {
  const supabase = createClient()
  
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    
    // Get all studies for the user
    const { data: studies, error: studiesError } = await supabase
      .from('studies')
      .select('id, name')
      .eq('user_id', user.id)
    
    if (studiesError) throw studiesError
    if (!studies || studies.length === 0) {
      return { success: true, message: 'Žádná studia k regeneraci', stats: { total: 0, success: 0, failed: 0 } }
    }
    
    // Get all public study notes across all studies
    const { data: studyNotes, error: notesError } = await supabase
      .from('study_notes')
      .select('id, public_slug, name, study_id')
      .in('study_id', studies.map(s => s.id))
      .eq('is_public', true)
    
    if (notesError) throw notesError
    if (!studyNotes || studyNotes.length === 0) {
      return { success: true, message: 'Žádné studijní zápisy k regeneraci', stats: { total: 0, success: 0, failed: 0 } }
    }
    
    console.log(`Found ${studyNotes.length} study notes to regenerate`)
    
    // Regenerate each study note
    let successCount = 0
    let failedCount = 0
    const errors: string[] = []
    
    for (const note of studyNotes) {
      try {
        console.log(`Regenerating: ${note.name} (${note.public_slug})`)
        
        // Call the API without flush parameter to regenerate only if needed
        const response = await fetch(`/api/study-notes/${note.public_slug}/convert`)
        
        if (response.ok) {
          const data = await response.json()
          if (data.cached) {
            console.log(`✓ ${note.name} - using cached version`)
          } else {
            console.log(`✓ ${note.name} - regenerated successfully`)
          }
          successCount++
        } else {
          const error = await response.text()
          console.error(`✗ ${note.name} - failed: ${error}`)
          errors.push(`${note.name}: ${error}`)
          failedCount++
        }
      } catch (error) {
        console.error(`✗ ${note.name} - error:`, error)
        errors.push(`${note.name}: ${error}`)
        failedCount++
      }
      
      // Small delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    const message = failedCount > 0
      ? `Regenerováno ${successCount} z ${studyNotes.length} zápisů. ${failedCount} selhalo.`
      : `Úspěšně regenerováno všech ${successCount} studijních zápisů.`
    
    return {
      success: failedCount === 0,
      message,
      stats: {
        total: studyNotes.length,
        success: successCount,
        failed: failedCount
      },
      errors: errors.length > 0 ? errors : undefined
    }
  } catch (error) {
    console.error('Error regenerating study notes:', error)
    return {
      success: false,
      message: 'Chyba při regeneraci studijních zápisů',
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    }
  }
}