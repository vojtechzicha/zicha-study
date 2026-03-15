"use client"

import { useState, useEffect, useCallback } from "react"
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
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { FileText, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { OneDriveFile } from "@/lib/types/materials"
import type { StudyNoteFormData } from "@/lib/types/study-notes"
import { OneDriveFilePicker } from "@/components/onedrive-file-picker"
import { createSlug, cleanSlugInput } from "@/lib/utils/slug"

interface AddStudyNoteDialogProps {
  studyId: string
  subjectId: string
  isFinalExam?: boolean
  studySlug?: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface StudyMaterialSettings {
  materials_root_folder_id?: string
  materials_root_folder_name?: string
  materials_root_folder_path?: string
}

// Generate a unique slug for the study note
const generateUniqueSlug = () => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `note-${timestamp}-${random}`
}

export function AddStudyNoteDialog({
  studyId,
  subjectId,
  isFinalExam = false,
  studySlug,
  isOpen,
  onClose,
  onSuccess,
}: AddStudyNoteDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<OneDriveFile | null>(null)
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [studyMaterialSettings, setStudyMaterialSettings] = useState<StudyMaterialSettings>({})
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [formData, setFormData] = useState<Partial<StudyNoteFormData>>({
    name: "",
    description: "",
  })
  const [isPublic, setIsPublic] = useState(true)
  const [publicSlug, setPublicSlug] = useState("")
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const supabase = createClient()

  const loadStudyMaterialSettings = useCallback(async () => {
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
  }, [studyId, supabase])

  // Load study material settings when dialog opens
  useEffect(() => {
    if (isOpen && !settingsLoaded) {
      loadStudyMaterialSettings()
    }
  }, [isOpen, settingsLoaded, loadStudyMaterialSettings])

  const handleFileSelected = (file: OneDriveFile) => {
    setSelectedFile(file)
    setShowFilePicker(false)
    
    // Pre-fill the name with the file name without extension
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "")
    setFormData((prev) => ({ ...prev, name: prev.name || nameWithoutExt }))
    
    // Generate initial slug if not set
    if (!publicSlug) {
      const initialSlug = createSlug(nameWithoutExt)
      setPublicSlug(initialSlug)
      if (initialSlug.length >= 3) {
        checkSlugAvailability(initialSlug)
      }
    }
  }

  const handleOpenFilePicker = () => {
    setShowFilePicker(true)
  }

  const checkSlugAvailability = async (slug: string) => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null)
      return
    }

    try {
      // Check both study notes and subject materials for slug uniqueness within the study
      const [notesResult, materialsResult, subjectMaterialsResult] = await Promise.all([
        supabase
          .from("study_notes")
          .select("id")
          .eq("study_id", studyId)
          .eq("public_slug", slug)
          .single(),
        supabase
          .from("materials")
          .select("id")
          .eq("study_id", studyId)
          .eq("public_slug", slug)
          .single(),
        supabase
          .from("subject_materials")
          .select("id")
          .eq("study_id", studyId)
          .eq("public_slug", slug)
          .single()
      ])

      const isAvailable = !notesResult.data && !materialsResult.data && !subjectMaterialsResult.data
      setSlugAvailable(isAvailable)
    } catch (err) {
      console.error("Failed to check slug availability:", err)
      setSlugAvailable(null)
    }
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

    if (isPublic && (!publicSlug?.trim() || slugAvailable === false)) {
      setError("Zadejte platnou a dostupnou URL")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const fileExtension = selectedFile.name.split(".").pop()

      // Check if file is DOCX
      if (!fileExtension || !['docx', 'doc'].includes(fileExtension.toLowerCase())) {
        throw new Error("Studijní zápisy musí být ve formátu DOCX")
      }

      const noteData = {
        study_id: studyId,
        name: formData.name.trim(),
        file_name: selectedFile.name,
        file_extension: `.${fileExtension}`,
        file_size: selectedFile.size || null,
        mime_type: selectedFile.file?.mimeType || null,
        onedrive_id: selectedFile.id,
        onedrive_web_url: selectedFile.webUrl,
        onedrive_download_url: selectedFile["@microsoft.graph.downloadUrl"] || null,
        parent_path: selectedFile.parentReference?.path || null,
        description: formData.description?.trim() || null,
        last_modified_onedrive: selectedFile.lastModifiedDateTime,
        is_public: isPublic,
        public_slug: publicSlug || generateUniqueSlug(),
      }

      const { data: insertedNote, error: insertError } = await supabase
        .from("study_notes")
        .insert(noteData)
        .select()
        .single()

      if (insertError) throw insertError

      // Create the primary link in the appropriate many-to-many table
      if (isFinalExam) {
        const { error: linkError } = await supabase
          .from("study_note_final_exams")
          .insert({
            study_note_id: insertedNote.id,
            final_exam_id: subjectId,
            is_primary: true,
            linked_by: null
          })

        if (linkError) throw linkError
      } else {
        const { error: linkError } = await supabase
          .from("study_note_subjects")
          .insert({
            study_note_id: insertedNote.id,
            subject_id: subjectId,
            is_primary: true,
            linked_by: null
          })

        if (linkError) throw linkError
      }

      onSuccess()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se přidat studijní zápis")
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
    })
    setIsPublic(true)
    setPublicSlug("")
    setSlugAvailable(null)
    setError(null)
    onClose()
  }

  const truncateFileName = (fileName: string, maxLength: number = 35): string => {
    if (fileName.length <= maxLength) return fileName
    
    const dotIndex = fileName.lastIndexOf('.')
    if (dotIndex === -1) {
      return `${fileName.substring(0, maxLength - 3)  }...`
    }
    
    const extension = fileName.substring(dotIndex)
    const nameWithoutExt = fileName.substring(0, dotIndex)
    const availableLength = maxLength - extension.length - 3
    
    if (availableLength <= 0) {
      return `${fileName.substring(0, maxLength - 3)  }...`
    }
    
    return `${nameWithoutExt.substring(0, availableLength)  }...${  extension}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {showFilePicker ? "Vyberte studijní zápis" : "Přidat studijní zápis"}
          </DialogTitle>
          <DialogDescription>
            {showFilePicker 
              ? "Vyberte DOCX soubor se studijními zápisy"
              : isFinalExam
                ? "Přidejte studijní zápis ke státní zkoušce (pouze DOCX formát)"
                : "Přidejte studijní zápis k předmětu (pouze DOCX formát)"
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
              fileExtensions={[".docx", ".doc"]}
            />
          ) : !selectedFile ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <p className="text-sm text-gray-600 mb-4">
                Vyberte DOCX soubor z vašeho OneDrive
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
                <FileText className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="font-medium text-sm truncate cursor-help">
                          {truncateFileName(selectedFile.name)}
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
                  placeholder="Např. Zápis z přednášky - kapitola 1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Popis</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Volitelný popis studijního zápisu..."
                  rows={3}
                />
              </div>

              <div className="space-y-4 pt-4 border-t">
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
                  <div className="space-y-2">
                    <Label htmlFor="slug">Veřejná URL</Label>
                    <Input
                      id="slug"
                      value={publicSlug}
                      onChange={(e) => {
                        const cleanSlug = cleanSlugInput(e.target.value)
                        setPublicSlug(cleanSlug)
                        if (cleanSlug && cleanSlug.length >= 3) {
                          checkSlugAvailability(cleanSlug)
                        }
                      }}
                      placeholder="unikatni-nazev"
                    />
                    {publicSlug && slugAvailable === false && (
                      <p className="text-sm text-red-600">Tato URL je již použita</p>
                    )}
                    {publicSlug && slugAvailable === true && (
                      <p className="text-sm text-green-600">Tato URL je dostupná</p>
                    )}
                    <p className="text-sm text-gray-500">
                      Zápis bude dostupný na: {typeof window !== 'undefined' ? window.location.origin : ''}/{studySlug || "study-slug"}/{publicSlug || "..."}
                    </p>
                  </div>
                )}
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
                disabled={loading || !selectedFile || !formData.name?.trim() || (isPublic && (!publicSlug?.trim() || slugAvailable === false))}
                className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
              >
                {loading ? "Přidávání..." : "Přidat zápis"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}