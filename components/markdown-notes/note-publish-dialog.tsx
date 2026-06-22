"use client"

import { useEffect, useState } from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updateStudyNoteAction, checkNoteSlugGlobal } from "@/lib/actions/study-notes"
import { cleanSlugInput } from "@/lib/utils/slug"
import { getShareUrl } from "@/lib/utils/share-url"

interface NotePublishDialogProps {
  noteId: string
  studySlug?: string
  isPublic: boolean
  publicSlug: string | null
  open: boolean
  onOpenChange: (_open: boolean) => void
  onSaved: (_next: { isPublic: boolean; publicSlug: string | null }) => void
}

export function NotePublishDialog({
  noteId, studySlug, isPublic, publicSlug, open, onOpenChange, onSaved,
}: NotePublishDialogProps) {
  const [pub, setPub] = useState(isPublic)
  const [slug, setSlug] = useState(publicSlug ?? "")
  const [available, setAvailable] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPub(isPublic)
      setSlug(publicSlug ?? "")
      setError(null)
      setAvailable(isPublic && publicSlug ? true : null)
    }
  }, [open, isPublic, publicSlug])

  const checkSlug = async (value: string) => {
    if (!value || value === publicSlug) {
      setAvailable(true)
      return
    }
    setAvailable(await checkNoteSlugGlobal(value, noteId))
  }

  const save = async () => {
    setLoading(true)
    setError(null)
    try {
      const updateData = { is_public: pub, public_slug: pub ? slug : null }
      const res = await updateStudyNoteAction(noteId, updateData)
      if (res.error) throw new Error(res.error.message)
      onSaved({ isPublic: pub, publicSlug: pub ? slug : null })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se uložit nastavení")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{pub ? "Nastavení sdílení" : "Publikovat zápis"}</DialogTitle>
          <DialogDescription>
            Nastavte veřejný odkaz pro tento zápis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="md-public">Veřejně dostupné</Label>
              <p className="text-sm text-gray-500">Povolit přístup pomocí veřejného odkazu</p>
            </div>
            <Switch id="md-public" checked={pub} onCheckedChange={setPub} />
          </div>

          {pub && (
            <>
              <div className="space-y-2">
                <Label htmlFor="md-slug">URL adresa *</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{getShareUrl(studySlug || "study-slug")}/</span>
                  <Input
                    id="md-slug"
                    value={slug}
                    onChange={(e) => {
                      const clean = cleanSlugInput(e.target.value)
                      setSlug(clean)
                      if (clean && clean.length >= 3) checkSlug(clean)
                      else setAvailable(null)
                    }}
                    placeholder="nazev-zapisu"
                    className={available === false ? "border-red-500" : available === true ? "border-green-500" : ""}
                    required
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
                ) : slug.length > 0 ? (
                  <p className="text-sm text-orange-600">URL adresa musí mít alespoň 3 znaky</p>
                ) : (
                  <p className="text-sm text-gray-500">Zadejte URL adresu</p>
                )}
                <p className="text-xs text-gray-500">Pouze písmena, čísla, pomlčky a podtržítka. 3-50 znaků.</p>
              </div>

              {slug && (
                <div className={`rounded-lg border p-4 ${available === false ? "border-red-200 bg-red-50" : "border-primary-200 bg-primary-50"}`}>
                  <Label className="text-sm font-medium text-gray-700">Veřejná URL adresa:</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 rounded border bg-white p-2 text-sm">
                      {getShareUrl(studySlug || "study-slug", slug)}
                    </code>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Zrušit
          </Button>
          <Button
            onClick={save}
            disabled={loading || (pub && (!slug || slug.length < 3 || available === false))}
            className="bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800"
          >
            {loading ? "Ukládání…" : pub ? "Publikovat" : "Uložit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
