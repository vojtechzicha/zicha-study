"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { FileText, AlertCircle, Search, X, Folder, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getMaterialCategoryOptions } from "@/lib/constants"
import type { OneDriveFile, MaterialFormData } from "@/lib/types/materials"

interface AddMaterialDialogProps {
  studyId: string
  subjectId?: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface StudyMaterialSettings {
  materials_root_folder_id?: string
  materials_root_folder_name?: string
  materials_root_folder_path?: string
}

export function AddMaterialDialog({
  studyId,
  subjectId,
  isOpen,
  onClose,
  onSuccess,
}: AddMaterialDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<OneDriveFile | null>(null)
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [availableFiles, setAvailableFiles] = useState<OneDriveFile[]>([])
  const [currentPath, setCurrentPath] = useState<string>("/drive/root:")
  const [pathHistory, setPathHistory] = useState<Array<{name: string, path: string}>>([{name: "OneDrive", path: "/drive/root:"}])
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [studyMaterialSettings, setStudyMaterialSettings] = useState<StudyMaterialSettings>({})
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [formData, setFormData] = useState<Partial<MaterialFormData>>({
    name: "",
    description: "",
    category: "",
  })
  const supabase = createClient()

  // Load study material settings when dialog opens
  useEffect(() => {
    if (isOpen && !settingsLoaded) {
      loadStudyMaterialSettings()
    }
  }, [isOpen, settingsLoaded, supabase])

  const loadStudyMaterialSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("studies")
        .select("materials_root_folder_id, materials_root_folder_name, materials_root_folder_path")
        .eq("id", studyId)
        .single()

      if (!error && data) {
        setStudyMaterialSettings(data)
        
        // Update initial path if study has a custom materials folder
        if (data.materials_root_folder_path) {
          const initialPath = data.materials_root_folder_path
          const initialName = data.materials_root_folder_name || "OneDrive"
          setCurrentPath(initialPath)
          setPathHistory([{name: initialName, path: initialPath}])
        }
      }
      setSettingsLoaded(true)
    } catch (err) {
      console.error("Failed to load study material settings:", err)
      setSettingsLoaded(true)
    }
  }

  const handleFileSelected = (file: OneDriveFile) => {
    setSelectedFile(file)
    setShowFilePicker(false)
    
    // Pre-fill the name with the file name without extension
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "")
    setFormData((prev) => ({ ...prev, name: prev.name || nameWithoutExt }))
  }

  const loadFiles = async (path: string = currentPath, search?: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const url = search 
        ? `/api/onedrive/files/search?q=${encodeURIComponent(search)}`
        : `/api/onedrive/files?path=${encodeURIComponent(path)}`
        
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const errorData = await response.json()
        
        // Handle authentication errors that need re-authentication
        if (errorData.needsReauth) {
          // Force re-authentication by signing in again
          const { createClient } = await import("@/lib/supabase/client")
          const supabase = createClient()
          
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "azure",
            options: {
              scopes: "openid email profile offline_access Files.Read Files.Read.All Files.ReadWrite",
              redirectTo: `${window.location.origin}/auth/callback`,
            },
          })
          
          if (error) {
            throw new Error("Nepodařilo se obnovit přístup k OneDrive. Zkuste to prosím znovu.")
          }
          return // Don't throw error, the redirect will handle the flow
        }
        
        throw new Error(errorData.error || "Nepodařilo se načíst soubory z OneDrive")
      }

      const { files } = await response.json()
      setAvailableFiles(files)
      
      if (search) {
        setIsSearching(true)
      } else {
        setIsSearching(false)
        setCurrentPath(path)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nastala chyba při načítání souborů")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenFilePicker = async () => {
    setShowFilePicker(true)
    
    // Use the study's materials folder path or default to root
    const startPath = studyMaterialSettings.materials_root_folder_path || "/drive/root:"
    await loadFiles(startPath)
  }

  const handleFolderClick = async (folder: OneDriveFile) => {
    const newPath = `/drive/items/${folder.id}`
    const newPathHistory = [...pathHistory, { name: folder.name, path: newPath }]
    setPathHistory(newPathHistory)
    await loadFiles(newPath)
  }

  const handleBreadcrumbClick = async (index: number) => {
    const newPathHistory = pathHistory.slice(0, index + 1)
    const targetPath = newPathHistory[newPathHistory.length - 1].path
    setPathHistory(newPathHistory)
    await loadFiles(targetPath)
  }

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await loadFiles(currentPath, searchQuery.trim())
    }
  }

  const handleClearSearch = async () => {
    setSearchQuery("")
    setIsSearching(false)
    await loadFiles(currentPath)
  }

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError("Nejprve vyberte soubor z OneDrive")
      return
    }

    if (!formData.name?.trim()) {
      setError("Název je povinný")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Uživatel není přihlášen")

      const fileExtension = selectedFile.name.split(".").pop()

      const materialData = {
        study_id: studyId,
        user_id: user.id,
        name: formData.name.trim(),
        file_name: selectedFile.name,
        file_extension: fileExtension ? `.${fileExtension}` : null,
        file_size: selectedFile.size || null,
        mime_type: selectedFile.file?.mimeType || null,
        onedrive_id: selectedFile.id,
        onedrive_web_url: selectedFile.webUrl,
        onedrive_download_url: selectedFile["@microsoft.graph.downloadUrl"] || null,
        parent_path: selectedFile.parentReference?.path || null,
        description: formData.description?.trim() || null,
        category: formData.category || null,
        last_modified_onedrive: selectedFile.lastModifiedDateTime,
      }

      const tableName = subjectId ? "subject_materials" : "materials"
      const insertData = subjectId 
        ? { ...materialData, subject_id: subjectId }
        : materialData

      const { error: insertError } = await supabase.from(tableName).insert(insertData)

      if (insertError) throw insertError

      onSuccess()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se přidat materiál")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setShowFilePicker(false)
    setAvailableFiles([])
    setCurrentPath("/drive/root:")
    setPathHistory([{name: "OneDrive", path: "/drive/root:"}])
    setSearchQuery("")
    setIsSearching(false)
    setStudyMaterialSettings({})
    setSettingsLoaded(false)
    setFormData({
      name: "",
      description: "",
      category: "",
    })
    setError(null)
    onClose()
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase()
    const iconClass = ext === "pdf" ? "text-red-600" : ext?.includes("doc") ? "text-blue-600" : "text-gray-600"
    return <FileText className={`h-6 w-6 ${iconClass}`} />
  }

  const formatFileSize = (bytes: number): string => {
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  const truncateFileName = (fileName: string, maxLength: number = 40): string => {
    if (fileName.length <= maxLength) return fileName
    
    const dotIndex = fileName.lastIndexOf('.')
    if (dotIndex === -1) {
      // No extension, just truncate
      return fileName.substring(0, maxLength - 3) + '...'
    }
    
    const extension = fileName.substring(dotIndex)
    const nameWithoutExt = fileName.substring(0, dotIndex)
    const availableLength = maxLength - extension.length - 3 // 3 for "..."
    
    if (availableLength <= 0) {
      // Extension is too long, just show the beginning
      return fileName.substring(0, maxLength - 3) + '...'
    }
    
    return nameWithoutExt.substring(0, availableLength) + '...' + extension
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {showFilePicker ? "Vyberte soubor z OneDrive" : `Přidat materiál ${subjectId ? "k předmětu" : "ke studiu"}`}
          </DialogTitle>
          <DialogDescription>
            {showFilePicker 
              ? "Klikněte na soubor, který chcete přidat"
              : `Vyberte soubor z vašeho OneDrive a přidejte ho ${subjectId ? "k předmětu" : "ke studiu"}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {showFilePicker ? (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Hledat soubory..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()}>
                  Hledat
                </Button>
                {isSearching && (
                  <Button variant="outline" onClick={handleClearSearch}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Breadcrumb Navigation */}
              {!isSearching && (
                <div className="flex items-center gap-1 text-sm text-gray-600 overflow-x-auto">
                  {pathHistory.map((crumb, index) => (
                    <div key={index} className="flex items-center gap-1">
                      <button
                        onClick={() => handleBreadcrumbClick(index)}
                        className="hover:text-blue-600 whitespace-nowrap"
                      >
                        {crumb.name}
                      </button>
                      {index < pathHistory.length - 1 && (
                        <ChevronRight className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* File/Folder List */}
              <div className="max-h-96 overflow-y-auto space-y-1">
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : availableFiles.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    {isSearching ? "Žádné soubory neodpovídají hledání" : "Žádné soubory nebyly nalezeny"}
                  </p>
                ) : (
                  availableFiles.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer rounded border"
                      onClick={() => item.folder ? handleFolderClick(item) : handleFileSelected(item)}
                    >
                      <div className="flex-shrink-0">
                        {item.folder ? (
                          <Folder className="h-6 w-6 text-blue-600" />
                        ) : (
                          getFileIcon(item.name)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="font-medium truncate cursor-help">
                                {item.folder ? item.name : truncateFileName(item.name)}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-sm break-words">{item.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <p className="text-sm text-gray-500">
                          {item.folder 
                            ? `${item.folder.childCount || 0} položek`
                            : item.size ? formatFileSize(item.size) : ''
                          }
                        </p>
                      </div>
                      {item.folder && (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : !selectedFile ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <p className="text-sm text-gray-600 mb-4">
                Vyberte soubor z vašeho OneDrive
              </p>
              <Button
                onClick={handleOpenFilePicker}
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                {loading ? "Načítání..." : "Vybrat z OneDrive"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-3">
                <FileText className="h-8 w-8 text-gray-600" />
                <div className="flex-1 min-w-0">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="font-medium text-sm truncate cursor-help">
                          {truncateFileName(selectedFile.name, 35)}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-sm break-words">{selectedFile.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <p className="text-xs text-gray-500">
                    {selectedFile.size ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB` : ""}
                  </p>
                </div>
                <Button
                  onClick={handleOpenFilePicker}
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                >
                  {loading ? "Načítání..." : "Změnit"}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Název *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Např. Přednáška 1 - Úvod"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Kategorie</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Vyberte kategorii" />
                  </SelectTrigger>
                  <SelectContent>
                    {getMaterialCategoryOptions().map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Popis</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Volitelný popis materiálu..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {showFilePicker ? (
            <Button variant="outline" onClick={() => setShowFilePicker(false)} disabled={loading}>
              Zpět
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Zrušit
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !selectedFile || !formData.name?.trim()}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                {loading ? "Přidávání..." : "Přidat materiál"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}