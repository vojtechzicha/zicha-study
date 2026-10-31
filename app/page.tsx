"use client"

import { Suspense, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { LoginForm } from "@/components/login-form"
import { Dashboard } from "@/components/dashboard"
import { Loader2 } from "lucide-react"
import { useLogoTheme } from "@/hooks/use-logo-theme"
import { safeCallbackUrl } from "@/lib/utils/callback-url"

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-950 dark:to-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  // Private pages send signed-out visitors here with ?callbackUrl=<their path>
  const callbackUrl = safeCallbackUrl(useSearchParams().get("callbackUrl"))

  // Clear any study palette left over from a previous page
  useLogoTheme(null)

  useEffect(() => {
    if (session && callbackUrl !== "/") router.replace(callbackUrl)
  }, [session, callbackUrl, router])

  if (status === "loading" || (session && callbackUrl !== "/")) return <Loading />

  if (!session) {
    return <LoginForm callbackUrl={callbackUrl} />
  }

  return <Dashboard user={session.user!} />
}

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Home />
    </Suspense>
  )
}
