"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, ExternalLink, MoreVertical, Trash2, Globe, Copy, Check, Eye, Link, Unlink } from "lucide-react"
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { StudyNote, StudyNoteWithSubjects } from "@/lib/types/study-notes"
import { StudyNoteLinkSubjectsDialog } from "@/components/study-note-link-subjects-dialog"

interface StudyNoteCardProps {
  note: StudyNoteWithSubjects
  onDelete?: (id: string) => void
  onUpdate?: () => void
  studySlug?: string
  isStudyPublic?: boolean
  currentSubjectId?: string
}

export function StudyNoteCard({ note, onDelete, onUpdate, studySlug, isStudyPublic, currentSubjectId }: StudyNoteCardProps) {
  const [showPublicDialog, setShowPublicDialog] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [isPublic, setIsPublic] = useState(note.is_public)
  const [publicSlug, setPublicSlug] = useState(note.public_slug)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [copied, setCopied] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  // Reset state when dialog opens
  useEffect(() => {
    if (showPublicDialog) {
      setIsPublic(note.is_public)
      setPublicSlug(note.public_slug || "")
      setError(null)
      // If the note already has a public slug, it's valid since it's the current one
      if (note.is_public && note.public_slug) {
        setSlugAvailable(true)
      } else {
        setSlugAvailable(null)
      }
    }
  }, [showPublicDialog, note.is_public, note.public_slug])

  const handleOpenInOneDrive = () => {
    window.open(note.onedrive_web_url, '_blank', 'noopener,noreferrer')
  }

  const handleDisplayNote = () => {
    if (studySlug) {
      window.open(`/${studySlug}/${note.public_slug}`, '_blank', 'noopener,noreferrer')
    } else {
      window.open(`/notes/${note.public_slug}`, '_blank', 'noopener,noreferrer')
    }
  }

  const handleCardClick = () => {
    handleDisplayNote()
  }

  const checkSlugAvailability = async (slug: string) => {
    if (!slug || slug === note.public_slug) {
      setSlugAvailable(true)
      return
    }

    const { data } = await supabase
      .from("study_notes")
      .select("id")
      .eq("public_slug", slug)
      .neq("id", note.id)
      .single()

    setSlugAvailable(!data)
  }

  const handleUpdatePublicSettings = async () => {
    setLoading(true)
    setError(null)

    try {
      // When disabling public access, clear the public_slug
      const updateData = {
        is_public: isPublic,
        public_slug: isPublic ? publicSlug : null,
      }

      const { error: updateError } = await supabase
        .from("study_notes")
        .update(updateData)
        .eq("id", note.id)

      if (updateError) throw updateError

      setShowPublicDialog(false)
      if (onUpdate) onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se aktualizovat nastavení")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Opravdu chcete smazat tuto studijní poznámku?")) return

    setLoading(true)
    try {
      const { error: deleteError } = await supabase
        .from("study_notes")
        .delete()
        .eq("id", note.id)

      if (deleteError) throw deleteError

      if (onDelete) onDelete(note.id)
    } catch (err) {
      console.error("Failed to delete study note:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    const url = studySlug 
      ? `${window.location.origin}/${studySlug}/${note.public_slug}`
      : `${window.location.origin}/notes/${note.public_slug}`
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
              <BookOpen className="h-8 w-8 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base mb-1 truncate">{note.name}</h3>
              {note.description && (
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">{note.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{formatFileSize(note.file_size)}</span>
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
              {/* Show subject info based on current context */}
              {note.subjects && note.subjects.length > 1 && (
                <div className="flex items-center gap-1 mt-2">
                  <Link className="h-3 w-3 text-gray-400" />
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const primarySubject = note.subjects.find(s => s.is_primary)
                      const isViewingPrimarySubject = primarySubject?.id === currentSubjectId
                      
                      if (isViewingPrimarySubject) {
                        // Viewing from primary subject - show linked subjects
                        return note.subjects
                          .filter(s => !s.is_primary)
                          .map(subject => (
                            <Badge key={subject.id} variant="outline" className="text-xs py-0 px-2">
                              {subject.name}
                            </Badge>
                          ))
                      } else {
                        // Viewing from linked subject - show primary subject
                        return primarySubject ? (
                          <Badge variant="outline" className="text-xs py-0 px-2">
                            {primarySubject.name}
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
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDisplayNote(); }}>
                  <Eye className="h-4 w-4 mr-2" />
                  Zobrazit zápis
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenInOneDrive(); }}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Otevřít DOCX v OneDrive
                </DropdownMenuItem>
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
                        Zkopírováno!
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
                  className="text-red-600"
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {isPublic ? "Nastavení sdílení studijního zápisu" : "Publikovat studijní zápis"}
            </DialogTitle>
            <DialogDescription>
              {isPublic 
                ? "Upravte nastavení veřejného sdílení tohoto studijního zápisu"
                : `Nastavte veřejný odkaz pro tento zápis. Bude dostupný na adrese /${studySlug || "study-slug"}/{publicSlug || "url-zapisu"}`
              }
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
                <Label htmlFor="public">Veřejně dostupné</Label>
                <p className="text-sm text-gray-500">
                  Povolit přístup k zápisu pomocí veřejného odkazu
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
                  <Label htmlFor="slug">URL adresa *</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{window.location.origin}/{studySlug || "study-slug"}/</span>
                    <Input
                      id="slug"
                      value={publicSlug}
                      onChange={(e) => {
                        const cleanSlug = e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-_]/g, "")
                          .slice(0, 50)
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
                  {/* Status Message - Always Visible */}
                  {publicSlug && publicSlug.length >= 3 ? (
                    slugAvailable === false ? (
                      <p className="text-sm text-red-600">Tato URL adresa již není dostupná pro toto studium</p>
                    ) : slugAvailable === true ? (
                      <p className="text-sm text-green-600">URL adresa je dostupná</p>
                    ) : (
                      <p className="text-sm text-gray-500">Kontroluje se dostupnost...</p>
                    )
                  ) : publicSlug && publicSlug.length > 0 ? (
                    <p className="text-sm text-orange-600">URL adresa musí mít alespoň 3 znaky</p>
                  ) : (
                    <p className="text-sm text-gray-500">Zadejte URL adresu</p>
                  )}
                  <p className="text-xs text-gray-500">Pouze písmena, čísla, pomlčky a podtržítka. 3-50 znaků.</p>
                </div>

                {/* URL Preview - Always Visible When Slug Exists */}
                {publicSlug && (
                  <div className={`p-4 rounded-lg border ${
                    slugAvailable === true ? 'bg-primary-50 border-primary-200' : 
                    slugAvailable === false ? 'bg-red-50 border-red-200' : 
                    'bg-primary-50 border-primary-200'
                  }`}>
                    <Label className={`text-sm font-medium ${
                      slugAvailable === true ? 'text-primary-900' : 
                      slugAvailable === false ? 'text-red-900' : 
                      'text-gray-700'
                    }`}>
                      Veřejná URL adresa:
                    </Label>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="flex-1 p-2 bg-white rounded border text-sm">
                        {window.location.origin}/{studySlug || "study-slug"}/{publicSlug}
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
              {loading ? (isPublic ? "Publikování..." : "Ukládání...") : (isPublic ? "Publikovat" : "Uložit")}
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