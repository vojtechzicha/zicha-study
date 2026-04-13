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
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Folder, RefreshCw, Check, AlertCircle } from "lucide-react"
import { FolderPicker } from "./folder-picker"
import {
  fetchAppSettings,
  updateAppSettings,
  syncAllToCache,
  syncByFilename,
} from "@/lib/actions/onedrive-cache"
import type { CacheFolderConfig } from "@/lib/types/onedrive"
import type { MaterialsRootFolder } from "@/lib/types/onedrive"

interface CacheSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CacheSettingsDialog({
  open,
  onOpenChange,
}: CacheSettingsDialogProps) {
  const [cacheFolder, setCacheFolder] = useState<CacheFolderConfig | null>(null)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncingByName, setSyncingByName] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    total: number
    synced: number
    failed: number
    skipped: number
    errors: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const loadSettings = useCallback(async () => {
    try {
      const settings = await fetchAppSettings()
      setCacheFolder(settings)
      setLoaded(true)
    } catch {
      setError("Nepodařilo se načíst nastavení")
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (open && !loaded) {
      loadSettings()
    }
  }, [open, loaded, loadSettings])

  const handleFolderSelect = async (folder: MaterialsRootFolder) => {
    setSaving(true)
    setError(null)

    try {
      await updateAppSettings({
        cache_folder_id: folder.id,
        cache_folder_name: folder.name,
        cache_folder_path: folder.path,
      })

      setCacheFolder({
        cache_folder_id: folder.id,
        cache_folder_name: folder.name,
        cache_folder_path: folder.path,
      })
    } catch {
      setError("Nepodařilo se uložit nastavení")
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    setError(null)

    try {
      const result = await syncAllToCache()
      setSyncResult(result)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nepodařilo se synchronizovat soubory"
      )
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncByFilename = async () => {
    setSyncingByName(true)
    setSyncResult(null)
    setError(null)

    try {
      const result = await syncByFilename()
      setSyncResult(result)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nepodařilo se synchronizovat soubory"
      )
    } finally {
      setSyncingByName(false)
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSyncResult(null)
      setError(null)
    }
    onOpenChange(isOpen)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">
              Nastavení OneDrive cache
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Konfigurujte složku pro zálohy souborů z OneDrive. Zálohy
              zajistí funkčnost odkazů i po smazání původního souboru.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Cache folder selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Složka pro cache</Label>

              {cacheFolder?.cache_folder_id ? (
                <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg border border-primary-200">
                  <Folder className="h-5 w-5 text-primary-600 flex-shrink-0" />
                  <p className="flex-1 text-sm font-medium text-gray-900 min-w-0 truncate">
                    {cacheFolder.cache_folder_name}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFolderPicker(true)}
                    disabled={saving}
                    className="flex-shrink-0"
                  >
                    Změnit
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowFolderPicker(true)}
                  className="w-full justify-start text-left"
                  disabled={saving}
                >
                  <Folder className="h-4 w-4 mr-2" />
                  Vybrat složku z OneDrive
                </Button>
              )}

              <p className="text-xs text-gray-500">
                Při přidání materiálu nebo studijního zápisu se soubor
                automaticky zkopíruje do této složky.
              </p>
            </div>

            {/* Sync buttons */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-base font-medium">
                Synchronizace souborů
              </Label>

              <div className="space-y-2">
                <Button
                  onClick={handleSync}
                  disabled={syncing || syncingByName || !cacheFolder?.cache_folder_id}
                  className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Synchronizace...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Synchronizovat (podle ID)
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500">
                  Zkopíruje soubory, u kterých existuje původní odkaz v OneDrive.
                </p>

                <Button
                  onClick={handleSyncByFilename}
                  disabled={syncing || syncingByName || !cacheFolder?.cache_folder_id}
                  variant="outline"
                  className="w-full"
                >
                  {syncingByName ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Hledání souborů...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Synchronizovat (podle názvu)
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500">
                  Pro soubory smazané a znovu nahrané do OneDrive. Vyhledá
                  soubory podle cesty a názvu a aktualizuje odkazy.
                </p>
              </div>

              {syncResult && (
                <Alert
                  variant={syncResult.failed > 0 ? "destructive" : "default"}
                  className={
                    syncResult.failed === 0
                      ? "border-green-200 bg-green-50"
                      : undefined
                  }
                >
                  {syncResult.failed === 0 ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    <p className="font-medium">
                      Synchronizace dokončena
                    </p>
                    <ul className="text-sm mt-1 space-y-0.5">
                      <li>Celkem: {syncResult.total}</li>
                      <li>Synchronizováno: {syncResult.synced}</li>
                      {syncResult.skipped > 0 && (
                        <li>Přeskočeno (smazané): {syncResult.skipped}</li>
                      )}
                      {syncResult.failed > 0 && (
                        <li>Selhalo: {syncResult.failed}</li>
                      )}
                    </ul>
                    {syncResult.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer text-gray-500">
                          Zobrazit detaily ({syncResult.errors.length})
                        </summary>
                        <ul className="text-xs mt-1 space-y-0.5 text-gray-600">
                          {syncResult.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FolderPicker
        open={showFolderPicker}
        onOpenChange={setShowFolderPicker}
        onFolderSelect={handleFolderSelect}
        title="Vyberte složku pro OneDrive cache"
        description="Zálohy souborů budou ukládány do této složky"
      />
    </>
  )
}
