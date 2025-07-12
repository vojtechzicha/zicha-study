"use client"

import { useState, useEffect, use } from "react"
import { createClient } from "@/lib/supabase/client"
import { StudyDetail } from "@/components/study-detail"
import { LoginForm } from "@/components/login-form"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js"
import { useFavicon } from "@/hooks/use-favicon"

interface Study {
  id: string
  name: string
  type: string
  form: string
  start_year: number
  end_year?: number
  status: "active" | "completed" | "paused" | "abandoned"
  logo_url?: string
  created_at: string
}

export default function StudyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [user, setUser] = useState<User | null>(null)
  const [study, setStudy] = useState<Study | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  
  // Update favicon with study logo
  useFavicon(study?.logo_url)

  // Update document title with study name
  useEffect(() => {
    if (study?.name) {
      document.title = `${study.name} - Studijní přehled`
    }
  }, [study?.name])

  useEffect(() => {
    const initialize = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      
      setUser(user)
      
      if (user) {
        await fetchStudy()
      }
      
      setLoading(false)
    }

    const fetchStudy = async () => {
      const { data, error } = await supabase
        .from("studies")
        .select("*")
        .eq("id", id)
        .single()

      if (error || !data) {
        setNotFound(true)
      } else {
        setStudy(data)
      }
    }

    initialize()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [id, supabase.auth])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
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
    router.push("/")
  }

  return <StudyDetail study={study} onBack={handleBack} user={user} />
}