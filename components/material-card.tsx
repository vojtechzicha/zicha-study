"use client"

import { useState, type JSX } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Download, ExternalLink, MoreVertical, Trash2, Globe, Copy, Check } from "lucide-react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updateMaterialAction, checkMaterialSlug } from "@/lib/actions/materials"
import { createCacheShareLinkAction } from "@/lib/actions/onedrive-cache"
import type { Material } from "@/lib/types/materials"
import { createSlug, cleanSlugInput } from "@/lib/utils/slug"
import { getShareUrl } from "@/lib/utils/share-url"

interface MaterialCardProps {
  material: Material
  onDelete?: (_id: string) => void
  onUpdate?: () => void
  studySlug?: string
  isStudyPublic?: boolean
}

const fileIcons: { [key: string]: JSX.Element } = {
  pdf: <FileText className="h-8 w-8 text-red-600" />,
  doc: <FileText className="h-8 w-8 text-primary" />,
  docx: <FileText className="h-8 w-8 text-primary" />,
  xls: <FileText className="h-8 w-8 text-green-600" />,
  xlsx: <FileText className="h-8 w-8 text-green-600" />,
  ppt: <FileText className="h-8 w-8 text-orange-600" />,
  pptx: <FileText className="h-8 w-8 text-orange-600" />,
  default: <FileText className="h-8 w-8 text-gray-600" />,
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

export function MaterialCard({ material, onDelete, onUpdate, studySlug, isStudyPublic }: MaterialCardProps) {
  const [showPublicDialog, setShowPublicDialog] = useState(false)
  const [isPublic, setIsPublic] = useState(material.is_public)
  const [publicSlug, setPublicSlug] = useState(material.public_slug || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCardClick = () => {
    window.open(material.onedrive_web_url, '_blank', 'noopener,noreferrer')
  }

  const checkSlugAvailability = async (slug: string) => {
    if (!slug || slug === material.public_slug) {
      setSlugAvailable(true)
      return
    }

    const isAvailable = await checkMaterialSlug(material.study_id, slug, material.id)
    setSlugAvailable(isAvailable)
  }

  const handleSlugChange = (value: string) => {
    const cleanSlug = cleanSlugInput(value)
    setPublicSlug(cleanSlug)

    if (cleanSlug && cleanSlug.length >= 3) {
      checkSlugAvailability(cleanSlug)
    } else {
      setSlugAvailable(null)
    }
  }

  const handlePublicToggle = async () => {
    if (!isStudyPublic) return

    if (!isPublic) {
      // Generate initial slug from material name
      const initialSlug = createSlug(material.name)
      setPublicSlug(initialSlug)
      setShowPublicDialog(true)
    } else {
      // Unpublish directly
      await updatePublicStatus(false, null)
    }
  }

  const updatePublicStatus = async (isPublicNew: boolean, slug: string | null) => {
    setLoading(true)
    setError(null)

    try {
      let publicShareUrl = null

      if (isPublicNew) {
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
        is_public: isPublicNew,
        public_slug: slug,
        public_share_url: publicShareUrl,
      })

      if (result.error) throw new Error(result.error.message)

      // Create cache share link if publishing and cache exists (non-blocking)
      if (isPublicNew && material.cache_onedrive_id) {
        createCacheShareLinkAction(
          material.id,
          material.cache_onedrive_id,
          "materials"
        ).catch((err) => console.error("Cache share link creation failed:", err))
      }

      setIsPublic(isPublicNew)
      if (onUpdate) onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nastala chyba při ukládání")
    } finally {
      setLoading(false)
    }
  }

  const handlePublicSubmit = async () => {
    if (!publicSlug || slugAvailable === false) {
      setError("Zadejte platný a dostupný slug")
      return
    }

    await updatePublicStatus(true, publicSlug)
    setShowPublicDialog(false)
  }

  const copyPublicUrl = async () => {
    if (!studySlug || !material.public_slug) return

    const publicUrl = getShareUrl(studySlug, material.public_slug)
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-200 group cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 p-2 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
            onClick={handleCardClick}
          >
            {getFileIcon(material.file_extension)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0" onClick={handleCardClick}>
                <h3 className="font-medium text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                  {material.name}
                </h3>
                <p className="text-sm text-gray-600 truncate">{material.file_name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {material.category && (
                    <Badge variant="secondary" className="text-xs">
                      {material.category}
                    </Badge>
                  )}
                  {isPublic && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      <Globe className="h-3 w-3 mr-1" />
                      Veřejné
                    </Badge>
                  )}
                  {material.file_size && (
                    <span className="text-xs text-gray-500">{formatFileSize(material.file_size)}</span>
                  )}
                </div>
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
                  <DropdownMenuItem asChild>
                    <a
                      href={material.onedrive_web_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Otevřít v OneDrive
                    </a>
                  </DropdownMenuItem>
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
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handlePublicToggle}
                        disabled={loading}
                      >
                        <Globe className="mr-2 h-4 w-4" />
                        {isPublic ? "Zrušit publikování" : "Publikovat"}
                      </DropdownMenuItem>
                      {isPublic && studySlug && material.public_slug && (
                        <DropdownMenuItem onClick={copyPublicUrl}>
                          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                          {copied ? "Zkopírováno!" : "Kopírovat veřejný odkaz"}
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
            {material.description && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{material.description}</p>
            )}
          </div>
        </div>
      </CardContent>

      {/* Public Sharing Dialog */}
      <Dialog open={showPublicDialog} onOpenChange={setShowPublicDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Publikovat materiál</DialogTitle>
            <DialogDescription>
              Nastavte veřejný odkaz pro tento materiál. Bude dostupný na adrese /{studySlug}/{publicSlug}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="public-slug">URL adresa *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{getShareUrl(studySlug)}/</span>
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
            <Button variant="outline" onClick={() => setShowPublicDialog(false)} disabled={loading}>
              Zrušit
            </Button>
            <Button
              onClick={handlePublicSubmit}
              disabled={loading || !publicSlug || slugAvailable === false}
              className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
            >
              {loading ? "Publikování..." : "Publikovat"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
