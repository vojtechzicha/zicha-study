"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  FileText, 
  ExternalLink, 
  Download, 
  Trash2, 
  Search, 
  Globe, 
  Plus, 
  FolderOpen,
  AlertCircle,
  Copy,
  Check,
  MoreVertical
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"
import { AddMaterialDialog } from "@/components/add-material-dialog"
import type { SubjectMaterial } from "@/lib/types/materials"

interface Subject {
  id: string
  name: string
  abbreviation: string
  study_id: string
}

interface Study {
  id: string
  name: string
  is_public?: boolean
  public_slug?: string
}

interface SubjectMaterialsDialogProps {
  subject: Subject | null
  study?: Study
  isOpen: boolean
  onClose: () => void
}

const fileIcons: { [key: string]: JSX.Element } = {
  pdf: <FileText className="h-4 w-4 text-red-600" />,
  doc: <FileText className="h-4 w-4 text-blue-600" />,
  docx: <FileText className="h-4 w-4 text-blue-600" />,
  xls: <FileText className="h-4 w-4 text-green-600" />,
  xlsx: <FileText className="h-4 w-4 text-green-600" />,
  ppt: <FileText className="h-4 w-4 text-orange-600" />,
  pptx: <FileText className="h-4 w-4 text-orange-600" />,
  default: <FileText className="h-4 w-4 text-gray-600" />,
}

function getFileIcon(extension: string | null) {
  if (!extension) return fileIcons.default
  const ext = extension.toLowerCase().replace(".", "")
  return fileIcons[ext] || fileIcons.default
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ""
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

function formatDate(dateString: string | null): string {
  if (!dateString) return ""
  const date = new Date(dateString)
  return date.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })
}

