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
import { FileText, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getMaterialCategoryOptions } from "@/lib/constants"
import type { OneDriveFile, MaterialFormData } from "@/lib/types/materials"
import { OneDriveFilePicker } from "@/components/onedrive-file-picker"

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

  const handleOpenFilePicker = () => {
    setShowFilePicker(true)
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


  const truncateFileName = (fileName: string, maxLength: number = 40): string => {
    if (fileName.length <= maxLength) return fileName
    
    const dotIndex = fileName.lastIndexOf('.')
    if (dotIndex === -1) {
      // No extension, just truncate
      return `${fileName.substring(0, maxLength - 3)  }...`
    }
    
    const extension = fileName.substring(dotIndex)
    const nameWithoutExt = fileName.substring(0, dotIndex)
    const availableLength = maxLength - extension.length - 3 // 3 for "..."
    
    if (availableLength <= 0) {
      // Extension is too long, just show the beginning
      return `${fileName.substring(0, maxLength - 3)  }...`
    }
    
    return `${nameWithoutExt.substring(0, availableLength)  }...${  extension}`
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
            <OneDriveFilePicker
              onFileSelected={handleFileSelected}
              initialPath={studyMaterialSettings.materials_root_folder_path || "/drive/root:"}
              initialPathName={studyMaterialSettings.materials_root_folder_name || "OneDrive"}
            />
          ) : !selectedFile ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <p className="text-sm text-gray-600 mb-4">
                Vyberte soubor z vašeho OneDrive
              </p>
              <Button
                onClick={handleOpenFilePicker}
                disabled={loading}
                className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
              >
                {loading ? "Načítání..." : "Vybrat z OneDrive"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-primary-50 rounded-lg p-4 flex items-center gap-3">
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
                  className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
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
                className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
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