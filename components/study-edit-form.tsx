"use client"

import React, { useState } from "react"
import { updateStudy, deleteStudyAction } from "@/lib/actions/studies"
import { uploadLogo, removeLogo as removeLogoAction } from "@/lib/actions/logos"
import { uploadDiploma, removeDiploma as removeDiplomaAction } from "@/lib/actions/diplomas"
import { getStudyTypeOptions, getStudyFormOptions, getStudyFormLabel, getStudyStatusOptions, getStudyStatusLabel, getGraduationResultOptions, getGraduationResultLabel, STUDY_STATUS, EXAM_SCHEDULER_DEFAULTS, DEFAULT_WORKING_DAYS, WEEKDAY_OPTIONS, type StudyStatus } from "@/lib/constants"
import { getStudyTerminology } from "@/lib/study-kind"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Upload, X, Trash2, Award, FileText } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TitlePageFooter } from "@/components/title-page-footer"
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
  graduation_result?: string | null
  logo_url?: string
  diploma_url?: string | null
  diploma_mime_type?: string
  diploma_uploaded_at?: string
  final_exams_enabled?: boolean
  exam_scheduler_enabled?: boolean
  tasks_enabled?: boolean
  transit_duration_hours?: number
  transit_cost_one_way?: number
  accommodation_cost_per_night?: number
  earliest_arrival_time?: string | null
  prefer_free_day_exams?: boolean
  pto_day_cost?: number
  working_days?: number[]
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
    graduation_result: study.graduation_result || "",
    final_exams_enabled: study.final_exams_enabled || false,
    exam_scheduler_enabled: study.exam_scheduler_enabled || false,
    tasks_enabled: study.tasks_enabled || false,
    transit_duration_hours: study.transit_duration_hours || 4,
    transit_cost_one_way: study.transit_cost_one_way || 200,
    accommodation_cost_per_night: study.accommodation_cost_per_night || 2000,
    prefer_free_day_exams: study.prefer_free_day_exams || false,
    pto_day_cost: study.pto_day_cost ?? EXAM_SCHEDULER_DEFAULTS.PTO_DAY_COST,
    working_days:
      study.working_days && study.working_days.length > 0
        ? study.working_days
        : [...DEFAULT_WORKING_DAYS],
    // Stored as HH:MM:SS; the time input expects HH:MM (empty when unset)
    earliest_arrival_time: study.earliest_arrival_time
      ? study.earliest_arrival_time.substring(0, 5)
      : "",
    is_url: study.is_url || "",
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(study.logo_url || null)
  const [diplomaFile, setDiplomaFile] = useState<File | null>(null)
  const [diplomaUrl, setDiplomaUrl] = useState<string | null>(study.diploma_url || null)
  const [diplomaMime, setDiplomaMime] = useState<string | null>(study.diploma_mime_type || null)
  const [diplomaFileName, setDiplomaFileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Logo musí být menší než 5 MB.")
        return
      }
      if (!file.type.startsWith("image/")) {
        setError("Logo musí být obrázek.")
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

  const handleDiplomaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const diplomaNoun = getStudyTerminology(formData.type).diplomaNoun
      if (file.size > 10 * 1024 * 1024) {
        setError(`${diplomaNoun} musí být menší než 10 MB.`)
        return
      }
      const isPdf = file.type === "application/pdf"
      const isImage = file.type.startsWith("image/")
      if (!isPdf && !isImage) {
        setError(`${diplomaNoun} musí být PDF nebo obrázek.`)
        return
      }
      setDiplomaFile(file)
      setDiplomaMime(file.type)
      setDiplomaFileName(file.name)
      if (isImage) {
        const reader = new FileReader()
        reader.onload = (e) => setDiplomaUrl(e.target?.result as string)
        reader.readAsDataURL(file)
      } else {
        setDiplomaUrl("pending")
      }
      setError(null)
    }
  }

  const removeDiplomaLocal = () => {
    setDiplomaFile(null)
    setDiplomaUrl(null)
    setDiplomaMime(null)
    setDiplomaFileName(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let logoUrl: string | undefined = study.logo_url

      if (logoFile) {
        const arrayBuffer = await logoFile.arrayBuffer()
        logoUrl = await uploadLogo(study.id, arrayBuffer, logoFile.type)
      } else if (logoPreview === null && study.logo_url) {
        await removeLogoAction(study.id)
        logoUrl = undefined
      }

      if (diplomaFile) {
        const arrayBuffer = await diplomaFile.arrayBuffer()
        await uploadDiploma(study.id, arrayBuffer, diplomaFile.type)
      } else if (diplomaUrl === null && study.diploma_url) {
        await removeDiplomaAction(study.id)
      }

      await updateStudy(study.id, {
        ...formData,
        end_year: formData.end_year || null,
        // Graduation result only applies to completed studies; clear it otherwise
        graduation_result:
          formData.status === STUDY_STATUS.COMPLETED ? formData.graduation_result || null : null,
        logo_url: logoUrl,
        earliest_arrival_time: formData.earliest_arrival_time || null,
        is_url: formData.is_url || null,
      })

      onSuccess()
    } catch (err) {
      console.error("Upload error:", err)
      setError(err instanceof Error ? err.message : "Nepodařilo se uložit studium.")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteStudy = async () => {
    setDeleting(true)
    setError(null)

    try {
      await deleteStudyAction(study.id)

      router.push("/")
    } catch (err) {
      console.error("Delete study error:", err)
      setError(err instanceof Error ? err.message : "Nepodařilo se smazat studium.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-950 dark:to-background p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Zpět">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="text-2xl font-bold text-foreground">Upravit studium</CardTitle>
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

              <div className="space-y-2">
                <Label>Logo fakulty</Label>
                <div className="flex items-start gap-4">
                  {logoPreview ? (
                    <div className="relative flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoPreview || "/placeholder.svg"}
                        alt="Náhled loga"
                        className="w-16 h-16 object-contain border rounded"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0"
                        onClick={removeLogo}
                        aria-label="Odebrat logo"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 border-2 border-dashed border-border rounded flex items-center justify-center flex-shrink-0">
                      <Upload className="h-6 w-6 text-muted-foreground/70" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-950 dark:file:text-primary-300 dark:hover:file:bg-primary-900/60 file:cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF do 5 MB</p>
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

                {formData.status === STUDY_STATUS.COMPLETED && (
                  <div className="space-y-2">
                    <Label htmlFor="graduation_result">Výsledek studia</Label>
                    <Select
                      value={formData.graduation_result || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, graduation_result: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte výsledek" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Neuvedeno</SelectItem>
                        {getGraduationResultOptions().map((result) => (
                          <SelectItem key={result} value={result}>{getGraduationResultLabel(result)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      „S vyznamenáním“ zobrazí {getStudyTerminology(formData.type).diplomaNoun.toLowerCase()} ve slavnostním červeném provedení.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <Label>{getStudyTerminology(formData.type).diplomaNoun}</Label>
                  {formData.status !== "completed" && (
                    <span className="text-xs text-muted-foreground">
                      (zobrazí se po dokončení studia)
                    </span>
                  )}
                </div>
                <div className="flex items-start gap-4">
                  {diplomaUrl ? (
                    <div className="relative flex-shrink-0">
                      {diplomaMime?.startsWith("image/") && diplomaUrl !== "pending" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={diplomaUrl}
                          alt={`${getStudyTerminology(formData.type).diplomaNoun} – náhled`}
                          className="w-20 h-20 object-cover border border-amber-200 dark:border-amber-800 rounded shadow-sm"
                        />
                      ) : (
                        <div className="w-20 h-20 flex flex-col items-center justify-center border border-amber-200 dark:border-amber-800 rounded bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/40 shadow-sm">
                          <FileText className="h-7 w-7 text-amber-700 dark:text-amber-300" />
                          <span className="text-[10px] mt-1 font-medium text-amber-900 dark:text-amber-200">PDF</span>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0"
                        onClick={removeDiplomaLocal}
                        aria-label={`Odebrat ${getStudyTerminology(formData.type).diplomaNoun.toLowerCase()}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 border-2 border-dashed border-amber-300 dark:border-amber-700 rounded flex items-center justify-center flex-shrink-0 bg-amber-50/50 dark:bg-amber-950/30">
                      <Award className="h-7 w-7 text-amber-500 dark:text-amber-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={handleDiplomaChange}
                      className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-800 hover:file:bg-amber-100 dark:file:bg-amber-950/40 dark:file:text-amber-200 dark:hover:file:bg-amber-900/40 file:cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {diplomaFileName ? (
                        <span className="text-amber-700 dark:text-amber-300 font-medium">{diplomaFileName}</span>
                      ) : (
                        "PDF nebo obrázek do 10 MB"
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="is_url">Stránka studia v informačním systému</Label>
                <Input
                  id="is_url"
                  type="url"
                  value={formData.is_url}
                  onChange={(e) => setFormData({ ...formData, is_url: e.target.value })}
                  placeholder="https://is.muni.cz/studium/…"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-primary-50/50 dark:bg-primary-950/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="final-exams" className="text-base font-medium">
                      {getStudyTerminology(formData.type).finalExamToggleLabel}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {getStudyTerminology(formData.type).finalExamToggleDescription}
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

              <div className="space-y-2">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-primary-50/50 dark:bg-primary-950/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="tasks-enabled" className="text-base font-medium">
                      Úkoly
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Termíny a úkoly ke studiu. Vidíte je jen vy.
                    </p>
                  </div>
                  <Switch
                    id="tasks-enabled"
                    checked={formData.tasks_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, tasks_enabled: checked })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-primary-50/50 dark:bg-primary-950/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="exam-scheduler" className="text-base font-medium">
                      Plánovač zkoušek
                    </Label>
                    {formData.status !== STUDY_STATUS.ACTIVE && (
                      <p className="text-sm text-muted-foreground">Plánovač lze zapnout jen u aktivního studia.</p>
                    )}
                  </div>
                  <Switch
                    id="exam-scheduler"
                    checked={formData.exam_scheduler_enabled && formData.status === STUDY_STATUS.ACTIVE}
                    disabled={formData.status !== STUDY_STATUS.ACTIVE}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, exam_scheduler_enabled: checked })
                    }
                  />
                </div>

                {formData.exam_scheduler_enabled && formData.status === STUDY_STATUS.ACTIVE && (
                  <div className="p-4 border rounded-lg bg-primary-50/30 dark:bg-primary-950/40 space-y-4">
                    <p className="text-sm font-medium text-foreground/80">Doprava a ubytování</p>
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
                        <p className="text-xs text-muted-foreground">Jedním směrem.</p>
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
                        <p className="text-xs text-muted-foreground">Kdy nejdříve můžete být ve škole.</p>
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
                        <p className="text-xs text-muted-foreground">Jedním směrem.</p>
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
                      </div>
                    </div>

                    <div className="pt-2 border-t border-primary-100 dark:border-primary-900 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5 pr-4">
                          <Label htmlFor="prefer-free-day" className="text-sm font-medium">
                            Upřednostnit volné dny
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Prezenční zkouška v pracovní den znamená dovolenou. Plánovač takové termíny penalizuje a dá přednost volným dnům, pokud se to vyplatí.
                          </p>
                        </div>
                        <Switch
                          id="prefer-free-day"
                          checked={formData.prefer_free_day_exams}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, prefer_free_day_exams: checked })
                          }
                        />
                      </div>

                      {formData.prefer_free_day_exams && (
                        <div className="space-y-4">
                          <div className="space-y-2 max-w-xs">
                            <Label htmlFor="pto_day_cost">Cena dne dovolené (Kč)</Label>
                            <Input
                              id="pto_day_cost"
                              type="number"
                              min="0"
                              step="100"
                              value={formData.pto_day_cost}
                              onChange={(e) => setFormData({
                                ...formData,
                                pto_day_cost: parseInt(e.target.value) || 0
                              })}
                            />
                            <p className="text-xs text-muted-foreground">Čím vyšší cena, tím víc plánovač upřednostní volné dny.</p>
                          </div>

                          <div className="space-y-2">
                            <Label>Pracovní dny</Label>
                            <div className="flex flex-wrap gap-2">
                              {WEEKDAY_OPTIONS.map((day) => {
                                const selected = formData.working_days.includes(day.value)
                                return (
                                  <button
                                    key={day.value}
                                    type="button"
                                    onClick={() => {
                                      const next = selected
                                        ? formData.working_days.filter((d) => d !== day.value)
                                        : [...formData.working_days, day.value]
                                      setFormData({ ...formData, working_days: next })
                                    }}
                                    className={`w-11 h-10 rounded-md border text-sm font-medium transition-colors ${
                                      selected
                                        ? "bg-primary-600 text-white border-primary-600 hover:bg-primary-700"
                                        : "bg-card text-muted-foreground border-border hover:bg-primary-50 dark:hover:bg-primary-900/40"
                                    }`}
                                  >
                                    {day.label}
                                  </button>
                                )
                              })}
                            </div>
                            <p className="text-xs text-muted-foreground">Zkoušky v ostatních dnech plánovač nepenalizuje.</p>
                          </div>
                        </div>
                      )}
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
                  {loading ? "Ukládání…" : "Uložit změny"}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Zrušit
                </Button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-border">
              <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/40">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Nebezpečná zóna</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                  Smaže se studium včetně všech předmětů, dat a loga.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={deleting}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deleting ? "Mazání…" : "Smazat studium"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Smazat studium?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Studium „{study.name}“ a všechna jeho data se trvale smažou.
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
      <TitlePageFooter />
    </div>
  )
}
