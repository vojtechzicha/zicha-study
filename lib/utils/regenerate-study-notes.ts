import { fetchStudies } from '@/lib/actions/studies'
import { fetchStudyNotes } from '@/lib/actions/study-notes'

export async function regenerateAllStudyNotes() {
  try {
    // Get all studies (single-user app, no user_id filter needed)
    const studies = await fetchStudies()

    if (!studies || studies.length === 0) {
      return { success: true, message: 'Žádná studia k regeneraci', stats: { total: 0, success: 0, failed: 0 } }
    }

    // Get all public study notes across all studies
    const allNotes = []
    for (const study of studies) {
      const notes = await fetchStudyNotes(study.id, true)
      allNotes.push(...notes)
    }
    const studyNotes = allNotes

    if (!studyNotes || studyNotes.length === 0) {
      return { success: true, message: 'Žádné studijní zápisy k regeneraci', stats: { total: 0, success: 0, failed: 0 } }
    }

    // Regenerate each study note
    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (const note of studyNotes) {
      try {
        // Call the API without flush parameter to regenerate only if needed
        const response = await fetch(`/api/study-notes/${note.public_slug}/convert`)

        if (response.ok) {
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
