"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"

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
    end_year: study.end_year?.toString() || "",
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
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Prosím vyberte obrázek (PNG, JPG, SVG)")
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Obrázek je příliš velký. Maximální velikost je 5MB.")
        return
      }

      setLogoFile(file)

      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      setError(null)
    }
  }

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return study.logo_url || null

    try {
      // Create a unique filename
      const fileExt = logoFile.name.split(".").pop()
      const fileName = `${study.id}-${Date.now()}.${fileExt}`
      const filePath = `study-logos/${fileName}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage.from("study-assets").upload(filePath, logoFile, {
        cacheControl: "3600",
        upsert: false,
      })

      if (error) {
        console.error("Upload error:", error)
        throw error
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("study-assets").getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error("Error uploading logo:", error)
      throw new Error("Chyba při nahrávání loga")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Upload logo if there's a new one
      const logoUrl = await uploadLogo()

      // Update study
      const { error } = await supabase
        .from("studies")
        .update({
          name: formData.name,
          type: formData.type,
          form: formData.form,
          start_year: formData.start_year,
          end_year: formData.end_year ? Number.parseInt(formData.end_year) : null,
          status: formData.status,
          logo_url: logoUrl,
        })
        .eq("id", study.id)

      if (error) {
        throw error
      }

      onSuccess()
    } catch (error: any) {
      setError(error.message || "Chyba při ukládání studia. Zkuste to prosím znovu.")
      setLoading(false)
    }
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={onClose} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zpět na přehled
          </Button>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900">Upravit studium</CardTitle>
            <CardDescription>Upravte informace o vašem studiu</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Logo Upload Section */}
              <div className="space-y-4">
                <Label htmlFor="logo">Logo fakulty</Label>
                <div className="flex items-start gap-4">
                  {logoPreview && (
                    <div className="relative">
                      <div className="w-24 h-24 border-2 border-gray-200 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                        <Image
                          src={logoPreview || "/placeholder.svg"}
                          alt="Logo preview"
                          width={96}
                          height={96}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        onClick={removeLogo}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Podporované formáty: PNG, JPG, SVG. Maximální velikost: 5MB. Logo bude automaticky přizpůsobeno
                      různým velikostem.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Název studia *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="např. Informatika"
                  required
                />
              </div>

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
                    <SelectItem value="Jiné">Jiné</SelectItem>
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
                    <SelectItem value="prezenční">Prezenční</SelectItem>
                    <SelectItem value="kombinovaný">Kombinovaný</SelectItem>
                    <SelectItem value="distanční">Distanční</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_year">Rok začátku *</Label>
                  <Input
                    id="start_year"
                    type="number"
                    value={formData.start_year}
                    onChange={(e) => setFormData({ ...formData, start_year: Number.parseInt(e.target.value) })}
                    min="2000"
                    max="2030"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_year">Rok konce (volitelné)</Label>
                  <Input
                    id="end_year"
                    type="number"
                    value={formData.end_year}
                    onChange={(e) => setFormData({ ...formData, end_year: e.target.value })}
                    min="2000"
                    max="2030"
                    placeholder="např. 2024"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Stav studia</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktivní</SelectItem>
                    <SelectItem value="completed">Dokončeno</SelectItem>
                    <SelectItem value="paused">Pozastaveno</SelectItem>
                    <SelectItem value="abandoned">Zanechaný</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
                  Zrušit
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !formData.name || !formData.type || !formData.form}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? "Ukládání..." : "Uložit změny"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
