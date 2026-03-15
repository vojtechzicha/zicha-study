"use client"

import React, { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getStudyTypeOptions, getStudyFormOptions, getStudyFormLabel, getStudyStatusOptions, getStudyStatusLabel, type StudyStatus } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Upload, X, Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"
import { useRouter } from "next/navigation"

interface Study {
  id: string
  name: string
  type: string
  form: string
  start_year: number
  end_year?: number
  status: StudyStatus
  logo_url?: string
  final_exams_enabled?: boolean
  exam_scheduler_enabled?: boolean
  transit_duration_hours?: number
  transit_cost_one_way?: number
  accommodation_cost_per_night?: number
  earliest_arrival_time?: string | null
  is_url?: string
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
    final_exams_enabled: study.final_exams_enabled || false,
    exam_scheduler_enabled: study.exam_scheduler_enabled || false,
    transit_duration_hours: study.transit_duration_hours || 4,
    transit_cost_one_way: study.transit_cost_one_way || 200,
    accommodation_cost_per_night: study.accommodation_cost_per_night || 2000,
    // Convert HH:MM:SS to HH:MM for display, empty string if null
    earliest_arrival_time: study.earliest_arrival_time
      ? study.earliest_arrival_time.substring(0, 5)
      : "",
    is_url: study.is_url || "",
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(study.logo_url || null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

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
        const fileExt = logoFile.name.split(".").pop()
        const { data: { user } } = await supabase.auth.getUser()
        const fileName = `${user?.id}/${study.id}-${Date.now()}.${fileExt}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("study-logos")
          .upload(fileName, logoFile)

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
        logoUrl = undefined
      }

      const { error: updateError } = await supabase
        .from("studies")
        .update({
          ...formData,
          end_year: formData.end_year || null,
          logo_url: logoUrl,
          // Store as null if empty, otherwise as time string
          earliest_arrival_time: formData.earliest_arrival_time || null,
          is_url: formData.is_url || null,
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

  const handleDeleteStudy = async () => {
    setDeleting(true)
    setError(null)

    try {
      // First delete all subjects
      const { error: subjectsError } = await supabase
        .from("subjects")
        .delete()
        .eq("study_id", study.id)

      if (subjectsError) throw subjectsError

      // Delete the logo from storage if it exists
      if (study.logo_url) {
        const urlParts = study.logo_url.split("/")
        const bucketIndex = urlParts.findIndex(part => part === "study-logos")
        if (bucketIndex !== -1 && bucketIndex + 1 < urlParts.length) {
          const logoPath = urlParts.slice(bucketIndex + 1).join("/")
          await supabase.storage.from("study-logos").remove([logoPath])
        }
      }

      // Then delete the study
      const { error: studyError } = await supabase
        .from("studies")
        .delete()
        .eq("id", study.id)

      if (studyError) throw studyError

      // Navigate back to dashboard
      router.push("/")
    } catch (err) {
      console.error("Delete study error:", err)
      setError(err instanceof Error ? err.message : "Nastala chyba při mazání studia")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 p-4">
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
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
                      className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 file:cursor-pointer"
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
                      {getStudyTypeOptions().map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
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
                      {getStudyFormOptions().map((form) => (
                        <SelectItem key={form} value={form}>{getStudyFormLabel(form)}</SelectItem>
                      ))}
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
                    onValueChange={(value) => setFormData({ ...formData, status: value as StudyStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte stav studia" />
                    </SelectTrigger>
                    <SelectContent>
                      {getStudyStatusOptions().map((status) => (
                        <SelectItem key={status} value={status}>{getStudyStatusLabel(status)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* IS URL */}
              <div className="space-y-2">
                <Label htmlFor="is_url">URL stránky v informačním systému</Label>
                <Input
                  id="is_url"
                  type="url"
                  value={formData.is_url}
                  onChange={(e) => setFormData({ ...formData, is_url: e.target.value })}
                  placeholder="https://is.muni.cz/studium/..."
                />
                <p className="text-xs text-gray-500">Odkaz na stránku studia v informačním systému školy (volitelné)</p>
              </div>

              {/* Final Exams Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-primary-50/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="final-exams" className="text-base font-medium">
                      Státní závěrečné zkoušky
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Zobrazit sekci pro státní závěrečné zkoušky v tomto studiu
                    </p>
                  </div>
                  <Switch
                    id="final-exams"
                    checked={formData.final_exams_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, final_exams_enabled: checked })
                    }
                  />
                </div>
              </div>

              {/* Exam Scheduler Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-primary-50/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="exam-scheduler" className="text-base font-medium">
                      Plánovač zkoušek
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Automatický plánovač optimálních termínů zkoušek
                    </p>
                  </div>
                  <Switch
                    id="exam-scheduler"
                    checked={formData.exam_scheduler_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, exam_scheduler_enabled: checked })
                    }
                  />
                </div>

                {/* Scheduler Configuration - only show when enabled */}
                {formData.exam_scheduler_enabled && (
                  <div className="p-4 border rounded-lg bg-primary-50/30 space-y-4">
                    <p className="text-sm font-medium text-gray-700">Nastavení plánovače</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="transit_duration">Doba cesty (hodiny)</Label>
                        <Input
                          id="transit_duration"
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="12"
                          value={formData.transit_duration_hours}
                          onChange={(e) => setFormData({
                            ...formData,
                            transit_duration_hours: parseFloat(e.target.value) || 4
                          })}
                        />
                        <p className="text-xs text-gray-500">Jednosměrná cesta do školy</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="earliest_arrival">Nejdřívější příjezd</Label>
                        <Input
                          id="earliest_arrival"
                          type="time"
                          value={formData.earliest_arrival_time}
                          onChange={(e) => setFormData({
                            ...formData,
                            earliest_arrival_time: e.target.value
                          })}
                          placeholder="08:50"
                        />
                        <p className="text-xs text-gray-500">Kdy nejdříve můžete být ve škole (volitelné)</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="transit_cost">Cena cesty (Kč)</Label>
                        <Input
                          id="transit_cost"
                          type="number"
                          min="0"
                          value={formData.transit_cost_one_way}
                          onChange={(e) => setFormData({
                            ...formData,
                            transit_cost_one_way: parseInt(e.target.value) || 0
                          })}
                        />
                        <p className="text-xs text-gray-500">Jednosměrná cesta</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accommodation_cost">Ubytování/noc (Kč)</Label>
                        <Input
                          id="accommodation_cost"
                          type="number"
                          min="0"
                          value={formData.accommodation_cost_per_night}
                          onChange={(e) => setFormData({
                            ...formData,
                            accommodation_cost_per_night: parseInt(e.target.value) || 0
                          })}
                        />
                        <p className="text-xs text-gray-500">Cena za noc u školy</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
                >
                  {loading ? "Ukládání..." : "Uložit změny"}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Zrušit
                </Button>
              </div>
            </form>

            {/* Danger Zone */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                <h3 className="text-lg font-semibold text-red-900 mb-2">Nebezpečná zóna</h3>
                <p className="text-sm text-red-700 mb-4">
                  Smazání studia je nevratné. Budou odstraněny všechny předměty a veškerá data spojená s tímto studiem včetně nahraného loga.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={deleting}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deleting ? "Mazání..." : "Smazat studium"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Opravdu chcete smazat toto studium?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tato akce je nevratná. Studium &quot;{study.name}&quot; a všechny jeho předměty budou trvale odstraněny.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Zrušit</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteStudy}
                        className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                      >
                        Smazat studium
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
