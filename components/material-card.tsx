"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Download, ExternalLink, MoreVertical, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Material } from "@/lib/types/materials"

interface MaterialCardProps {
  material: Material
  onDelete?: (id: string) => void
}

const fileIcons: { [key: string]: JSX.Element } = {
  pdf: <FileText className="h-8 w-8 text-red-600" />,
  doc: <FileText className="h-8 w-8 text-blue-600" />,
  docx: <FileText className="h-8 w-8 text-blue-600" />,
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

export function MaterialCard({ material, onDelete }: MaterialCardProps) {
  const handleCardClick = () => {
    window.open(material.onedrive_web_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-200 group cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div 
            className="flex-shrink-0 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={handleCardClick}
          >
            {getFileIcon(material.file_extension)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0" onClick={handleCardClick}>
                <h3 className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                  {material.name}
                </h3>
                <p className="text-sm text-gray-600 truncate">{material.file_name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {material.category && (
                    <Badge variant="secondary" className="text-xs">
                      {material.category}
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
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={() => onDelete(material.id)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Odstranit
                    </DropdownMenuItem>
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
    </Card>
  )
}