"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { StudyForm } from "@/components/study-form"
import { LoginForm } from "@/components/login-form"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js"

export default function NewStudyPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

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