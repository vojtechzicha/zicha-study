"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createMarkdownNote } from "@/lib/actions/markdown-notes"
import {
  checkStudyNoteSlug, linkSubjectToNoteAction, linkFinalExamToNoteAction,
} from "@/lib/actions/study-notes"
import { createSlug, cleanSlugInput } from "@/lib/utils/slug"
import { getShareUrl } from "@/lib/utils/share-url"

interface AddMarkdownNoteDialogProps {
  studyId: string
  subjectId: string
  isFinalExam?: boolean
  studySlug?: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddMarkdownNoteDialog({
  studyId, subjectId, isFinalExam = false, studySlug, isOpen, onClose, onSuccess,
}: AddMarkdownNoteDialogProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setName("")
      setDescription("")
      setIsPublic(false)
      setSlug("")
      setSlugTouched(false)
      setAvailable(null)
      setError(null)
    }
  }, [isOpen])

  // Derive slug from the name until the user edits the slug field directly.
  useEffect(() => {
    if (!slugTouched) setSlug(createSlug(name))
  }, [name, slugTouched])

  const checkSlug = async (value: string) => {
    if (!value || value.length < 3) {
      setAvailable(null)
      return
    }
    setAvailable(await checkStudyNoteSlug(value, studyId))
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Zadejte název zápisu")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await createMarkdownNote({
        studyId,
        name: name.trim(),
        description: description.trim() || null,
        isPublic,
        publicSlug: isPublic ? slug : null,
      })
      if (res.error || !res.data) throw new Error(res.error?.message || "Nepodařilo se vytvořit zápis")

      const newId = res.data.id
      if (isFinalExam) {
        await linkFinalExamToNoteAction(newId, subjectId, true)
      } else {
        await linkSubjectToNoteAction(newId, subjectId, true)
      }

      onSuccess()
      onClose()
      router.push(`/studies/${studyId}/notes/${newId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se vytvořit zápis")
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nový Markdown zápis</DialogTitle>
          <DialogDescription>
            Vytvořte zápis psaný přímo v aplikaci (bez Wordu na OneDrive).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="md-name">Název *</Label>
            <Input
              id="md-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Např. Kapitola 1 – Úvod"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="md-desc">Popis</Label>
            <Textarea
              id="md-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Volitelný popis"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="md-pub">Publikovat ihned</Label>
              <p className="text-sm text-gray-500">Zpřístupnit přes veřejný odkaz</p>
            </div>
            <Switch id="md-pub" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          {isPublic && (
            <div className="space-y-2">
              <Label htmlFor="md-add-slug">URL adresa *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{getShareUrl(studySlug || "study-slug")}/</span>
                <Input
                  id="md-add-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    const clean = cleanSlugInput(e.target.value)
                    setSlug(clean)
                    checkSlug(clean)
                  }}
                  placeholder="nazev-zapisu"
                  className={available === false ? "border-red-500" : available === true ? "border-green-500" : ""}
                />
              </div>
              {slug && slug.length >= 3 ? (
                available === false ? (
                  <p className="text-sm text-red-600">Tato URL adresa již není dostupná</p>
                ) : available === true ? (
                  <p className="text-sm text-green-600">URL adresa je dostupná</p>
                ) : (
                  <p className="text-sm text-gray-500">Kontroluje se dostupnost…</p>
                )
              ) : (
                <p className="text-sm text-gray-500">Pouze písmena, čísla, pomlčky a podtržítka. 3-50 znaků.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Zrušit
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading || !name.trim() || (isPublic && (slug.length < 3 || available === false))}
            className="bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800"
          >
            {loading ? "Vytváření…" : "Vytvořit a otevřít"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
