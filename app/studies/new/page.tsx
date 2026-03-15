"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { StudyForm } from "@/components/study-form"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export default function NewStudyPage() {
  const { status } = useSession()
  const router = useRouter()

  // Set document title
  useEffect(() => {
    document.title = "Nové studium - Sledování studií"
  }, [])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const handleClose = () => {
    router.push("/")
  }

  const handleSuccess = () => {
    router.push("/")
  }

  return (
    <StudyForm
      onClose={handleClose}
      onSuccess={handleSuccess}
    />
  )
}
