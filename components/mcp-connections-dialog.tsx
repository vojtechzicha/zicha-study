"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { fetchMcpConnections, revokeMcpConnection } from "@/lib/actions/mcp"

interface McpConnection {
  id: string
  client_name: string
  email: string | null
  can_write: boolean
  created_at: string
  last_used_at: string | null
}

interface McpConnectionsDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" })
}

export function McpConnectionsDialog({ open, onOpenChange }: McpConnectionsDialogProps) {
  const [mcpUrl, setMcpUrl] = useState<string | null>(null)
  const [connections, setConnections] = useState<McpConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<McpConnection | null>(null)
  const [revokePending, setRevokePending] = useState(false)
  const { toast } = useToast()

  const applyResult = useCallback((result: Awaited<ReturnType<typeof fetchMcpConnections>>) => {
    setMcpUrl(result.mcpUrl)
    setConnections(result.connections)
    setError(result.error ? "Nepodařilo se načíst připojení." : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetchMcpConnections().then((result) => {
      if (!cancelled) applyResult(result)
    })
    return () => {
      cancelled = true
    }
  }, [open, applyResult])

  const copyUrl = async () => {
    if (!mcpUrl) return
    await navigator.clipboard.writeText(mcpUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRevoke = async () => {
    if (!revoking) return
    setRevokePending(true)
    const { error: revokeError } = await revokeMcpConnection(revoking.id)
    setRevokePending(false)
    if (revokeError) {
      toast({ title: "Nepodařilo se odpojit aplikaci", variant: "destructive" })
      return
    }
    toast({ title: "Aplikace odpojena" })
    setRevoking(null)
    applyResult(await fetchMcpConnections())
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Připojení Claude</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {mcpUrl && (
              <div className="p-4 bg-primary-50 dark:bg-primary-950 rounded-lg border border-primary-200 dark:border-primary-800">
                <Label className="text-sm font-medium text-primary-900 dark:text-primary-100">Adresa konektoru</Label>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 min-w-0 truncate p-2 bg-card rounded border border-border text-sm">{mcpUrl}</code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyUrl}
                    aria-label={copied ? "Zkopírováno" : "Kopírovat adresu"}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  V Claude ji přidejte jako vlastní konektor (Nastavení → Konektory).
                </p>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Připojené aplikace</Label>
              {loading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Načítání…
                </div>
              ) : connections.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Žádná připojení.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {connections.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground truncate">{c.client_name}</span>
                          <Badge
                            variant="outline"
                            className="border-primary-200 text-primary-600 dark:border-primary-800 dark:text-primary-400"
                          >
                            {c.can_write ? "Čtení i úpravy" : "Jen čtení"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {[
                            c.email,
                            `připojeno ${formatDate(c.created_at)}`,
                            c.last_used_at ? `naposledy ${formatDate(c.last_used_at)}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setRevoking(c)}>
                        Odpojit
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revoking} onOpenChange={(o) => !o && !revokePending && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odpojit aplikaci?</AlertDialogTitle>
            <AlertDialogDescription>
              „{revoking?.client_name}“ ztratí přístup k datům. Připojit ji půjde znovu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokePending}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRevoke()
              }}
              disabled={revokePending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {revokePending ? "Odpojování…" : "Odpojit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
