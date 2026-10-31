"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy, ExternalLink, Loader2, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import {
  checkPracticeAddressAction,
  deletePracticePageAction,
  fetchPracticeAdmin,
  importPracticePageAction,
  updatePracticeModuleAction,
  type PracticeAdminData,
} from "@/lib/actions/practice"
import { PRACTICE_ROUTE_SEGMENT, PRACTICE_SLUG_PATTERN, PRACTICE_UNGROUPED_LABEL } from "@/lib/constants"
import { getShareUrl } from "@/lib/utils/share-url"
import { cleanSlugInput, createSlug } from "@/lib/utils/slug"
import { czPlural } from "@/lib/utils/task-format"

// The subject dialog's Procvičování tab (only shown while practice is enabled): the module's
// address and study note, its pages with progress, and uploading generator HTML pages.

// Select values: special options can't collide with group keys, which are namespaced "group:<key>"
const NO_NOTE = "none"
const NEW_GROUP = "special:new"
const NO_GROUP = "special:keep"
const GROUP_PREFIX = "group:"

interface PendingFile {
  file: File
  html: string
  slug: string
  status: "ready" | "uploading" | "done" | "error"
  message?: string
}

function slugFromHtml(html: string, fileName: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html")
    const meta = doc.querySelector('meta[name="practice-slug"]')?.getAttribute("content")?.trim()
    if (meta && PRACTICE_SLUG_PATTERN.test(meta)) return meta
  } catch {
    // fall back to the file name
  }
  return createSlug(fileName.replace(/\.html?$/i, ""))
}

