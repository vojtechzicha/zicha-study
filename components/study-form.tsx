"use client"

import React, { useState } from "react"
import { createStudy } from "@/lib/actions/studies"
import { useToast } from "@/hooks/use-toast"
import { getStudyTypeOptions, getStudyFormOptions, getStudyFormLabel, getStudyStatusOptions, getStudyStatusLabel, STUDY_STATUS, type StudyStatus } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface StudyFormProps {
  onClose: () => void
  onSuccess: () => void
}

export function StudyForm({ onClose, onSuccess }: StudyFormProps) {
  const [formData, setFormData] = useState<{
    name: string
    type: string
    form: string
    start_year: number
    end_year: string
    status: StudyStatus
  }>({
    name: "",
    type: "",
    form: "",
    start_year: new Date().getFullYear(),
    end_year: "",
    status: STUDY_STATUS.ACTIVE,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await createStudy({
        name: formData.name,
        type: formData.type,
        form: formData.form,
        start_year: formData.start_year,
        end_year: formData.end_year ? Number.parseInt(formData.end_year) : null,
        status: formData.status,
      })
      toast({
        title: "Studium vytvořeno",
        description: `Studium "${formData.name}" bylo úspěšně vytvořeno.`,
      })
      onSuccess()
    } catch (err: any) {
      let errorMessage = "Chyba při ukládání studia. Zkuste to prosím znovu."

      if (err?.message?.includes("Duplicate") || err?.code === 11000) {
        errorMessage = "Studium s tímto názvem již existuje."
      } else if (err?.message) {
        errorMessage = `Chyba při ukládání: ${err.message}`
      }

      setError(errorMessage)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={onClose} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zpět na přehled
          </Button>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900">Přidat nové studium</CardTitle>
            <CardDescription>Vyplňte základní informace o vašem studiu</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
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
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as StudyStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getStudyStatusOptions().map((status) => (
                      <SelectItem key={status} value={status}>
                        {getStudyStatusLabel(status)}
                      </SelectItem>
                    ))}
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
                  className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? "Ukládání..." : "Uložit studium"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
