"use client"

import { useState, useMemo, type JSX } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FileText, ExternalLink, Download, Trash2, Search, Globe, MoreVertical, Copy, Check } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updateMaterialAction, checkMaterialSlug } from "@/lib/actions/materials"
import { createCacheShareLinkAction } from "@/lib/actions/onedrive-cache"
import type { Material } from "@/lib/types/materials"
import { createSlug, cleanSlugInput } from "@/lib/utils/slug"
import { getShareUrl } from "@/lib/utils/share-url"

interface MaterialsTableProps {
  materials: Material[]
  onDelete?: (_id: string) => void
  onUpdate?: () => void
  loading?: boolean
  studySlug?: string
  isStudyPublic?: boolean
}

const fileIcons: { [key: string]: JSX.Element } = {
  pdf: <FileText className="h-4 w-4 text-red-600" />,
  doc: <FileText className="h-4 w-4 text-primary" />,
  docx: <FileText className="h-4 w-4 text-primary" />,
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

export function MaterialsTable({ materials, onDelete, onUpdate, loading, studySlug, isStudyPublic }: MaterialsTableProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [copied, setCopied] = useState<string | null>(null)
  const [publishingMaterial, setPublishingMaterial] = useState<Material | null>(null)
  const [publicSlug, setPublicSlug] = useState("")
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [publishLoading, setPublishLoading] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  const checkSlugAvailability = async (studyId: string, slug: string, materialId: string, currentSlug?: string | null) => {
    if (!slug || slug === currentSlug) {
      setSlugAvailable(true)
      return
    }

    const isAvailable = await checkMaterialSlug(studyId, slug, materialId)
    setSlugAvailable(isAvailable)
  }

  const handleSlugChange = (value: string) => {
    const cleanSlug = cleanSlugInput(value)
    setPublicSlug(cleanSlug)

    if (publishingMaterial && cleanSlug && cleanSlug.length >= 3) {
      checkSlugAvailability(publishingMaterial.study_id, cleanSlug, publishingMaterial.id, publishingMaterial.public_slug)
    } else {
      setSlugAvailable(null)
    }
  }

  const handlePublicToggle = async (material: Material) => {
    if (!material.is_public) {
      // Open dialog to let user choose the slug
      const initialSlug = createSlug(material.name)
      setPublishingMaterial(material)
      setPublicSlug(initialSlug)
      setSlugAvailable(null)
      setPublishError(null)
      if (initialSlug && initialSlug.length >= 3) {
        checkSlugAvailability(material.study_id, initialSlug, material.id, material.public_slug)
      }
    } else {
      await updatePublicStatus(material, false, null)
    }
  }

  const handlePublishSubmit = async () => {
    if (!publishingMaterial) return
    if (!publicSlug || slugAvailable === false) {
      setPublishError("Zadejte platný a dostupný slug")
      return
    }

    await updatePublicStatus(publishingMaterial, true, publicSlug)
  }

  const updatePublicStatus = async (material: Material, isPublic: boolean, slug: string | null) => {
    setPublishLoading(true)
    setPublishError(null)

    try {
      let publicShareUrl = null

      if (isPublic) {
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

          // Handle authentication errors that need re-authentication
          if (errorData.needsReauth) {
            throw new Error("Přístup k OneDrive vypršel. Prosím, přihlaste se znovu.")
          }

          throw new Error(errorData.error || "Failed to create public share link")
        }

        const { shareUrl } = await response.json()
        publicShareUrl = shareUrl
      }

      const result = await updateMaterialAction(material.id, {
        is_public: isPublic,
        public_slug: slug,
        public_share_url: publicShareUrl,
      })

      if (result.error) throw new Error(result.error.message)

      // Create cache share link if publishing and cache exists (non-blocking)
      if (isPublic && material.cache_onedrive_id) {
        createCacheShareLinkAction(
          material.id,
          material.cache_onedrive_id,
          "materials"
        ).catch((err) => console.error("Cache share link creation failed:", err))
      }

      if (onUpdate) onUpdate()
      setPublishingMaterial(null)
      setPublicSlug("")
      setSlugAvailable(null)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Nastala chyba při ukládání")
      console.error("Error updating public status:", err)
    } finally {
      setPublishLoading(false)
    }
  }

  const copyPublicUrl = async (material: Material) => {
    if (!studySlug || !material.public_slug) return

    const publicUrl = getShareUrl(studySlug, material.public_slug)
    await navigator.clipboard.writeText(publicUrl)
    setCopied(material.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const filteredMaterials = useMemo(() => {
    if (!searchQuery.trim()) return materials

    const query = searchQuery.toLowerCase().trim()
    return materials.filter((material) => {
      const searchableFields = [
        material.name?.toLowerCase() || "",
        material.file_name?.toLowerCase() || "",
        material.description?.toLowerCase() || "",
        material.category?.toLowerCase() || "",
        ...(material.tags || []).map((tag) => tag.toLowerCase()),
      ]

      return searchableFields.some((field) => field.includes(query))
    })
  }, [materials, searchQuery])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-primary-100 rounded animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-primary-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Hledat v materiálech..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-md border">
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
                  {searchQuery ? "Žádné materiály neodpovídají vyhledávání" : "Zatím nejsou přidány žádné materiály"}
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
                      <Badge variant="outline" className="bg-primary-50 text-primary-600 border-primary-200">
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

                          {isStudyPublic && (
                            <>
                              {material.onedrive_download_url && <DropdownMenuSeparator />}
                              <DropdownMenuItem onClick={() => handlePublicToggle(material)}>
                                <Globe className="mr-2 h-4 w-4" />
                                {material.is_public ? "Zrušit publikování" : "Publikovat"}
                              </DropdownMenuItem>
                              {material.is_public && studySlug && material.public_slug && (
                                <DropdownMenuItem onClick={() => copyPublicUrl(material)}>
                                  {copied === material.id ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                                  {copied === material.id ? "Zkopírováno!" : "Kopírovat veřejný odkaz"}
                                </DropdownMenuItem>
                              )}
                            </>
                          )}

                          {onDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onDelete(material.id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Odstranit
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Public Sharing Dialog */}
      <Dialog
        open={publishingMaterial !== null}
        onOpenChange={(open) => {
          if (!open && !publishLoading) {
            setPublishingMaterial(null)
            setPublicSlug("")
            setSlugAvailable(null)
            setPublishError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Publikovat materiál</DialogTitle>
            <DialogDescription>
              Nastavte veřejný odkaz pro tento materiál. Bude dostupný na adrese /{studySlug}/{publicSlug}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {publishError && (
              <Alert variant="destructive">
                <AlertDescription>{publishError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="public-slug">URL adresa *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {typeof window !== "undefined" ? window.location.origin : ""}/{studySlug}/
                </span>
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
              {slugAvailable === false && (
                <p className="text-sm text-red-600">Tato URL adresa již není dostupná pro toto studium</p>
              )}
              {slugAvailable === true && publicSlug && (
                <p className="text-sm text-green-600">URL adresa je dostupná</p>
              )}
              <p className="text-xs text-gray-500">Pouze písmena, čísla, pomlčky a podtržítka. 3-50 znaků.</p>
            </div>

            {publicSlug && slugAvailable && (
              <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                <Label className="text-sm font-medium text-primary-900">Veřejná URL adresa:</Label>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 p-2 bg-white rounded border text-sm">
                    {getShareUrl(studySlug, publicSlug)}
                  </code>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPublishingMaterial(null)
                setPublicSlug("")
                setSlugAvailable(null)
                setPublishError(null)
              }}
              disabled={publishLoading}
            >
              Zrušit
            </Button>
            <Button
              onClick={handlePublishSubmit}
              disabled={publishLoading || !publicSlug || slugAvailable === false}
              className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
            >
              {publishLoading ? "Publikování..." : "Publikovat"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