export function PracticeAdminTab({ subjectId }: { subjectId: string }) {
  const [data, setData] = useState<PracticeAdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [prefix, setPrefix] = useState("")
  const [slug, setSlug] = useState("")
  // Last server answer for an edited address; availability itself is derived below
  const [checked, setChecked] = useState<{ prefix: string; slug: string; available: boolean } | null>(null)
  const [savingAddress, setSavingAddress] = useState(false)

  const [files, setFiles] = useState<PendingFile[]>([])
  const [group, setGroup] = useState(NO_GROUP)
  const [newGroupTitle, setNewGroupTitle] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const [copied, setCopied] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<{ slug: string; title: string } | null>(null)

  const apply = useCallback((result: Awaited<ReturnType<typeof fetchPracticeAdmin>>) => {
    if (result.error || !result.data) {
      setError(result.error?.message ?? "Procvičování je vypnuté.")
    } else {
      setData(result.data)
      setPrefix(result.data.module.addressPrefix)
      setSlug(result.data.module.slug)
      setError(null)
    }
    setLoading(false)
  }, [])

  // After saving or uploading (called from event handlers)
  const load = useCallback(async () => apply(await fetchPracticeAdmin(subjectId)), [apply, subjectId])

  useEffect(() => {
    let cancelled = false
    fetchPracticeAdmin(subjectId).then((result) => {
      if (!cancelled) apply(result)
    })
    return () => {
      cancelled = true
    }
  }, [apply, subjectId])

  const addressEdited = !!data && (prefix !== data.module.addressPrefix || slug !== data.module.slug)
  const addressValid = PRACTICE_SLUG_PATTERN.test(prefix) && PRACTICE_SLUG_PATTERN.test(slug)
  const available: boolean | null = !addressEdited
    ? null
    : !addressValid
      ? false
      : checked && checked.prefix === prefix && checked.slug === slug
        ? checked.available
        : null

  // Live availability check of an edited address (debounced; state is set only in the callback)
  useEffect(() => {
    if (!data || !addressEdited || !addressValid) return
    const timer = setTimeout(async () => {
      const ok = await checkPracticeAddressAction(prefix, slug, data.module.id)
      setChecked({ prefix, slug, available: ok })
    }, 400)
    return () => clearTimeout(timer)
  }, [prefix, slug, data, addressEdited, addressValid])

  const moduleUrl = (p = prefix, s = slug) => getShareUrl(p, PRACTICE_ROUTE_SEGMENT, s)

  const groupsWithPages = useMemo(() => {
    if (!data) return []
    const bySlug = new Map(data.pages.map((p) => [p.slug, p]))
    const listed = new Set<string>()
    const groups = data.module.groups.map((g) => ({
      title: g.title,
      pages: g.pages.map((s) => {
        listed.add(s)
        return bySlug.get(s)
      }).filter((p): p is PracticeAdminData["pages"][number] => !!p),
    }))
    const rest = data.pages.filter((p) => !listed.has(p.slug))
    if (rest.length > 0) groups.push({ title: PRACTICE_UNGROUPED_LABEL, pages: rest })
    return groups.filter((g) => g.pages.length > 0)
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Načítání…
      </div>
    )
  }
  if (!data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  const saveAddress = async () => {
    setSavingAddress(true)
    const result = await updatePracticeModuleAction(subjectId, { addressPrefix: prefix, slug })
    setSavingAddress(false)
    if (result.error) setError(result.error.message)
    else await load()
  }

  const setPrimaryNote = async (value: string) => {
    const result = await updatePracticeModuleAction(subjectId, { primaryNoteId: value === NO_NOTE ? null : value })
    if (result.error) setError(result.error.message)
    else await load()
  }

  const pickFiles = async (list: FileList | null) => {
    if (!list) return
    const picked = await Promise.all(
      [...list].map(async (file) => {
        const html = await file.text()
        return { file, html, slug: slugFromHtml(html, file.name), status: "ready" as const }
      })
    )
    setFiles(picked)
  }

  const upload = async () => {
    setUploading(true)
    setError(null)
    const target = group === NEW_GROUP
      ? { newTitle: newGroupTitle }
      : group.startsWith(GROUP_PREFIX)
        ? { key: group.slice(GROUP_PREFIX.length) }
        : {}
    // Results are matched by File object, never by position, so they can't land on another row
    const batch = files.filter((f) => f.status !== "done")
    for (const item of batch) {
      setFiles((current) => current.map((f) => (f.file === item.file ? { ...f, status: "uploading" } : f)))
      const result = await importPracticePageAction(subjectId, item.slug, item.html, target)
      setFiles((current) =>
        current.map((f) => {
          if (f.file !== item.file) return f
          if (result.error) {
            const details = "details" in result.error && result.error.details ? ` ${result.error.details.slice(0, 3).join(" ")}` : ""
            return { ...f, status: "error", message: `${result.error.message}${details}` }
          }
          const info = result.data!
          const what = info.created ? "Přidáno" : info.changed ? "Aktualizováno" : "Beze změny"
          const warnings = info.warnings.length > 0 ? ` (${info.warnings.length} ${czPlural(info.warnings.length, "upozornění", "upozornění", "upozornění")})` : ""
          return { ...f, status: "done", message: `${what}: ${info.examples} ${czPlural(info.examples, "příklad", "příklady", "příkladů")}${warnings}` }
        })
      )
    }
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ""
    await load()
  }

  const copyLink = async (pageSlug: string) => {
    await navigator.clipboard.writeText(getShareUrl(data.module.addressPrefix, PRACTICE_ROUTE_SEGMENT, data.module.slug, pageSlug))
    setCopied(pageSlug)
    setTimeout(() => setCopied(null), 1500)
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    const result = await deletePracticePageAction(subjectId, toDelete.slug)
    setToDelete(null)
    if (result.error) setError(result.error.message)
    else await load()
  }

  const addressChanged = addressEdited

  return (
    <div className="space-y-6 p-1">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="practice-prefix">Adresa</Label>
            <div className="flex items-center gap-1.5">
              <Input id="practice-prefix" className="w-36" value={prefix} onChange={(e) => setPrefix(cleanSlugInput(e.target.value))} aria-label="Část adresy za studiem" />
              <span className="text-muted-foreground">/{PRACTICE_ROUTE_SEGMENT}/</span>
              <Input id="practice-slug" className="w-36" value={slug} onChange={(e) => setSlug(cleanSlugInput(e.target.value))} aria-label="Adresa procvičování" />
            </div>
          </div>
          <Button
            size="sm"
            disabled={!addressChanged || available === false || savingAddress}
            onClick={saveAddress}
            className="bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800"
          >
            {savingAddress ? "Ukládání…" : "Uložit adresu"}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={moduleUrl(data.module.addressPrefix, data.module.slug)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-4 w-4" />
              Otevřít přehled
            </a>
          </Button>
        </div>
        <p className="rounded-md bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground break-all">{moduleUrl()}</p>
        {addressChanged && available === false && <p className="text-sm text-red-600 dark:text-red-400">Adresa je obsazená nebo neplatná.</p>}
        {addressChanged && available && <p className="text-sm text-amber-700 dark:text-amber-300">Dosavadní odkazy přestanou fungovat.</p>}

        <div className="space-y-1">
          <Label htmlFor="practice-note">Studijní zápis</Label>
          <Select value={data.module.primaryNoteId ?? NO_NOTE} onValueChange={setPrimaryNote}>
            <SelectTrigger id="practice-note" className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_NOTE}>Bez zápisu</SelectItem>
              {data.notes.map((note) => (
                <SelectItem key={note.id} value={note.id}>
                  {note.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h3 className="font-semibold text-foreground">Nahrát stránky</h3>
        <Input
          ref={fileInput}
          type="file"
          accept=".html,.htm,text/html"
          multiple
          disabled={uploading}
          onChange={(e) => pickFiles(e.target.files)}
          aria-label="Soubory HTML"
        />
        {files.length > 0 && (
          <>
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li key={f.file.name} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-foreground">{f.file.name}</span>
                  <Input
                    className="h-8 w-40"
                    value={f.slug}
                    disabled={uploading || f.status === "done"}
                    onChange={(e) => {
                      const value = cleanSlugInput(e.target.value)
                      setFiles((current) => current.map((x, k) => (k === i ? { ...x, slug: value } : x)))
                    }}
                    aria-label={`Adresa stránky ${f.file.name}`}
                  />
                  {f.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {f.message && (
                    <span className={f.status === "error" ? "w-full text-red-600 dark:text-red-400" : "w-full text-green-700 dark:text-green-300"}>{f.message}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="practice-group">Skupina</Label>
                <Select value={group} onValueChange={setGroup}>
                  <SelectTrigger id="practice-group" className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_GROUP}>Ponechat</SelectItem>
                    {data.module.groups.map((g) => (
                      <SelectItem key={g.key} value={`${GROUP_PREFIX}${g.key}`}>
                        {g.title}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_GROUP}>Nová skupina…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {group === NEW_GROUP && (
                <div className="space-y-1">
                  <Label htmlFor="practice-new-group">Název skupiny *</Label>
                  <Input id="practice-new-group" className="w-64" value={newGroupTitle} onChange={(e) => setNewGroupTitle(e.target.value)} />
                </div>
              )}
              <Button
                size="sm"
                onClick={upload}
                disabled={uploading || files.every((f) => f.status === "done") || (group === NEW_GROUP && !newGroupTitle.trim()) || files.some((f) => !PRACTICE_SLUG_PATTERN.test(f.slug))}
                className="bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800"
              >
                <Upload className="mr-1.5 h-4 w-4" />
                {uploading ? "Nahrávání…" : "Nahrát"}
              </Button>
            </div>
          </>
        )}
      </section>

      <section className="space-y-4">
        {groupsWithPages.length === 0 && <p className="text-sm text-muted-foreground">Zatím žádné stránky.</p>}
        {groupsWithPages.map((g) => (
          <div key={g.title} className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground/80">{g.title}</h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {g.pages.map((page) => (
                <li key={page.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">{page.title}</span>{" "}
                    <span className="text-muted-foreground">
                      · {page.examples} {czPlural(page.examples, "příklad", "příklady", "příkladů")}
                      {page.done > 0 && ` · ${page.done} prošlých`}
                    </span>
                  </span>
                  <Button size="icon" variant="ghost" asChild aria-label={`Otevřít ${page.title}`}>
                    <a href={getShareUrl(data.module.addressPrefix, PRACTICE_ROUTE_SEGMENT, data.module.slug, page.slug)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => copyLink(page.slug)} aria-label={`Kopírovat odkaz na ${page.title}`}>
                    {copied === page.slug ? <Check className="h-4 w-4 text-green-600 dark:text-green-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setToDelete({ slug: page.slug, title: page.title })}
                    aria-label={`Smazat ${page.title}`}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat stránku?</AlertDialogTitle>
            <AlertDialogDescription>Stránka „{toDelete?.title}“ se trvale smaže i s postupem.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
