"use client"

import { useSession } from "next-auth/react"
import { LoginForm } from "@/components/login-form"
import { Dashboard } from "@/components/dashboard"
import { Loader2 } from "lucide-react"
import { useLogoTheme } from "@/hooks/use-logo-theme"

export default function HomePage() {
  const { data: session, status } = useSession()

  // Clear any study palette left over from a previous page
  useLogoTheme(null)

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-950 dark:to-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) {
    return <LoginForm />
  }

  return <Dashboard user={session.user!} />
}
