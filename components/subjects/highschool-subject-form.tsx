"use client"

import React, { useState } from "react"
import { createSubject, updateSubject } from "@/lib/actions/subjects"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Save } from "lucide-react"
import {
  HS_GRADE_VALUES,
  hsGradeLabel,
  getGrade,
  setGrade,
  type HighSchoolGrade,
  type HighSchoolPeriod,
} from "@/lib/highschool/grades"

const NO_GRADE = "none"

export interface HighSchoolSubject {
  id: string
  study_id: string
  name: string
  abbreviation?: string | null
  lecturer?: string | null
  grades?: HighSchoolGrade[] | null
}

interface HighSchoolSubjectFormProps {
  study: { id: string }
  periods: HighSchoolPeriod[]
  /** When provided the form edits an existing subject; otherwise it creates one. */
  subject?: HighSchoolSubject | null
  onClose: () => void
  onSuccess: () => void
}

export function HighSchoolSubjectForm({
  study,
  periods,
  subject,
  onClose,
  onSuccess,
}: HighSchoolSubjectFormProps) {
  const isEdit = Boolean(subject)
  const [name, setName] = useState(subject?.name ?? "")
  const [abbreviation, setAbbreviation] = useState(subject?.abbreviation ?? "")
  const [lecturer, setLecturer] = useState(subject?.lecturer ?? "")
  // Grades keyed by period.key for easy per-cell editing in the form.
  const [grades, setGrades] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const period of periods) {
      initial[period.key] = subject ? getGrade(subject, period.year, period.half) ?? NO_GRADE : NO_GRADE
    }
    return initial
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Build the grades array from the per-period selections.
    let gradeArray: HighSchoolGrade[] = []
    for (const period of periods) {
      const value = grades[period.key]
      if (value && value !== NO_GRADE) {
        gradeArray = setGrade(gradeArray, period.year, period.half, value)
      }
    }

    const data = {
      study_id: study.id,
      name: name.trim(),
      abbreviation: abbreviation.trim() || null,
      lecturer: lecturer.trim() || null,
      grades: gradeArray,
    }

    const result = isEdit
      ? await updateSubject(subject!.id, data)
      : await createSubject(data)

    if (result.error) {
      setError(`Chyba při ukládání: ${result.error.message}`)
      setLoading(false)
      return
    }

    toast({
      title: isEdit ? "Předmět upraven" : "Předmět přidán",
      description: `Předmět „${data.name}" byl úspěšně uložen.`,
    })
    onSuccess()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold text-gray-900">
          {isEdit ? "Upravit předmět" : "Přidat nový předmět"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Vyplňte název předmětu a známky za jednotlivá pololetí.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6 p-1">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="hs-name">Název předmětu *</Label>
          <Input
            id="hs-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="např. Matematika"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="hs-abbreviation">Zkratka</Label>
            <Input
              id="hs-abbreviation"
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value)}
              placeholder="např. M"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hs-lecturer">Vyučující</Label>
            <Input
              id="hs-lecturer"
              value={lecturer}
              onChange={(e) => setLecturer(e.target.value)}
              placeholder="jméno vyučujícího"
            />
          </div>
        </div>

        {/* Per-pololetí grades */}
        <div className="space-y-3 p-4 border rounded-lg bg-primary-50">
          <Label className="text-sm font-medium">Známky za jednotlivá pololetí</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {periods.map((period) => (
              <div key={period.key} className="space-y-1">
                <Label htmlFor={`grade-${period.key}`} className="text-xs text-gray-600">
                  {period.label}
                </Label>
                <Select
                  value={grades[period.key] ?? NO_GRADE}
                  onValueChange={(value) => setGrades((prev) => ({ ...prev, [period.key]: value }))}
                >
                  <SelectTrigger id={`grade-${period.key}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_GRADE}>—</SelectItem>
                    {HS_GRADE_VALUES.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade} – {hsGradeLabel(grade)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
            Zrušit
          </Button>
          <Button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white"
          >
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Ukládání..." : "Uložit předmět"}
          </Button>
        </div>
      </form>
    </>
  )
}
