"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { FileText, AlertCircle, Search, X, Folder, ChevronRight, File } from "lucide-react"
import { signIn } from "next-auth/react"
import type { OneDriveFile } from "@/lib/types/materials"

interface OneDriveFilePickerProps {
  onFileSelected: (_file: OneDriveFile) => void
  initialPath?: string
  initialPathName?: string
  fileExtensions?: string[] // Optional filter for file extensions
  allowFolders?: boolean
}

export function OneDriveFilePicker({
  onFileSelected,
  initialPath = "/drive/root:",
  initialPathName = "OneDrive",
  fileExtensions,
  allowFolders = false,
}: OneDriveFilePickerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableFiles, setAvailableFiles] = useState<OneDriveFile[]>([])
  const [currentPath, setCurrentPath] = useState<string>(initialPath)
  const [pathHistory, setPathHistory] = useState<Array<{name: string, path: string}>>([
    {name: initialPathName, path: initialPath}
  ])
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  const loadFiles = useCallback(async (path: string, search?: string) => {
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
          await signIn("microsoft-entra-id")
          return
        }
        
        throw new Error(errorData.error || "Nepodařilo se načíst soubory z OneDrive")
      }

      const { files } = await response.json()
      
      // Filter files by extension if specified
      let filteredFiles = files
      if (fileExtensions && fileExtensions.length > 0 && !search) {
        filteredFiles = files.filter((file: OneDriveFile) => {
          if (file.folder) return true // Always show folders for navigation
          const ext = file.name.split('.').pop()?.toLowerCase()
          return ext && fileExtensions.includes(`.${ext}`)
        })
      }
      
      setAvailableFiles(filteredFiles)
      
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
  }, [fileExtensions])

  useEffect(() => {
    loadFiles(initialPath)
  }, [initialPath, loadFiles])

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

  const handleItemClick = (item: OneDriveFile) => {
    if (item.folder) {
      if (allowFolders) {
        onFileSelected(item)
      } else {
        handleFolderClick(item)
      }
    } else {
      onFileSelected(item)
    }
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase()
    if (ext === "pdf") return <FileText className="h-6 w-6 text-red-600" />
    if (ext === "docx" || ext === "doc") return <FileText className="h-6 w-6 text-primary" />
    if (ext === "xlsx" || ext === "xls") return <FileText className="h-6 w-6 text-green-600" />
    return <File className="h-6 w-6 text-gray-600" />
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
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
                className="hover:text-primary-600 whitespace-nowrap"
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
              <div key={i} className="h-12 bg-primary-100 rounded animate-pulse" />
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
              className="flex items-center gap-3 p-3 hover:bg-primary-50 cursor-pointer rounded border"
              onClick={() => handleItemClick(item)}
            >
              <div className="flex-shrink-0">
                {item.folder ? (
                  <Folder className="h-6 w-6 text-primary" />
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
              {item.folder && !allowFolders && (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}