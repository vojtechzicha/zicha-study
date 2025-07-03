"use client"

import { useState, useEffect, use } from "react"
import { createClient } from "@/lib/supabase/client"
import { StudyStatistics } from "@/components/study-statistics"
import { LoginForm } from "@/components/login-form"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"

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
  const [user, setUser] = useState<User | null>(null)
  const [study, setStudy] = useState<Study | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const initialize = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      
      setUser(user)
      
      if (user) {
        await fetchData()
      }
      
      setLoading(false)
    }

    const fetchData = async () => {
      const [studyResult, subjectsResult] = await Promise.all([
        supabase.from("studies").select("id, name, logo_url").eq("id", id).single(),
        supabase.from("subjects").select("*").eq("study_id", id).order("semester", { ascending: true })
      ])

      if (studyResult.error || !studyResult.data) {
        setNotFound(true)
      } else {
        setStudy(studyResult.data)
      }

      if (!subjectsResult.error && subjectsResult.data) {
        setSubjects(subjectsResult.data)
      }
    }

    initialize()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [id, supabase.auth])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  if (notFound || !study) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
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