export function SubjectMaterialsDialog({ 
  subject, 
  study,
  isOpen, 
  onClose 
}: SubjectMaterialsDialogProps) {
  const [materials, setMaterials] = useState<SubjectMaterial[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [showPublicDialog, setShowPublicDialog] = useState(false)
  const [publicDialogMaterial, setPublicDialogMaterial] = useState<SubjectMaterial | null>(null)
  const [publicSlug, setPublicSlug] = useState("")
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [publicLoading, setPublicLoading] = useState(false)
  const [publicError, setPublicError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && subject) {
      loadMaterials()
    }
  }, [isOpen, subject])

  const loadMaterials = async () => {
    if (!subject) return
    
    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase
        .from("subject_materials")
        .select("*")
        .eq("subject_id", subject.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setMaterials(data || [])
    } catch (err) {
      setError("Nepodařilo se načíst materiály předmětu")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (materialId: string) => {
    if (!confirm("Opravdu chcete odstranit tento materiál?")) {
      return
    }

    try {
      const { error } = await supabase
        .from("subject_materials")
        .delete()
        .eq("id", materialId)

      if (error) throw error
      
      setMaterials(materials.filter(m => m.id !== materialId))
    } catch (err) {
      setError("Nepodařilo se odstranit materiál")
    }
  }

  const checkSlugAvailability = async (slug: string, materialId: string) => {
    if (!slug || !subject) {
      setSlugAvailable(null)
      return
    }

    // Check both study materials and subject materials for slug uniqueness
    const [studyMaterialsResult, subjectMaterialsResult] = await Promise.all([
      supabase
        .from("materials")
        .select("id")
        .eq("study_id", subject.study_id)
        .eq("public_slug", slug)
        .single(),
      supabase
        .from("subject_materials")
        .select("id")
        .eq("study_id", subject.study_id)
        .eq("public_slug", slug)
        .neq("id", materialId)
        .single()
    ])

    const isAvailable = !studyMaterialsResult.data && !subjectMaterialsResult.data
    setSlugAvailable(isAvailable)
  }

  const handleSlugChange = (value: string) => {
    const cleanSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "")
      .slice(0, 50)
    setPublicSlug(cleanSlug)
    
    if (cleanSlug && cleanSlug.length >= 3 && publicDialogMaterial) {
      checkSlugAvailability(cleanSlug, publicDialogMaterial.id)
    } else {
      setSlugAvailable(null)
    }
  }

  const handlePublicToggle = async (material: SubjectMaterial) => {
    if (!material.is_public) {
      // Generate initial slug from material name
      const initialSlug = material.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-_]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 50)
      
      setPublicDialogMaterial(material)
      setPublicSlug(initialSlug)
      setPublicError(null)
      setShowPublicDialog(true)
      
      if (initialSlug.length >= 3) {
        checkSlugAvailability(initialSlug, material.id)
      }
    } else {
      await updatePublicStatus(material.id, false, null)
    }
  }

  const handlePublicSubmit = async () => {
    if (!publicDialogMaterial || !publicSlug || slugAvailable === false) {
      setPublicError("Zadejte platný a dostupný slug")
      return
    }

    await updatePublicStatus(publicDialogMaterial.id, true, publicSlug)
    setShowPublicDialog(false)
    setPublicDialogMaterial(null)
  }

  const updatePublicStatus = async (materialId: string, isPublic: boolean, slug: string | null) => {
    setPublicLoading(true)
    setPublicError(null)
    
    try {
      let publicShareUrl = null
      
      if (isPublic) {
        // Find the material to get its OneDrive ID
        const material = materials.find(m => m.id === materialId)
        if (!material) throw new Error("Material not found")
        
        // Generate public share link
        const response = await fetch('/api/onedrive/share', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            onedriveId: material.onedrive_id
          })
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to create public share link")
        }
        
        const { shareUrl } = await response.json()
        publicShareUrl = shareUrl
      }

      const { error } = await supabase
        .from("subject_materials")
        .update({
          is_public: isPublic,
          public_slug: slug,
          public_share_url: publicShareUrl,
        })
        .eq("id", materialId)

      if (error) throw error
      await loadMaterials()
    } catch (err) {
      setPublicError(err instanceof Error ? err.message : "Nepodařilo se aktualizovat publikování materiálu")
    } finally {
      setPublicLoading(false)
    }
  }

  const copyPublicUrl = async (material: SubjectMaterial) => {
    if (!study?.public_slug || !material.public_slug) return
    
    const publicUrl = `${window.location.origin}/${study.public_slug}/${material.public_slug}`
    await navigator.clipboard.writeText(publicUrl)
    setCopied(material.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleAddSuccess = () => {
    setShowAddDialog(false)
    loadMaterials()
  }

  const filteredMaterials = materials.filter((material) => {
    if (!searchQuery.trim()) return true
    
    const query = searchQuery.toLowerCase().trim()
    const searchableFields = [
      material.name?.toLowerCase() || "",
      material.file_name?.toLowerCase() || "",
      material.description?.toLowerCase() || "",
      material.category?.toLowerCase() || "",
      ...(material.tags || []).map((tag) => tag.toLowerCase()),
    ]

    return searchableFields.some((field) => field.includes(query))
  })

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Materiály předmětu {subject?.abbreviation || subject?.name}
            </DialogTitle>
            <DialogDescription>
              Dokumenty a soubory související s tímto předmětem
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Header with search and add button */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Hledat v materiálech..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={() => setShowAddDialog(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Přidat materiál
              </Button>
            </div>

            {/* Materials table */}
            <div className="flex-1 overflow-auto border rounded-md">
              {loading ? (
                <div className="space-y-4 p-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Název</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Velikost</TableHead>
                      <TableHead>Přidáno</TableHead>
                      <TableHead className="text-right">Akce</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaterials.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                          {searchQuery 
                            ? "Žádné materiály neodpovídají vyhledávání" 
                            : materials.length === 0
                            ? "Zatím nejsou přidány žádné materiály k tomuto předmětu"
                            : "Žádné materiály nenalezeny"
                          }
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMaterials.map((material) => (
                        <TableRow key={material.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getFileIcon(material.file_extension)}
                              <div>
                                <div className="font-medium">{material.name}</div>
                                <div className="text-sm text-gray-500">{material.file_name}</div>
                                {material.description && (
                                  <div className="text-sm text-gray-600 mt-1">{material.description}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {material.category && (
                              <Badge variant="secondary">{material.category}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {material.is_public ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <Globe className="h-3 w-3 mr-1" />
                                Veřejné
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                                Soukromé
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {formatFileSize(material.file_size)}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {formatDate(material.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Direct OneDrive Link */}
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                              >
                                <a
                                  href={material.onedrive_web_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Otevřít v OneDrive"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>

                              {/* Dropdown Menu */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {material.onedrive_download_url && (
                                    <DropdownMenuItem asChild>
                                      <a
                                        href={material.onedrive_download_url}
                                        download
                                        className="flex items-center"
                                      >
                                        <Download className="mr-2 h-4 w-4" />
                                        Stáhnout
                                      </a>
                                    </DropdownMenuItem>
                                  )}
                                  
                                  {study?.is_public && (
                                    <>
                                      {material.onedrive_download_url && <DropdownMenuSeparator />}
                                      <DropdownMenuItem onClick={() => handlePublicToggle(material)}>
                                        <Globe className="mr-2 h-4 w-4" />
                                        {material.is_public ? "Zrušit publikování" : "Publikovat"}
                                      </DropdownMenuItem>
                                      {material.is_public && study.public_slug && material.public_slug && (
                                        <DropdownMenuItem onClick={() => copyPublicUrl(material)}>
                                          {copied === material.id ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                                          {copied === material.id ? "Zkopírováno!" : "Kopírovat veřejný odkaz"}
                                        </DropdownMenuItem>
                                      )}
                                    </>
                                  )}
                                  
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(material.id)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Odstranit
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Zavřít
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Material Dialog */}
      {subject && (
        <AddMaterialDialog
          studyId={subject.study_id}
          subjectId={subject.id}
          isOpen={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSuccess={handleAddSuccess}
        />
      )}

      {/* Public Sharing Dialog */}
      <Dialog open={showPublicDialog} onOpenChange={setShowPublicDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Publikovat materiál předmětu</DialogTitle>
            <DialogDescription>
              Nastavte veřejný odkaz pro tento materiál. Bude dostupný na adrese /{study?.public_slug}/{publicSlug}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {publicError && (
              <Alert variant="destructive">
                <AlertDescription>{publicError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="public-slug">URL adresa *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{window.location.origin}/{study?.public_slug}/</span>
                <Input
                  id="public-slug"
                  value={publicSlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="material-name"
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
                slugAvailable === true ? 'bg-blue-50 border-blue-200' : 
                slugAvailable === false ? 'bg-red-50 border-red-200' : 
                'bg-gray-50 border-gray-200'
              }`}>
                <Label className={`text-sm font-medium ${
                  slugAvailable === true ? 'text-blue-900' : 
                  slugAvailable === false ? 'text-red-900' : 
                  'text-gray-700'
                }`}>
                  Veřejná URL adresa:
                </Label>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 p-2 bg-white rounded border text-sm">
                    {window.location.origin}/{study?.public_slug}/{publicSlug}
                  </code>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPublicDialog(false)} disabled={publicLoading}>
              Zrušit
            </Button>
            <Button
              onClick={handlePublicSubmit}
              disabled={publicLoading || !publicSlug || slugAvailable === false}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            >
              {publicLoading ? "Publikování..." : "Publikovat"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}