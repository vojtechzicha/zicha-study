import { createServerClient } from "@/lib/supabase/server"
import { PublicStudyView } from "@/components/public-study-view"
import { notFound } from "next/navigation"

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function PublicStudyPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createServerClient()

  // Fetch study data
  const { data: study, error: studyError } = await supabase
    .from("studies")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .single()

  if (studyError || !study) {
    notFound()
  }

  // Fetch subjects data
  const { data: subjects, error: subjectsError } = await supabase
    .from("subjects")
    .select("*")
    .eq("study_id", study.id)
    .order("semester", { ascending: true })

  if (subjectsError) {
    notFound()
  }

  return <PublicStudyView study={study} subjects={subjects || []} />
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createServerClient()

  const { data: study } = await supabase
    .from("studies")
    .select("name, public_description, type, form")
    .eq("slug", slug)
    .eq("is_public", true)
    .single()

  if (!study) {
    return {
      title: "Studium nenalezeno",
    }
  }

  return {
    title: `${study.name} - Studijní pokrok`,
    description: study.public_description || `Sledování pokroku ve studiu ${study.name} (${study.type}, ${study.form})`,
  }
}
