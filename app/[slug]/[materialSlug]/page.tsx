import type { JSX } from 'react'
import * as db from "@/lib/mongodb/db"
import { auth } from "@/auth"
import { checkFileExists } from "@/lib/utils/onedrive-cache"
import { redirect, notFound } from "next/navigation"
import { Loader2, FileText, ArrowLeft, Globe, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PublicPageFooter } from "@/components/public-page-footer"
import Link from "next/link"

interface PageProps {
  params: Promise<{ slug: string; materialSlug: string }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PublicMaterialPage({ params, searchParams }: PageProps) {
  const { slug, materialSlug } = await params
  const search = await searchParams

  // First, get the study by public slug (with specific fields)
  const rawStudy = await db.getStudyBySlugMetadata(slug, { name: 1, is_public: 1, public_slug: 1, logo_url: 1 })

  if (!rawStudy) {
    notFound()
  }

  const study = db.normalizeId(rawStudy)!

  // Try to find the item in study materials, subject materials, and study notes
  const [rawStudyMaterial, rawSubjectMaterial, rawStudyNote] = await Promise.all([
    db.getMaterialBySlug(study.id, materialSlug),
    db.getSubjectMaterialBySlug(study.id, materialSlug),
    db.getPublicStudyNoteBySlug(materialSlug, study.id)
  ])

  const studyMaterial = rawStudyMaterial ? db.normalizeId(rawStudyMaterial) : null
  const subjectMaterial = rawSubjectMaterial ? db.normalizeId(rawSubjectMaterial) : null
  const studyNote = rawStudyNote ? db.normalizeId(rawStudyNote) : null
  const isSubjectMaterial = !!subjectMaterial
  const isStudyNote = !!studyNote

  // If it's a study note, render the note display instead
  if (isStudyNote && studyNote) {
    // Get linked subjects from the denormalized array on the study note
    const linkedSubjectsData = (rawStudyNote as any)?.linked_subjects || []

    // Fetch actual subject details for all linked subjects
    const linkedSubjectIds = linkedSubjectsData.map((link: { subject_id: string }) => link.subject_id)
    const rawSubjects = linkedSubjectIds.length > 0
      ? await db.getSubjectsByIds(linkedSubjectIds)
      : []
    const subjects = db.normalizeIds(rawSubjects)

    // Build subject map for easy lookup
    const subjectMap = new Map(subjects.map(s => [s.id, s]))

    // Sort: primary first, then others
    const sortedLinks = [...linkedSubjectsData].sort(
      (a: { is_primary: boolean }, b: { is_primary: boolean }) =>
        (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)
    )

    // Find the primary subject for display
    const primaryLink = sortedLinks.find((link: { is_primary: boolean }) => link.is_primary)
    const primarySubjectData = primaryLink ? subjectMap.get(primaryLink.subject_id) : null
    const primarySubject = primarySubjectData ? {
      id: primarySubjectData.id,
      name: primarySubjectData.name,
      abbreviation: (primarySubjectData as any).abbreviation
    } : null

    // Get all subjects for display in the header
    const allSubjects = sortedLinks
      .map((link: { subject_id: string; is_primary: boolean }) => {
        const subj = subjectMap.get(link.subject_id)
        if (!subj) return null
        return {
          id: subj.id,
          name: subj.name,
          abbreviation: (subj as any).abbreviation,
          is_primary: link.is_primary
        }
      })
      .filter(Boolean) as { id: string; name: string; abbreviation: string | null; is_primary: boolean }[]

    // Resolve OneDrive URLs: prefer original, fall back to cache copy
    let effectiveWebUrl = studyNote.onedrive_web_url
    let effectiveDownloadUrl = studyNote.onedrive_download_url
    const session = await auth()
    if (session?.accessToken && (studyNote as any).onedrive_id) {
      try {
        const { exists } = await checkFileExists((studyNote as any).onedrive_id)
        if (!exists) {
          effectiveWebUrl = (studyNote as any).cache_onedrive_web_url || studyNote.onedrive_web_url
          effectiveDownloadUrl = (studyNote as any).cache_onedrive_web_url || studyNote.onedrive_download_url
        }
      } catch {
        // Check failed, keep original URLs
      }
    } else if (!session?.accessToken) {
      // No admin session — prefer cache URL if available (can't verify original)
      effectiveWebUrl = (studyNote as any).cache_onedrive_web_url || studyNote.onedrive_web_url
      effectiveDownloadUrl = (studyNote as any).cache_onedrive_web_url || studyNote.onedrive_download_url
    }

    const { StudyNoteDisplay } = await import("@/components/study-note-display")
    return (
      <div className="min-h-screen bg-primary-50">
        <StudyNoteDisplay
          note={{
            ...studyNote,
            onedrive_web_url: effectiveWebUrl,
            onedrive_download_url: effectiveDownloadUrl,
            subjects: allSubjects
          }}
          subject={primarySubject}
          study={study}
          flush={search?.flush === '1'}
        />
      </div>
    )
  }

  const material = studyMaterial || subjectMaterial

  if (!material) {
    notFound()
  }

  // For subject materials, fetch the subject info
  let subjectInfo: { name: string; abbreviation: string | null } | null = null
  if (isSubjectMaterial && subjectMaterial && (subjectMaterial as any).subject_id) {
    const rawSubject = await db.getSubjectById((subjectMaterial as any).subject_id)
    if (rawSubject) {
      subjectInfo = {
        name: (rawSubject as any).name,
        abbreviation: (rawSubject as any).abbreviation
      }
    }
  }

  // Determine which share URL to use (original or cache fallback)
  let shareUrl: string | null = null
  let shareError: string | null = null

  try {
    const session = await auth()

    if (session?.accessToken && (material as any).onedrive_id) {
      // Admin is logged in — do a live check on the original file
      try {
        const { exists } = await checkFileExists((material as any).onedrive_id)
        if (exists) {
          shareUrl = (material as any).public_share_url || (material as any).cache_public_share_url || null
        } else {
          // Original gone — use cache share URL
          shareUrl = (material as any).cache_public_share_url || (material as any).public_share_url || null
        }
      } catch {
        shareUrl = (material as any).public_share_url || (material as any).cache_public_share_url || null
      }
    } else {
      // No admin session — use whichever URL we have
      shareUrl = (material as any).public_share_url || (material as any).cache_public_share_url || null
    }

    if (!shareUrl) {
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
            {isSubjectMaterial && subjectInfo
              ? `Materiál z předmětu ${subjectInfo.abbreviation || subjectInfo.name} (${study.name})`
              : `Materiál ze studia ${study.name}`
            }
          </p>
        </div>

        {/* Material Card */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardContent className="p-8">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 p-4 bg-primary-50 rounded-xl">
                {getFileIcon((material as any).file_extension)}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-900 mb-2">{(material as any).name}</h2>
                <p className="text-sm text-gray-600 mb-2">Soubor: {(material as any).file_name}</p>

                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  {(material as any).category && (
                    <span className="bg-primary-100 px-2 py-1 rounded">
                      {(material as any).category}
                    </span>
                  )}
                  {(material as any).file_size && (
                    <span>{formatFileSize((material as any).file_size)}</span>
                  )}
                </div>

                {(material as any).description && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Popis</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{(material as any).description}</p>
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

        <PublicPageFooter
          studyName={study.name}
          studySlug={study.public_slug}
        />
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: PageProps) {
  const { slug, materialSlug } = await params

  // First, get the study by public slug
  const rawStudy = await db.getStudyBySlugMetadata(slug, { name: 1 })
  const study = db.normalizeId(rawStudy)

  if (!study) {
    return { title: "Nenalezeno" }
  }

  // Check if it's a study note
  const rawNote = await db.getPublicStudyNoteBySlug(materialSlug, study.id)

  if (rawNote) {
    const note = db.normalizeId(rawNote)!

    // Get linked subjects from the denormalized array
    const linkedSubjectsData = (rawNote as any).linked_subjects || []

    // Fetch actual subject details
    const linkedSubjectIds = linkedSubjectsData.map((link: { subject_id: string }) => link.subject_id)
    const rawSubjects = linkedSubjectIds.length > 0
      ? await db.getSubjectsByIds(linkedSubjectIds)
      : []
    const subjects = db.normalizeIds(rawSubjects)
    const subjectMap = new Map(subjects.map(s => [s.id, s]))

    // Sort: primary first
    const sortedLinks = [...linkedSubjectsData].sort(
      (a: { is_primary: boolean }, b: { is_primary: boolean }) =>
        (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)
    )

    const allSubjects = sortedLinks
      .map((link: { subject_id: string }) => subjectMap.get(link.subject_id))
      .filter(Boolean) as { id: string; name: string; abbreviation?: string | null }[]

    const primaryLink = sortedLinks.find((link: { is_primary: boolean }) => link.is_primary)
    const primarySubject = primaryLink ? subjectMap.get(primaryLink.subject_id) : null

    const subjectNames = allSubjects.length > 0
      ? allSubjects.map(s => (s as any).abbreviation || s.name).join(", ")
      : "Neznámý předmět"

    return {
      title: `${(note as any).name} - ${(primarySubject as any)?.abbreviation || subjectNames}`,
      description: (note as any).description || `Studijní poznámka k předmětům: ${allSubjects.map(s => s.name).join(", ")}`,
    }
  }

  // Check if it's a material
  const [rawStudyMaterial, rawSubjectMaterial] = await Promise.all([
    db.getMaterialBySlug(study.id, materialSlug),
    db.getSubjectMaterialBySlug(study.id, materialSlug)
  ])

  const studyMaterialData = rawStudyMaterial ? db.normalizeId(rawStudyMaterial) : null
  const subjectMaterialData = rawSubjectMaterial ? db.normalizeId(rawSubjectMaterial) : null
  const material = studyMaterialData || subjectMaterialData

  if (material) {
    // For subject materials, fetch subject info separately
    let subjectInfo: { name: string; abbreviation: string } | undefined
    if (subjectMaterialData && (subjectMaterialData as any).subject_id) {
      const rawSubject = await db.getSubjectById((subjectMaterialData as any).subject_id)
      if (rawSubject) {
        subjectInfo = {
          name: (rawSubject as any).name,
          abbreviation: (rawSubject as any).abbreviation
        }
      }
    }

    return {
      title: `${(material as any).name} - ${study.name}`,
      description: (material as any).description || `Materiál ze studia ${study.name}${subjectInfo ? ` - ${subjectInfo.name}` : ''}`,
    }
  }

  return { title: "Nenalezeno" }
}
