import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PracticeIndex } from "@/components/practice/practice-index"
import { PRACTICE_ROBOTS, hasPracticeSession, practicePath, requirePracticeSession } from "@/lib/practice/access"
import { loadPracticeModuleView } from "@/lib/practice/view"
import { PRACTICE_ROUTE_SEGMENT } from "@/lib/constants"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ slug: string; moduleSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PracticeModulePage({ params, searchParams }: PageProps) {
  const { slug, moduleSlug } = await params
  const path = practicePath(slug, PRACTICE_ROUTE_SEGMENT, moduleSlug)
  await requirePracticeSession(path, await searchParams)

  const view = await loadPracticeModuleView(slug, moduleSlug)
  if (!view) notFound()
  return <PracticeIndex view={view} basePath={path} />
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, moduleSlug } = await params
  if (!(await hasPracticeSession())) return { title: "Procvičování – Sledování studií", robots: PRACTICE_ROBOTS }
  const view = await loadPracticeModuleView(slug, moduleSlug)
  return {
    title: view ? `Procvičování – ${view.module.title} – Sledování studií` : "Stránka nenalezena – Sledování studií",
    robots: PRACTICE_ROBOTS,
  }
}
