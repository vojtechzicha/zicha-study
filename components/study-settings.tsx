"use client"

import React, { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { createSlug, cleanSlugInput } from "@/lib/utils/slug"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Copy, ExternalLink, Check, Folder, ChevronRight } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  const [materialsRootFolder, setMaterialsRootFolder] = useState({
    id: study.materials_root_folder_id || null,
    name: study.materials_root_folder_name || "OneDrive",
    path: study.materials_root_folder_path || "/drive/root:"
  })
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [availableFolders, setAvailableFolders] = useState<any[]>([])
  const [folderPickerLoading, setFolderPickerLoading] = useState(false)
  const [folderPickerError, setFolderPickerError] = useState<string | null>(null)
  const [currentFolderPath, setCurrentFolderPath] = useState<string>("/drive/root:")
  const [folderPathHistory, setFolderPathHistory] = useState<Array<{name: string, path: string}>>([{name: "OneDrive", path: "/drive/root:"}])
  
  const supabase = createClient()

  // Reserved routes that should not be accessible as public study slugs
  const RESERVED_ROUTES = [
    'auth',
    'studies',
    'api',
    'admin',
    'dashboard',
    'settings',
    'profile',
    'help',
    'about',
    'contact',
    'terms',
    'privacy',
    'public'
  ]

  const publicUrl = `${window.location.origin}/${slug}`

  useEffect(() => {
    if (!slug) {
      // Generate initial slug from study name
      const initialSlug = createSlug(study.name)
      setSlug(initialSlug)
    }
  }, [study.name, slug])

  useEffect(() => {
    if (slug && slug.length >= 3) {
      checkSlugAvailability()
    }
  }, [slug])

  const checkSlugAvailability = async () => {
    if (!slug || slug === study.public_slug) {
      setSlugAvailable(true)
      return
    }

    // Check if slug is a reserved route
    if (RESERVED_ROUTES.includes(slug.toLowerCase())) {
      setSlugAvailable(false)
      return
    }

    const { data, error } = await supabase
      .from("studies")
      .select("id")
      .eq("public_slug", slug)
      .neq("id", study.id)
      .single()

    setSlugAvailable(!data)
  }

  const handleSlugChange = (value: string) => {
    const cleanSlug = cleanSlugInput(value)
    setSlug(cleanSlug)
  }

  const copyUrl = async () => {
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const loadFolders = async (path: string = "/drive/root:") => {
    setFolderPickerLoading(true)
    setFolderPickerError(null)
    
    try {
      const url = `/api/onedrive/files?path=${encodeURIComponent(path)}`
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        
        // Handle authentication errors that need re-authentication
        if (errorData.needsReauth) {
          throw new Error("Přístup k OneDrive vypršel. Prosím, přihlaste se znovu.")
        }
        
        throw new Error(errorData.error || "Nepodařilo se načíst složky z OneDrive")
      }

      const { files } = await response.json()
      // Filter only folders, plus add root option
      const folders = files.filter((item: any) => item.folder)
      
      // Add root folder option if we're at root level
      if (path === "/drive/root:") {
        folders.unshift({
          id: null,
          name: "OneDrive (kořenová složka)",
          folder: { childCount: 0 },
          isRoot: true
        })
      }
      
      setAvailableFolders(folders)
      setCurrentFolderPath(path)
    } catch (err) {
      setFolderPickerError(err instanceof Error ? err.message : "Nastala chyba při načítání složek")
    } finally {
      setFolderPickerLoading(false)
    }
  }

  const handleOpenFolderPicker = async () => {
    setShowFolderPicker(true)
    setCurrentFolderPath("/drive/root:")
    setFolderPathHistory([{name: "OneDrive", path: "/drive/root:"}])
    await loadFolders()
  }

  const handleFolderNavigation = async (folder: any) => {
    const newPath = `/drive/items/${folder.id}`
    const newPathHistory = [...folderPathHistory, { name: folder.name, path: newPath }]
    setFolderPathHistory(newPathHistory)
    await loadFolders(newPath)
  }

  const handleBreadcrumbNavigation = async (index: number) => {
    const newPathHistory = folderPathHistory.slice(0, index + 1)
    const targetPath = newPathHistory[newPathHistory.length - 1].path
    setFolderPathHistory(newPathHistory)
    await loadFolders(targetPath)
  }

  const handleFolderSelect = (folder: any) => {
    if (folder.isRoot) {
      setMaterialsRootFolder({
        id: null,
        name: "OneDrive",
        path: "/drive/root:"
      })
    } else {
      setMaterialsRootFolder({
        id: folder.id,
        name: folder.name,
        path: `/drive/items/${folder.id}`
      })
    }
    setShowFolderPicker(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    console.log("handleSubmit called")
    e.preventDefault()
    setLoading(true)
    setError(null)

    console.log("Form data:", { isPublic, slug, description, slugAvailable })

    try {
      if (isPublic && (!slug || slugAvailable === false)) {
        throw new Error("Zadejte platný a dostupný slug")
      }

      console.log("About to update database with:", {
        is_public: isPublic,
        public_slug: isPublic ? slug : null,
        public_description: isPublic ? description : null,
        study_id: study.id
      })

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

      console.log("Database update result:", { updateError })

      if (updateError) throw updateError

      console.log("Calling onSuccess")
      onSuccess()
    } catch (err) {
      console.error("Public sharing save error:", err)
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
                      onClick={handleOpenFolderPicker}
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
                <Button type="button" variant="outline" onClick={() => { console.log("Cancel clicked"); onClose(); }}>
                  Zrušit
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Folder Picker Dialog */}
      <Dialog open={showFolderPicker} onOpenChange={setShowFolderPicker}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Vyberte složku pro materiály</DialogTitle>
            <DialogDescription>
              Vyberte složku z vašeho OneDrive, která bude výchozí pro materiály tohoto studia
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {folderPickerError && (
              <Alert variant="destructive">
                <AlertDescription>{folderPickerError}</AlertDescription>
              </Alert>
            )}

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-1 text-sm text-gray-600 overflow-x-auto">
              {folderPathHistory.map((crumb, index) => (
                <div key={index} className="flex items-center gap-1">
                  <button
                    onClick={() => handleBreadcrumbNavigation(index)}
                    className="hover:text-primary-600 whitespace-nowrap"
                  >
                    {crumb.name}
                  </button>
                  {index < folderPathHistory.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-gray-400" />
                  )}
                </div>
              ))}
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {folderPickerLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-primary-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : availableFolders.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Žádné složky nebyly nalezeny</p>
              ) : (
                availableFolders.map((folder) => (
                  <div
                    key={folder.id || 'root'}
                    className="flex items-center gap-3 p-3 hover:bg-primary-50 cursor-pointer rounded border"
                  >
                    <Folder className="h-6 w-6 text-primary-600" />
                    <div 
                      className="flex-1 min-w-0"
                      onClick={() => handleFolderSelect(folder)}
                    >
                      <p className="font-medium truncate">{folder.name}</p>
                      <p className="text-sm text-gray-500">
                        {folder.folder.childCount} položek
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleFolderSelect(folder)}
                      >
                        Vybrat
                      </Button>
                      {!folder.isRoot && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFolderNavigation(folder)}
                          title="Procházet složku"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowFolderPicker(false)}>
              Zrušit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
