"use client"

import React, { useState, useEffect, useCallback } from "react"
import { checkSlugAvailability, updateStudy } from "@/lib/actions/studies"
import { createSlug, cleanSlugInput } from "@/lib/utils/slug"
import { getShareUrl } from "@/lib/utils/share-url"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Copy, ExternalLink, Check, Folder } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TitlePageFooter } from "@/components/title-page-footer"
import { FolderPicker } from "./folder-picker"
import { RESERVED_ROUTES } from "@/lib/constants"
import type { MaterialsRootFolder } from "@/lib/types/onedrive"

interface Study {
  id: string
  name: string
  is_public?: boolean
  public_slug?: string
  public_description?: string
  materials_root_folder_id?: string
  materials_root_folder_name?: string
  materials_root_folder_path?: string
}

interface StudySettingsProps {
  study: Study
  onClose: () => void
  onSuccess: () => void
}

export function StudySettings({ study, onClose, onSuccess }: StudySettingsProps) {
  const [isPublic, setIsPublic] = useState(study.is_public || false)
  const [slug, setSlug] = useState(study.public_slug || "")
  const [description, setDescription] = useState(study.public_description || "")
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  
  // Materials folder settings
  const [materialsRootFolder, setMaterialsRootFolder] = useState<MaterialsRootFolder>({
    id: study.materials_root_folder_id || null,
    name: study.materials_root_folder_name || "OneDrive",
    path: study.materials_root_folder_path || "/drive/root:"
  })
  const [showFolderPicker, setShowFolderPicker] = useState(false)

  const publicUrl = getShareUrl(slug)

  useEffect(() => {
    if (!slug) {
      // Generate initial slug from study name
      const initialSlug = createSlug(study.name)
      setSlug(initialSlug)
    }
  }, [study.name, slug])

  const checkSlug = useCallback(async () => {
    if (!slug || slug === study.public_slug) {
      setSlugAvailable(true)
      return
    }

    // Check if slug is a reserved route
    if (RESERVED_ROUTES.includes(slug.toLowerCase())) {
      setSlugAvailable(false)
      return
    }

    const available = await checkSlugAvailability(slug, study.id)
    setSlugAvailable(available)
  }, [slug, study.id, study.public_slug])

  useEffect(() => {
    if (slug && slug.length >= 3) {
      checkSlug()
    }
  }, [slug, checkSlug])

  const handleSlugChange = (value: string) => {
    const cleanSlug = cleanSlugInput(value)
    setSlug(cleanSlug)
  }

  const copyUrl = async () => {
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFolderSelect = (folder: MaterialsRootFolder) => {
    setMaterialsRootFolder(folder)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isPublic && (!slug || slugAvailable === false)) {
        throw new Error("Zadejte platnou a volnou adresu.")
      }

      await updateStudy(study.id, {
        is_public: isPublic,
        public_slug: isPublic ? slug : null,
        public_description: isPublic ? description : null,
        materials_root_folder_id: materialsRootFolder.id,
        materials_root_folder_name: materialsRootFolder.name,
        materials_root_folder_path: materialsRootFolder.path,
      })

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se uložit nastavení.")
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-950 dark:to-background p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Zpět">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="text-2xl font-bold text-foreground">Nastavení sdílení</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Public Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Veřejně dostupné</Label>
                  <p className="text-sm text-muted-foreground">Studium uvidí kdokoli s odkazem, bez přihlášení.</p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>

              {isPublic && (
                <>
                  {/* Slug Input */}
                  <div className="space-y-2">
                    <Label htmlFor="slug">Adresa *</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{window.location.origin}/</span>
                      <Input
                        id="slug"
                        value={slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        placeholder="moje-informatika"
                        className={
                          slugAvailable === false ? "border-red-500" : slugAvailable === true ? "border-green-500" : ""
                        }
                        required
                      />
                    </div>
                    {slugAvailable === false && (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {RESERVED_ROUTES.includes(slug.toLowerCase()) 
                          ? "Tuto adresu nelze použít"
                          : "Adresa je už obsazená"}
                      </p>
                    )}
                    {slugAvailable === true && slug && <p className="text-sm text-green-600 dark:text-green-400">Adresa je volná</p>}
                    <p className="text-xs text-muted-foreground">Písmena, číslice, pomlčky a podtržítka, 3–50 znaků.</p>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Veřejný popis</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Krátký popis pro návštěvníky…"
                      rows={3}
                    />
                  </div>

                  {/* URL Preview */}
                  {slug && slugAvailable && (
                    <div className="p-4 bg-primary-50 dark:bg-primary-950 rounded-lg border border-primary-200 dark:border-primary-800">
                      <Label className="text-sm font-medium text-primary-900 dark:text-primary-100">Veřejná adresa</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <code className="flex-1 p-2 bg-card rounded border text-sm">{publicUrl}</code>
                        <Button type="button" variant="outline" size="sm" onClick={copyUrl} aria-label={copied ? "Zkopírováno" : "Kopírovat odkaz"}>
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button type="button" variant="outline" size="sm" asChild>
                          <a href={publicUrl} target="_blank" rel="noopener noreferrer" aria-label="Otevřít veřejnou stránku">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Privacy Notice */}
                  <Alert>
                    <AlertDescription>
                      Veřejná stránka ukazuje předměty, výsledky a publikované materiály a zápisy. Osobní údaje na ní nejsou.
                    </AlertDescription>
                  </Alert>
                </>
              )}

              {/* Materials Section */}
              <div className="space-y-4 pt-6 border-t">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Materiály</h3>
                </div>
                
                <div className="space-y-2">
                  <Label>Kořenová složka materiálů</Label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 p-3 bg-primary-50 dark:bg-primary-950 rounded-lg flex items-center gap-2">
                      <Folder className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      <span className="text-sm font-medium">{materialsRootFolder.name}</span>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setShowFolderPicker(true)}
                      variant="outline"
                      className="text-primary-600 border-primary-200 hover:bg-primary-50 dark:text-primary-400 dark:border-primary-800 dark:hover:bg-primary-900/40"
                    >
                      Změnit složku
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Výběr souboru z OneDrive se otevře v této složce.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={loading || (isPublic && slugAvailable === false)}
                  className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
                >
                  {loading ? "Ukládání…" : "Uložit"}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Zrušit
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <TitlePageFooter />

      {/* Folder Picker Dialog */}
      <FolderPicker
        open={showFolderPicker}
        onOpenChange={setShowFolderPicker}
        onFolderSelect={handleFolderSelect}
      />
    </div>
  )
}
