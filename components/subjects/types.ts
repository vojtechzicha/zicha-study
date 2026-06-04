/**
 * Shared prop contracts for the kind-dispatched subjects views.
 *
 * `study-subjects-section.tsx` looks the concrete component up in a registry
 * keyed by `StudyKind`, so every per-kind view (university / high school)
 * implements the same admin/public prop shape.
 */

export interface SubjectsStudy {
  id: string
  name: string
  type: string
  form?: string
  start_year: number
  end_year?: number | null
  status: string
  public_slug?: string
}

export interface StudySubjectsAdminProps {
  study: SubjectsStudy
  subjects: any[]
  loading: boolean
  onUpdate: () => void
}

export interface StudySubjectsPublicProps {
  study: SubjectsStudy
  subjects: any[]
}
