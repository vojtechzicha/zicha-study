"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TitlePageFooter } from "@/components/title-page-footer"

export function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMicrosoftLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      await signIn("microsoft-entra-id", { callbackUrl: "/" })
    } catch {
      setError("Chyba při přihlašování. Zkuste to prosím znovu.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary-50 to-primary-100">
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-700 rounded-full flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">Sledování studií</CardTitle>
              <CardDescription className="text-gray-600 mt-2">
                Přihlaste se pomocí Microsoft osobního účtu
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              onClick={handleMicrosoftLogin}
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              size="lg"
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 23 23" fill="currentColor">
                <path d="M11 11H0V0h11v11zm0 12H0V12h11v11zm12-12H12V0h11v11zm0 12H12V12h11v11z" />
              </svg>
              {loading ? "Přihlašování..." : "Přihlásit se přes Microsoft"}
            </Button>
          </CardContent>
        </Card>
      </main>
      <TitlePageFooter />
    </div>
  )
}
