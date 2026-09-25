import * as db from "@/lib/mongodb/db"
import { PublicStudyView } from "@/components/public-study-view"
import { notFound } from "next/navigation"
import { RESERVED_ROUTES, getStudyFormLabel } from "@/lib/constants"

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function PublicStudyPage({ params }: PageProps) {
  const { slug } = await params

  if (RESERVED_ROUTES.includes(slug.toLowerCase())) {
    notFound()
  }

  const rawStudy = await db.getStudyBySlug(slug)

  if (!rawStudy) {
    notFound()
  }

  const study = db.normalizeId(rawStudy)!

  const rawSubjects = await db.getSubjectsByStudyId(study.id)
  const subjects = db.normalizeIds(rawSubjects)

  return <PublicStudyView study={study} subjects={subjects} />
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params

  if (RESERVED_ROUTES.includes(slug.toLowerCase())) {
    return {
      title: "Stránka nenalezena – Sledování studií",
    }
  }

  const rawStudy = await db.getStudyBySlugMetadata(slug, { name: 1, public_description: 1, type: 1, form: 1 })
  const study = db.normalizeId(rawStudy)

  if (!study) {
    return {
      title: "Studium nenalezeno – Sledování studií",
    }
  }

  return {
    title: `${study.name} – Sledování studií`,
    description: study.public_description || `Předměty, výsledky a materiály ze studia ${study.name} (${study.type}, ${getStudyFormLabel(study.form)}).`,
  }
}
