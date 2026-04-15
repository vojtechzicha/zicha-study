"use client"

import { useState, useEffect, use } from "react"
import { useSession } from "next-auth/react"
import { fetchStudy } from "@/lib/actions/studies"
import { StudyDetail } from "@/components/study-detail"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
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
  diploma_url?: string | null
  diploma_mime_type?: string
  diploma_uploaded_at?: string
  earliest_arrival_time?: string | null
  created_at: string
}

export default function StudyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { status } = useSession()
  const [study, setStudy] = useState<Study | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
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
    if (status !== "authenticated") return

    const loadStudy = async () => {
      const data = await fetchStudy(id)

      if (!data) {
        setNotFound(true)
      } else {
        setStudy(data)
      }
      setLoading(false)
    }

    loadStudy()
  }, [id, status])

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
    router.push("/")
  }

  return <StudyDetail study={study} onBack={handleBack} />
}
