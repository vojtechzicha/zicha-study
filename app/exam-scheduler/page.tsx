"use client"

import { useSession } from "next-auth/react"
import { Loader2 } from "lucide-react"
import { GlobalExamScheduler } from "@/components/global-exam-scheduler"
import { useLogoTheme } from "@/hooks/use-logo-theme"

export default function ExamSchedulerPage() {
  const { status } = useSession()
  useLogoTheme(null)

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return <GlobalExamScheduler />
}
