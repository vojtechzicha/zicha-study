"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, ExternalLink, MoreVertical, Trash2, Globe, Copy, Check, Eye, Link, Pencil, FileText, NotebookPen } from "lucide-react"
import { useRouter } from "next/navigation"
import { NOTE_TYPES, getNoteType } from "@/lib/constants"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useState, useEffect } from "react"
import {
  updateStudyNoteAction,
  deleteStudyNoteAction,
  checkNoteSlugGlobal,
} from "@/lib/actions/study-notes"
import type { StudyNoteWithSubjects } from "@/lib/types/study-notes"
import { StudyNoteLinkSubjectsDialog } from "@/components/study-note-link-subjects-dialog"
import { cleanSlugInput } from "@/lib/utils/slug"
import { getShareUrl } from "@/lib/utils/share-url"

interface StudyNoteCardProps {
  note: StudyNoteWithSubjects
  onDelete?: (_id: string) => void
  onUpdate?: () => void
  studySlug?: string
  isStudyPublic?: boolean
  currentSubjectId?: string
  isFinalExam?: boolean
  /** Tag shown next to final-exam links (e.g. "SZZ" / "Maturita"). */
  finalExamBadge?: string
}

export function StudyNoteCard({ note, onDelete, onUpdate, studySlug, isStudyPublic: _isStudyPublic, currentSubjectId, finalExamBadge = "SZZ" }: StudyNoteCardProps) {
  const router = useRouter()
  const isMarkdown = getNoteType(note) === NOTE_TYPES.MARKDOWN
  const isObsidian = getNoteType(note) === NOTE_TYPES.OBSIDIAN
  const [showPublicDialog, setShowPublicDialog] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [isPublic, setIsPublic] = useState(note.is_public)
  const [publicSlug, setPublicSlug] = useState(note.public_slug)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (showPublicDialog) {
      setIsPublic(note.is_public)
      setPublicSlug(note.public_slug || "")
      setError(null)
      // The note's own current slug counts as available
      if (note.is_public && note.public_slug) {
        setSlugAvailable(true)
      } else {
        setSlugAvailable(null)
      }
    }
  }, [showPublicDialog, note.is_public, note.public_slug])

  const handleOpenInOneDrive = () => {
    if (note.onedrive_web_url) {
      window.open(note.onedrive_web_url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleDisplayNote = () => {
    if (studySlug) {
      window.open(`/${studySlug}/${note.public_slug}`, '_blank', 'noopener,noreferrer')
    } else {
      window.open(`/notes/${note.public_slug}`, '_blank', 'noopener,noreferrer')
    }
  }

  const openEditor = () => {
    router.push(`/studies/${note.study_id}/notes/${note.id}`)
  }

  const handleCardClick = () => {
    if (isMarkdown) {
      openEditor()
    } else {
      handleDisplayNote()
    }
  }

  const checkSlugAvailability = async (slug: string) => {
    if (!slug || slug === note.public_slug) {
      setSlugAvailable(true)
      return
    }

    const available = await checkNoteSlugGlobal(slug, note.id)
    setSlugAvailable(available)
  }

  const handleUpdatePublicSettings = async () => {
    setLoading(true)
    setError(null)

    try {
      const updateData = {
        is_public: isPublic,
        public_slug: isPublic ? publicSlug : null,
      }

      const result = await updateStudyNoteAction(note.id, updateData)

      if (result.error) throw new Error(result.error.message)

      setShowPublicDialog(false)
      if (onUpdate) onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se uložit nastavení sdílení.")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Smazat tento zápis?")) return

    setLoading(true)
    try {
      const result = await deleteStudyNoteAction(note.id)

      if (result.error) throw new Error(result.error.message)

      if (onDelete) onDelete(note.id)
    } catch (err) {
      console.error("Failed to delete study note:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    const url = studySlug
      ? getShareUrl(studySlug, note.public_slug)
      : getShareUrl("notes", note.public_slug)
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return ""
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  return (
    <>
      <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={handleCardClick}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {isMarkdown ? (
                <FileText className="h-8 w-8 text-primary-600 dark:text-primary-400" />
              ) : isObsidian ? (
                <NotebookPen className="h-8 w-8 text-primary-600 dark:text-primary-400" />
              ) : (
                <BookOpen className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base mb-1 truncate">{note.name}</h3>
              {note.description && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{note.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{formatFileSize(note.file_size ?? null)}</span>
                <span>
                  {new Date(note.created_at).toLocaleDateString("cs-CZ")}
                </span>
                {note.is_public && (
                  <Badge variant="secondary" className="text-xs">
                    <Globe className="h-3 w-3 mr-1" />
                    Veřejné
                  </Badge>
                )}
              </div>
              {note.subjects && note.subjects.length > 1 && (
                <div className="flex items-center gap-1 mt-2">
                  <Link className="h-3 w-3 text-muted-foreground/70" />
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const primaryItem = note.subjects!.find(s => s.is_primary)
                      const isViewingPrimaryItem = primaryItem?.id === currentSubjectId

                      if (isViewingPrimaryItem) {
                        return note.subjects!
                          .filter(s => !s.is_primary)
                          .map(item => (
                            <Badge key={item.id} variant="outline" className="text-xs py-0 px-2">
                              {item.name}
                              {item.is_final_exam && <span className="ml-1 text-muted-foreground">({finalExamBadge})</span>}
                            </Badge>
                          ))
                      } else {
                        return primaryItem ? (
                          <Badge variant="outline" className="text-xs py-0 px-2">
                            {primaryItem.name}
                            {primaryItem.is_final_exam && <span className="ml-1 text-muted-foreground">({finalExamBadge})</span>}
                          </Badge>
                        ) : null
                      }
                    })()}
                  </div>
                </div>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Další akce"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isMarkdown ? (
                  <>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditor(); }}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Otevřít editor
                    </DropdownMenuItem>
                    {note.is_public && note.public_slug && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDisplayNote(); }}>
                        <Eye className="h-4 w-4 mr-2" />
                        Zobrazit veřejně
                      </DropdownMenuItem>
                    )}
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDisplayNote(); }}>
                      <Eye className="h-4 w-4 mr-2" />
                      Zobrazit zápis
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenInOneDrive(); }}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Otevřít v OneDrive
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowPublicDialog(true); }}>
                  <Globe className="h-4 w-4 mr-2" />
                  Nastavení sdílení
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowLinkDialog(true); }}>
                  <Link className="h-4 w-4 mr-2" />
                  Propojit s předměty
                </DropdownMenuItem>
                {note.is_public && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyLink(); }}>
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Zkopírováno
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Kopírovat odkaz
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  className="text-red-600 dark:text-red-400"
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Smazat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPublicDialog} onOpenChange={setShowPublicDialog}>
        <DialogContent className="sm:max-w-[500px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {isPublic ? "Nastavení sdílení zápisu" : "Publikovat zápis"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="public">Veřejně dostupné</Label>
                <p className="text-sm text-muted-foreground">
                  Uvidí ho kdokoli s odkazem.
                </p>
              </div>
              <Switch
                id="public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>

            {isPublic && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="slug">Adresa *</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{getShareUrl(studySlug || "studium")}/</span>
                    <Input
                      id="slug"
                      value={publicSlug ?? ""}
                      onChange={(e) => {
                        const cleanSlug = cleanSlugInput(e.target.value)
                        setPublicSlug(cleanSlug)
                        if (cleanSlug && cleanSlug.length >= 3) {
                          checkSlugAvailability(cleanSlug)
                        } else {
                          setSlugAvailable(null)
                        }
                      }}
                      placeholder="nazev-zapisu"
                      className={
                        slugAvailable === false ? "border-red-500" : slugAvailable === true ? "border-green-500" : ""
                      }
                      required
                    />
                  </div>
                  {publicSlug && publicSlug.length >= 3 ? (
                    slugAvailable === false ? (
                      <p className="text-sm text-red-600 dark:text-red-400">Adresa je už obsazená</p>
                    ) : slugAvailable === true ? (
                      <p className="text-sm text-green-600 dark:text-green-400">Adresa je volná</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Kontrola dostupnosti…</p>
                    )
                  ) : publicSlug && publicSlug.length > 0 ? (
                    <p className="text-sm text-orange-600 dark:text-orange-400">Adresa musí mít aspoň 3 znaky</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Zadejte adresu</p>
                  )}
                  <p className="text-xs text-muted-foreground">Písmena, číslice, pomlčky a podtržítka, 3–50 znaků.</p>
                </div>

                {publicSlug && (
                  <div className={`p-4 rounded-lg border ${
                    slugAvailable === true ? 'bg-primary-50 border-primary-200 dark:bg-primary-950 dark:border-primary-800' :
                    slugAvailable === false ? 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800' :
                    'bg-primary-50 border-primary-200 dark:bg-primary-950 dark:border-primary-800'
                  }`}>
                    <Label className={`text-sm font-medium ${
                      slugAvailable === true ? 'text-primary-900 dark:text-primary-100' :
                      slugAvailable === false ? 'text-red-900 dark:text-red-200' :
                      'text-foreground/80'
                    }`}>
                      Veřejná adresa
                    </Label>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="flex-1 p-2 bg-card rounded border text-sm">
                        {getShareUrl(studySlug || "studium", publicSlug)}
                      </code>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPublicDialog(false)} disabled={loading}>
              Zrušit
            </Button>
            <Button
              onClick={handleUpdatePublicSettings}
              disabled={loading || (isPublic && (!publicSlug || publicSlug.length < 3 || slugAvailable === false))}
              className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
            >
              {loading ? (isPublic ? "Publikování…" : "Ukládání…") : (isPublic ? "Publikovat" : "Uložit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <StudyNoteLinkSubjectsDialog
        note={note}
        isOpen={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        onUpdate={onUpdate || (() => {})}
      />
    </>
  )
}
