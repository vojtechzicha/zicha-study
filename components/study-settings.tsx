"use client"

import React, { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { createSlug, cleanSlugInput } from "@/lib/utils/slug"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Copy, ExternalLink, Check, Folder } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
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

  const supabase = createClient()

  const publicUrl = `${window.location.origin}/${slug}`

  useEffect(() => {
    if (!slug) {
      // Generate initial slug from study name
      const initialSlug = createSlug(study.name)
      setSlug(initialSlug)
    }
  }, [study.name, slug])

  const checkSlugAvailability = useCallback(async () => {
    if (!slug || slug === study.public_slug) {
      setSlugAvailable(true)
      return
    }

    // Check if slug is a reserved route
    if (RESERVED_ROUTES.includes(slug.toLowerCase())) {
      setSlugAvailable(false)
      return
    }

    const { data } = await supabase
      .from("studies")
      .select("id")
      .eq("public_slug", slug)
      .neq("id", study.id)
      .single()

    setSlugAvailable(!data)
  }, [slug, study.id, study.public_slug, supabase])

  useEffect(() => {
    if (slug && slug.length >= 3) {
      checkSlugAvailability()
    }
  }, [slug, checkSlugAvailability])

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
        throw new Error("Zadejte platný a dostupný slug")
      }

      const { error: updateError } = await supabase
        .from("studies")
        .update({
          is_public: isPublic,
          public_slug: isPublic ? slug : null,
          public_description: isPublic ? description : null,
          materials_root_folder_id: materialsRootFolder.id,
          materials_root_folder_name: materialsRootFolder.name,
          materials_root_folder_path: materialsRootFolder.path,
        })
        .eq("id", study.id)

      if (updateError) throw updateError

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nastala chyba při ukládání")
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900">Nastavení sdílení</CardTitle>
                <CardDescription className="text-gray-600">Spravujte veřejné sdílení vašeho studia</CardDescription>
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
                  <Label className="text-base font-medium">Veřejné sdílení</Label>
                  <p className="text-sm text-gray-600">Umožnit ostatním zobrazit vaše studium bez přihlášení</p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>

              {isPublic && (
                <>
                  {/* Slug Input */}
                  <div className="space-y-2">
                    <Label htmlFor="slug">URL adresa *</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{window.location.origin}/</span>
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
                      <p className="text-sm text-red-600">
                        {RESERVED_ROUTES.includes(slug.toLowerCase()) 
                          ? "Tato URL adresa je rezervována pro systémové funkce" 
                          : "Tato URL adresa již není dostupná"}
                      </p>
                    )}
                    {slugAvailable === true && slug && <p className="text-sm text-green-600">URL adresa je dostupná</p>}
                    <p className="text-xs text-gray-500">Pouze písmena, čísla, pomlčky a podtržítka. 3-50 znaků.</p>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Veřejný popis</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Krátký popis vašeho studia pro veřejnost..."
                      rows={3}
                    />
                  </div>

                  {/* URL Preview */}
                  {slug && slugAvailable && (
                    <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                      <Label className="text-sm font-medium text-primary-900">Veřejná URL adresa:</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <code className="flex-1 p-2 bg-white rounded border text-sm">{publicUrl}</code>
                        <Button type="button" variant="outline" size="sm" onClick={copyUrl}>
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button type="button" variant="outline" size="sm" asChild>
                          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Privacy Notice */}
                  <Alert>
                    <AlertDescription>
                      <strong>Upozornění:</strong> Veřejně sdílené studium bude dostupné všem bez přihlášení. Nebudou
                      zobrazeny žádné osobní údaje, pouze název studia, předměty a statistiky.
                    </AlertDescription>
                  </Alert>
                </>
              )}

              {/* Materials Section */}
              <div className="space-y-4 pt-6 border-t">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Materiály</h3>
                  <p className="text-sm text-gray-600">Nastavte výchozí složku pro ukládání materiálů ze studia</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Kořenová složka materiálů</Label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 p-3 bg-primary-50 rounded-lg flex items-center gap-2">
                      <Folder className="h-5 w-5 text-primary-600" />
                      <span className="text-sm font-medium">{materialsRootFolder.name}</span>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setShowFolderPicker(true)}
                      variant="outline"
                      className="text-primary-600 border-primary-200 hover:bg-primary-50"
                    >
                      Změnit složku
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Tato složka bude výchozí při přidávání nových materiálů ke studiu
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={loading || (isPublic && slugAvailable === false)}
                  className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
                >
                  {loading ? "Ukládání..." : "Uložit nastavení"}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Zrušit
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Folder Picker Dialog */}
      <FolderPicker
        open={showFolderPicker}
        onOpenChange={setShowFolderPicker}
        onFolderSelect={handleFolderSelect}
      />
    </div>
  )
}
