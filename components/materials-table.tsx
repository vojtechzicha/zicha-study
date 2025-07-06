"use client"

import { useState, useMemo } from "react"
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
import { FileText, ExternalLink, Download, Trash2, Search } from "lucide-react"
import type { Material } from "@/lib/types/materials"

interface MaterialsTableProps {
  materials: Material[]
  onDelete?: (id: string) => void
  loading?: boolean
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

export function MaterialsTable({ materials, onDelete, loading }: MaterialsTableProps) {
  const [searchQuery, setSearchQuery] = useState("")

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
        <div className="h-10 bg-gray-100 rounded animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
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
              <TableHead>Velikost</TableHead>
              <TableHead>Přidáno</TableHead>
              <TableHead className="text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMaterials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
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
                  <TableCell className="text-sm text-gray-600">
                    {formatFileSize(material.file_size)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(material.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
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
                      {material.onedrive_download_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a
                            href={material.onedrive_download_url}
                            download
                            title="Stáhnout"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(material.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Odstranit"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}