"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { TitlePageFooter } from "@/components/title-page-footer"
import { approveMcpAuthorization, denyMcpAuthorization } from "@/lib/actions/mcp"

type McpConsentProps =
  | { view: "error"; error: string }
  | { view: "sign-in" }
  | {
      view: "consent"
      params: Record<string, string | undefined>
      clientName: string
      redirectHost: string
      email: string | null
      writeRequested: boolean
    }

export function McpConsent(props: McpConsentProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-950 dark:to-background">
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-card/80 backdrop-blur-sm">
          {props.view === "error" && <ErrorView error={props.error} />}
          {props.view === "sign-in" && <SignInView />}
          {props.view === "consent" && <ConsentView {...props} />}
        </Card>
      </main>
      <TitlePageFooter />
    </div>
  )
}

function Header({ title, description }: { title: string; description?: string }) {
  return (
    <CardHeader className="text-center space-y-4">
      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-700 rounded-full flex items-center justify-center">
        <Bot className="h-8 w-8 text-white" />
      </div>
      <div>
        <CardTitle className="text-2xl font-bold text-foreground">{title}</CardTitle>
        {description && <CardDescription className="text-muted-foreground mt-2">{description}</CardDescription>}
      </div>
    </CardHeader>
  )
}

function ErrorView({ error }: { error: string }) {
  return (
    <>
      <Header title="Připojení se nezdařilo" />
      <CardContent>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </CardContent>
    </>
  )
}

function SignInView() {
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    setLoading(true)
    // Back to this page, with the OAuth query intact, after the Microsoft login.
    await signIn("microsoft-entra-id", { callbackUrl: window.location.href })
  }

  return (
    <>
      <Header title="Připojit Claude" description="Přihlaste se osobním účtem Microsoft." />
      <CardContent>
        <Button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-medium"
          size="lg"
        >
          {loading ? "Přihlašování…" : "Přihlásit se přes Microsoft"}
        </Button>
      </CardContent>
    </>
  )
}

function ConsentView({
  params,
  clientName,
  redirectHost,
  email,
  writeRequested,
}: Extract<McpConsentProps, { view: "consent" }>) {
  const [access, setAccess] = useState<"write" | "read">(writeRequested ? "write" : "read")
  const [pending, setPending] = useState<"approve" | "deny" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const finish = async (action: "approve" | "deny") => {
    setPending(action)
    setError(null)
    const result =
      action === "approve"
        ? await approveMcpAuthorization(params, access === "write")
        : await denyMcpAuthorization(params)
    if (result.redirectTo) {
      window.location.assign(result.redirectTo)
      return
    }
    setError(result.error?.message || "Neznámá chyba.")
    setPending(null)
  }

  return (
    <>
      <Header title="Povolit přístup?" description={`„${clientName}“ bude mít přístup k datům všech studií.`} />
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {writeRequested && (
          <RadioGroup value={access} onValueChange={(v) => setAccess(v as "write" | "read")} className="space-y-2">
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <RadioGroupItem value="write" id="access-write" className="mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="access-write" className="font-medium">Číst i upravovat</Label>
                <p className="text-sm text-muted-foreground">Může vytvářet, měnit i mazat záznamy.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <RadioGroupItem value="read" id="access-read" className="mt-0.5" />
              <Label htmlFor="access-read" className="font-medium">Jen číst</Label>
            </div>
          </RadioGroup>
        )}

        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground space-y-1">
          {email && (
            <p>
              Účet: <span className="text-foreground">{email}</span>
            </p>
          )}
          <p>
            Návrat na: <span className="text-foreground">{redirectHost}</span>
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" disabled={!!pending} onClick={() => finish("deny")}>
            {pending === "deny" ? "Zamítání…" : "Zamítnout"}
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
            disabled={!!pending}
            onClick={() => finish("approve")}
          >
            {pending === "approve" ? "Povolování…" : "Povolit"}
          </Button>
        </div>
      </CardContent>
    </>
  )
}
