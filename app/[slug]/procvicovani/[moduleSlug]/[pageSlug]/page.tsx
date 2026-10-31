import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PracticePage } from "@/components/practice/practice-page"
import { PRACTICE_ROBOTS, hasPracticeSession, practicePath, requirePracticeSession } from "@/lib/practice/access"
import { loadPracticePageView } from "@/lib/practice/view"
import { PRACTICE_ROUTE_SEGMENT } from "@/lib/constants"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ slug: string; moduleSlug: string; pageSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PracticePageRoute({ params, searchParams }: PageProps) {
  const { slug, moduleSlug, pageSlug } = await params
  const indexPath = practicePath(slug, PRACTICE_ROUTE_SEGMENT, moduleSlug)
  await requirePracticeSession(`${indexPath}/${encodeURIComponent(pageSlug)}`, await searchParams)

  const view = await loadPracticePageView(slug, moduleSlug, pageSlug)
  if (!view) notFound()
  return <PracticePage view={view} indexHref={indexPath} />
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, moduleSlug, pageSlug } = await params
  if (!(await hasPracticeSession())) return { title: "Procvičování – Sledování studií", robots: PRACTICE_ROBOTS }
  const view = await loadPracticePageView(slug, moduleSlug, pageSlug)
  return {
    title: view ? `${view.page.title} – ${view.module.title} – Sledování studií` : "Stránka nenalezena – Sledování studií",
    robots: PRACTICE_ROBOTS,
  }
}
