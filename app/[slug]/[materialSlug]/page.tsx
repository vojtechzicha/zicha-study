import type { JSX } from 'react'
import { createServerDb } from "@/lib/supabase/db"
import { redirect, notFound } from "next/navigation"
import { Loader2, FileText, ArrowLeft, Globe, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

interface PageProps {
  params: Promise<{ slug: string; materialSlug: string }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

// Type for Supabase linked subjects query result
interface LinkedSubjectResult {
  subject_id: string
  is_primary: boolean
  subjects: {
    id: string
    name: string
    abbreviation: string | null
    study_id: string
  }
}

// Type for metadata linked subjects query result
interface MetadataLinkedSubjectResult {
  is_primary: boolean
  subjects: {
    name: string
    abbreviation: string | null
  }
}

export default async function PublicMaterialPage({ params, searchParams }: PageProps) {
  const { slug, materialSlug } = await params
  const search = await searchParams
  const supabase = createServerDb()

  // First, get the study by public slug
  const { data: study, error: studyError } = await supabase
    .from("studies")
    .select("id, name, is_public, public_slug, logo_url")
    .eq("public_slug", slug)
    .eq("is_public", true)
    .single()

  if (studyError || !study) {
    notFound()
  }

  // Try to find the item in study materials, subject materials, and study notes
  const [studyMaterialResult, subjectMaterialResult, studyNoteResult] = await Promise.all([
    supabase
      .from("materials")
      .select("*")
      .eq("study_id", study.id)
      .eq("public_slug", materialSlug)
      .eq("is_public", true)
      .single(),
    supabase
      .from("subject_materials")
      .select("*, subjects(name, abbreviation)")
      .eq("study_id", study.id)
      .eq("public_slug", materialSlug)
      .eq("is_public", true)
      .single(),
    supabase
      .from("study_notes")
      .select("*")
      .eq("study_id", study.id)
      .eq("public_slug", materialSlug)
      .eq("is_public", true)
      .single()
  ])

  const material = studyMaterialResult.data || subjectMaterialResult.data
  const studyNote = studyNoteResult.data
  const isSubjectMaterial = !!subjectMaterialResult.data
  const isStudyNote = !!studyNote

  // If it's a study note, render the note display instead
  if (isStudyNote) {
    // Get all linked subjects for this study note
    const { data: linkedSubjectsRaw } = await supabase
      .from("study_note_subjects")
      .select(`
        subject_id,
        is_primary,
        subjects!inner (
          id,
          name,
          abbreviation,
          study_id
        )
      `)
      .eq("study_note_id", studyNote.id)
      .order("is_primary", { ascending: false })

    const linkedSubjects = linkedSubjectsRaw as LinkedSubjectResult[] | null

    // Find the primary subject for display
    const primarySubjectLink = linkedSubjects?.find(link => link.is_primary)
    const primarySubject = primarySubjectLink ? {
      id: primarySubjectLink.subjects.id,
      name: primarySubjectLink.subjects.name,
      abbreviation: primarySubjectLink.subjects.abbreviation
    } : null

    // Get all subjects for display in the header
    const allSubjects = linkedSubjects?.map(link => ({
      id: link.subjects.id,
      name: link.subjects.name,
      abbreviation: link.subjects.abbreviation,
      is_primary: link.is_primary
    })) || []

    const { StudyNoteDisplay } = await import("@/components/study-note-display")
    return (
      <div className="min-h-screen bg-primary-50">
        <StudyNoteDisplay
          note={{
            ...studyNote,
            subjects: allSubjects
          }}
          subject={primarySubject}
          study={study}
          flush={search?.flush === '1'}
        />
      </div>
    )
  }

  if (!material) {
    notFound()
  }

  // Use the stored public share URL
  let shareUrl: string | null = null
  let shareError: string | null = null

  try {
    if (material.public_share_url) {
      shareUrl = material.public_share_url
    } else {
      shareError = "Veřejný odkaz pro tento materiál není dostupný"
    }
  } catch (error) {
    console.error("Error accessing share link:", error)
    shareError = "Nepodařilo se načíst odkaz pro zobrazení souboru"
  }

  const fileIcons: { [key: string]: JSX.Element } = {
    pdf: <FileText className="h-12 w-12 text-red-600" />,
    doc: <FileText className="h-12 w-12 text-primary" />,
    docx: <FileText className="h-12 w-12 text-primary" />,
    xls: <FileText className="h-12 w-12 text-green-600" />,
    xlsx: <FileText className="h-12 w-12 text-green-600" />,
    ppt: <FileText className="h-12 w-12 text-orange-600" />,
    pptx: <FileText className="h-12 w-12 text-orange-600" />,
    default: <FileText className="h-12 w-12 text-gray-600" />,
  }

  function getFileIcon(extension: string | null) {
    if (!extension) return fileIcons.default
    const ext = extension.toLowerCase().replace(".", "")
    return fileIcons[ext] || fileIcons.default
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return ""
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  // If we have a share URL, redirect to it
  if (shareUrl && !shareError) {
    redirect(shareUrl)
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(to bottom right, var(--primary-50, hsl(217, 100%, 95%)), var(--primary-100, hsl(217, 100%, 90%)))`,
        minHeight: "100vh"
      } as React.CSSProperties}
    >
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/${slug}`} className="inline-flex items-center text-primary hover:text-primary/80 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zpět na {study.name}
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Globe className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">Veřejný materiál</h1>
          </div>
          <p className="text-gray-600">
            {isSubjectMaterial
              ? `Materiál z předmětu ${(material as any).subjects?.abbreviation || (material as any).subjects?.name} (${study.name})`
              : `Materiál ze studia ${study.name}`
            }
          </p>
        </div>

        {/* Material Card */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardContent className="p-8">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 p-4 bg-primary-50 rounded-xl">
                {getFileIcon(material.file_extension)}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-900 mb-2">{material.name}</h2>
                <p className="text-sm text-gray-600 mb-2">Soubor: {material.file_name}</p>

                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  {material.category && (
                    <span className="bg-primary-100 px-2 py-1 rounded">
                      {material.category}
                    </span>
                  )}
                  {material.file_size && (
                    <span>{formatFileSize(material.file_size)}</span>
                  )}
                </div>

                {material.description && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Popis</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{material.description}</p>
                  </div>
                )}

                {shareError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{shareError}</AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                      <p className="text-gray-600">Přesměrování na OneDrive...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fallback button if redirect doesn't work */}
        {shareUrl && (
          <div className="mt-6 text-center">
            <Button asChild className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white">
              <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                Otevřít materiál v OneDrive
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: PageProps) {
  const { slug, materialSlug } = await params
  const supabase = createServerDb()

  // First, get the study by public slug
  const { data: study } = await supabase
    .from("studies")
    .select("id, name")
    .eq("public_slug", slug)
    .eq("is_public", true)
    .single()

  if (!study) {
    return { title: "Nenalezeno" }
  }

  // Check if it's a study note
  const { data: note } = await supabase
    .from("study_notes")
    .select(`
      id,
      name,
      description
    `)
    .eq("study_id", study.id)
    .eq("public_slug", materialSlug)
    .eq("is_public", true)
    .single()

  if (note) {
    // Get all linked subjects
    const { data: linkedSubjectsRaw } = await supabase
      .from("study_note_subjects")
      .select(`
        is_primary,
        subjects!inner (
          name,
          abbreviation
        )
      `)
      .eq("study_note_id", note.id)
      .order("is_primary", { ascending: false })

    const linkedSubjects = linkedSubjectsRaw as MetadataLinkedSubjectResult[] | null
    const subjects = linkedSubjects?.map(link => link.subjects) || []
    const primarySubject = linkedSubjects?.find(link => link.is_primary)?.subjects

    const subjectNames = subjects.length > 0
      ? subjects.map(s => s.abbreviation || s.name).join(", ")
      : "Neznámý předmět"

    return {
      title: `${note.name} - ${primarySubject?.abbreviation || subjectNames}`,
      description: note.description || `Studijní poznámka k předmětům: ${subjects.map(s => s.name).join(", ")}`,
    }
  }

  // Check if it's a material
  const [studyMaterialResult, subjectMaterialResult] = await Promise.all([
    supabase
      .from("materials")
      .select("name, description")
      .eq("study_id", study.id)
      .eq("public_slug", materialSlug)
      .eq("is_public", true)
      .single(),
    supabase
      .from("subject_materials")
      .select("name, description, subjects(name, abbreviation)")
      .eq("study_id", study.id)
      .eq("public_slug", materialSlug)
      .eq("is_public", true)
      .single()
  ])

  const material = studyMaterialResult.data || subjectMaterialResult.data

  if (material) {
    const subjectInfo = subjectMaterialResult.data?.subjects as { name: string; abbreviation: string } | undefined
    return {
      title: `${material.name} - ${study.name}`,
      description: material.description || `Materiál ze studia ${study.name}${subjectInfo ? ` - ${subjectInfo.name}` : ''}`,
    }
  }

  return { title: "Nenalezeno" }
}
