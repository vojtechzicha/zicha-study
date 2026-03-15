"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Folder, ChevronRight } from "lucide-react"
import type { OneDriveFolderItem, FolderPathHistoryItem, MaterialsRootFolder } from "@/lib/types/onedrive"

interface FolderPickerProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onFolderSelect: (_folder: MaterialsRootFolder) => void
  title?: string
  description?: string
}

export function FolderPicker({
  open,
  onOpenChange,
  onFolderSelect,
  title = "Vyberte složku pro materiály",
  description = "Vyberte složku z vašeho OneDrive, která bude výchozí pro materiály tohoto studia"
}: FolderPickerProps) {
  const [availableFolders, setAvailableFolders] = useState<OneDriveFolderItem[]>([])
  const [folderPickerLoading, setFolderPickerLoading] = useState(false)
  const [folderPickerError, setFolderPickerError] = useState<string | null>(null)
  const [, setCurrentFolderPath] = useState<string>("/drive/root:")
  const [folderPathHistory, setFolderPathHistory] = useState<FolderPathHistoryItem[]>([
    { name: "OneDrive", path: "/drive/root:" }
  ])

  const loadFolders = async (path: string = "/drive/root:") => {
    setFolderPickerLoading(true)
    setFolderPickerError(null)

    try {
      const url = `/api/onedrive/files?path=${encodeURIComponent(path)}`
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()

        if (errorData.needsReauth) {
          throw new Error("Přístup k OneDrive vypršel. Prosím, přihlaste se znovu.")
        }

        throw new Error(errorData.error || "Nepodařilo se načíst složky z OneDrive")
      }

      const { files } = await response.json()
      const folders: OneDriveFolderItem[] = files.filter((item: OneDriveFolderItem) => item.folder)

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

  const handleOpenChange = async (isOpen: boolean) => {
    if (isOpen) {
      setCurrentFolderPath("/drive/root:")
      setFolderPathHistory([{ name: "OneDrive", path: "/drive/root:" }])
      await loadFolders()
    }
    onOpenChange(isOpen)
  }

  const handleFolderNavigation = async (folder: OneDriveFolderItem) => {
    const newPath = `/drive/items/${folder.id}`
    const newPathHistory: FolderPathHistoryItem[] = [
      ...folderPathHistory,
      { name: folder.name, path: newPath }
    ]
    setFolderPathHistory(newPathHistory)
    await loadFolders(newPath)
  }

  const handleBreadcrumbNavigation = async (index: number) => {
    const newPathHistory = folderPathHistory.slice(0, index + 1)
    const targetPath = newPathHistory[newPathHistory.length - 1].path
    setFolderPathHistory(newPathHistory)
    await loadFolders(targetPath)
  }

  const handleFolderSelect = (folder: OneDriveFolderItem) => {
    if (folder.isRoot) {
      onFolderSelect({
        id: null,
        name: "OneDrive",
        path: "/drive/root:"
      })
    } else {
      onFolderSelect({
        id: folder.id,
        name: folder.name,
        path: `/drive/items/${folder.id}`
      })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
