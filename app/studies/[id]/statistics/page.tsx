"use client"

import { useState, useEffect, use } from "react"
import { useSession } from "next-auth/react"
import { createClient } from "@/lib/supabase/client"
import { StudyStatistics } from "@/components/study-statistics"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useFavicon } from "@/hooks/use-favicon"

interface Study {
  id: string
  name: string
  logo_url?: string
}

interface Subject {
  id: string
  study_id: string
  semester: string
  abbreviation: string
  name: string
  completion_type: string
  subject_type: string
  credits: number
  hours?: number
  points?: number
  grade?: string
  lecturer?: string
  department?: string
  completed: boolean
  exam_completed: boolean
  credit_completed: boolean
  final_date?: string
  created_at: string
}

export default function StudyStatisticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { status } = useSession()
  const [study, setStudy] = useState<Study | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  useFavicon(study?.logo_url)

  // Update document title with study name
  useEffect(() => {
    if (study?.name) {
      document.title = `Statistiky - ${study.name}`
    }
  }, [study?.name])

  useEffect(() => {
    if (status !== "authenticated") return

    const fetchData = async () => {
      const { data: studyData, error: studyError } = await supabase.from("studies").select("id, name, logo_url").eq("id", id).single()

      if (studyError || !studyData) {
        setNotFound(true)
      } else {
        setStudy(studyData)
      }

      const { data: subjectsData, error: subjectsError } = await supabase.from("subjects").select("*").eq("study_id", id).order("semester", { ascending: true })

      if (!subjectsError && subjectsData) {
        setSubjects(subjectsData)
      }

      setLoading(false)
    }

    fetchData()
  }, [id, supabase, status])

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (notFound || !study) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Studium nenalezeno</h1>
          <p className="text-gray-600">Požadované studium neexistuje nebo k němu nemáte přístup.</p>
        </div>
      </div>
    )
  }

  const handleBack = () => {
    router.push(`/studies/${id}`)
  }

  return (
    <StudyStatistics
      subjects={subjects}
      studyName={study.name}
      studyLogoUrl={study.logo_url}
      onBack={handleBack}
    />
  )
}
