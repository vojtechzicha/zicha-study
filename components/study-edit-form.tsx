"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Upload, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Study {
  id: string
  name: string
  type: string
  form: string
  start_year: number
  end_year?: number
  status: "active" | "completed" | "paused" | "abandoned"
  logo_url?: string
  created_at: string
}

interface StudyEditFormProps {
  study: Study
  onClose: () => void
  onSuccess: () => void
}

export function StudyEditForm({ study, onClose, onSuccess }: StudyEditFormProps) {
  const [formData, setFormData] = useState({
    name: study.name,
    type: study.type,
    form: study.form,
    start_year: study.start_year,
    end_year: study.end_year || "",
    status: study.status,
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(study.logo_url || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Logo musí být menší než 5MB")
        return
      }
      if (!file.type.startsWith("image/")) {
        setError("Logo musí být obrázek")
        return
      }
      setLogoFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setLogoPreview(e.target?.result as string)
      reader.readAsDataURL(file)
      setError(null)
    }
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let logoUrl = study.logo_url

      // Upload new logo if provided
      if (logoFile) {
        console.log("Uploading logo file:", logoFile.name, "size:", logoFile.size)
        const fileExt = logoFile.name.split(".").pop()
        const { data: { user } } = await supabase.auth.getUser()
        const fileName = `${user?.id}/${study.id}-${Date.now()}.${fileExt}`
        console.log("Generated filename:", fileName)
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("study-logos")
          .upload(fileName, logoFile)

        console.log("Upload result:", { uploadData, uploadError })
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from("study-logos").getPublicUrl(uploadData.path)
        logoUrl = urlData.publicUrl

        // Delete old logo if it exists
        if (study.logo_url) {
          const urlParts = study.logo_url.split("/")
          const bucketIndex = urlParts.findIndex(part => part === "study-logos")
          if (bucketIndex !== -1 && bucketIndex + 1 < urlParts.length) {
            const oldPath = urlParts.slice(bucketIndex + 1).join("/")
            await supabase.storage.from("study-logos").remove([oldPath])
          }
        }
      } else if (logoPreview === null && study.logo_url) {
        // Remove logo if user cleared it
        const urlParts = study.logo_url.split("/")
        const bucketIndex = urlParts.findIndex(part => part === "study-logos")
        if (bucketIndex !== -1 && bucketIndex + 1 < urlParts.length) {
          const oldPath = urlParts.slice(bucketIndex + 1).join("/")
          await supabase.storage.from("study-logos").remove([oldPath])
        }
        logoUrl = null
      }

      const { error: updateError } = await supabase
        .from("studies")
        .update({
          ...formData,
          end_year: formData.end_year || null,
          logo_url: logoUrl,
        })
        .eq("id", study.id)

      if (updateError) throw updateError

      onSuccess()
    } catch (err) {
      console.error("Upload error:", err)
      setError(err instanceof Error ? err.message : "Nastala chyba při ukládání")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900">Upravit studium</CardTitle>
                <CardDescription className="text-gray-600">Upravte informace o vašem studiu</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Logo fakulty</Label>
                <div className="flex items-start gap-4">
                  {logoPreview ? (
                    <div className="relative flex-shrink-0">
                      <img
                        src={logoPreview || "/placeholder.svg"}
                        alt="Logo preview"
                        className="w-16 h-16 object-contain border rounded"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0"
                        onClick={removeLogo}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded flex items-center justify-center flex-shrink-0">
                      <Upload className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF do 5MB</p>
                  </div>
                </div>
              </div>

              {/* Study Name - Full Width */}
              <div className="space-y-2">
                <Label htmlFor="name">Název studijního programu *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="např. Informatika"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="type">Typ studia *</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte typ studia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bakalářské">Bakalářské</SelectItem>
                      <SelectItem value="Magisterské">Magisterské</SelectItem>
                      <SelectItem value="Doktorské">Doktorské</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="form">Forma studia *</Label>
                  <Select value={formData.form} onValueChange={(value) => setFormData({ ...formData, form: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte formu studia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Prezenční">Prezenční</SelectItem>
                      <SelectItem value="Kombinované">Kombinované</SelectItem>
                      <SelectItem value="Distanční">Distanční</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_year">Rok začátku *</Label>
                  <Input
                    id="start_year"
                    type="number"
                    min="2000"
                    max="2030"
                    value={formData.start_year}
                    onChange={(e) => setFormData({ ...formData, start_year: Number.parseInt(e.target.value) })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_year">Rok konce</Label>
                  <Input
                    id="end_year"
                    type="number"
                    min="2000"
                    max="2030"
                    value={formData.end_year}
                    onChange={(e) =>
                      setFormData({ ...formData, end_year: e.target.value ? Number.parseInt(e.target.value) : "" })
                    }
                    placeholder="Volitelné"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Stav studia *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte stav studia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Aktivní</SelectItem>
                      <SelectItem value="completed">Dokončeno</SelectItem>
                      <SelectItem value="paused">Pozastaveno</SelectItem>
                      <SelectItem value="abandoned">Zanechaný</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                >
                  {loading ? "Ukládání..." : "Uložit změny"}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Zrušit
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
