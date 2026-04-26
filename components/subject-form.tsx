"use client"

import React, { useState, useEffect } from "react"
import { fetchSubjectsForRepeatSelection, createSubject } from "@/lib/actions/subjects"
import { useToast } from "@/hooks/use-toast"
import { getSubjectTypeOptions } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Save } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SubjectState, isFieldVisibleForState, getSubjectStateText, requiresCredit, requiresExam } from "@/lib/status-utils"
import { DepartmentAutocomplete } from "@/components/department-autocomplete"
import { useDepartments } from "@/hooks/use-departments"

interface Study {
  id: string
  name: string
  type: string
  start_year: number
  end_year?: number
  status: string
}

interface SubjectFormProps {
  study: Study
  onClose: () => void
  onSuccess: () => void
}

export function SubjectForm({ study, onClose, onSuccess }: SubjectFormProps) {
  const [subjectState, setSubjectState] = useState<SubjectState>("planned")
  const [formData, setFormData] = useState({
    semester: "",
    abbreviation: "",
    name: "",
    completion_type: "",
    subject_type: "",
    credits: 0,
    hours: 0,
    points: "",
    grade: "",
    lecturer: "",
    department: "",
    final_date: "",
    is_repeat: false,
    repeats_subject_id: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([])
  const { toast } = useToast()
  const { departments } = useDepartments(study.id)

  // Fetch subjects that can be repeated
  useEffect(() => {
    const loadSubjects = async () => {
      const data = await fetchSubjectsForRepeatSelection(study.id)
      setAvailableSubjects(data)
    }
    loadSubjects()
  }, [study.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Prepare insert data
    const insertData: any = {
      study_id: study.id,
      semester: formData.semester,
      abbreviation: formData.abbreviation || null,
      name: formData.name,
      completion_type: formData.completion_type,
      subject_type: formData.subject_type,
      credits: formData.credits,
      hours: formData.hours || null,
      points: isFieldVisibleForState("points", subjectState) && formData.points ? Number.parseInt(formData.points) : null,
      grade: isFieldVisibleForState("grade", subjectState) ? (formData.grade || null) : null,
      lecturer: formData.lecturer || null,
      department: formData.department || null,
      final_date: isFieldVisibleForState("final_date", subjectState) && formData.final_date ? formData.final_date : null,
      completed: subjectState === "completed",
      planned: subjectState === "planned",
      is_repeat: formData.is_repeat,
      repeats_subject_id: formData.is_repeat && formData.repeats_subject_id ? formData.repeats_subject_id : null,
    }

    // Set credit and exam completion based on state and completion type
    if (subjectState === "completed") {
      // If completed, automatically mark credit and exam as completed if required
      insertData.credit_completed = requiresCredit(formData.completion_type)
      insertData.exam_completed = requiresExam(formData.completion_type)
      // Set final date to today if not provided
      if (!insertData.final_date) {
        insertData.final_date = new Date().toISOString().split('T')[0]
      }
    } else {
      // Otherwise, start with both uncompleted
      insertData.credit_completed = false
      insertData.exam_completed = false
    }

    const result = await createSubject(insertData)

    if (result.error) {
      // Provide more specific error messages based on error code/message
      let errorMessage = "Chyba při ukládání předmětu. Zkuste to prosím znovu."

      if (result.error.code === "23505") {
        errorMessage = "Předmět s touto kombinací názvu a semestru již existuje."
      } else if (result.error.message) {
        errorMessage = `Chyba při ukládání: ${result.error.message}`
      }

      setError(errorMessage)
      setLoading(false)
    } else {
      toast({
        title: "Předmět přidán",
        description: `Předmět "${formData.name}" byl úspěšně přidán.`,
      })
      onSuccess()
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold text-gray-900">
          Přidat nový předmět
        </DialogTitle>
        <DialogDescription className="sr-only">
          Vyplňte údaje o předmětu, nastavte jeho stav a uložte ho do studia.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-6 p-1">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="semester">Semestr *</Label>
            <Select
              value={formData.semester}
              onValueChange={(value) => setFormData({ ...formData, semester: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vyberte semestr" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1. ročník ZS">1. ročník ZS</SelectItem>
                <SelectItem value="1. ročník LS">1. ročník LS</SelectItem>
                <SelectItem value="2. ročník ZS">2. ročník ZS</SelectItem>
                <SelectItem value="2. ročník LS">2. ročník LS</SelectItem>
                <SelectItem value="3. ročník ZS">3. ročník ZS</SelectItem>
                <SelectItem value="3. ročník LS">3. ročník LS</SelectItem>
                <SelectItem value="4. ročník ZS">4. ročník ZS</SelectItem>
                <SelectItem value="4. ročník LS">4. ročník LS</SelectItem>
                <SelectItem value="5. ročník ZS">5. ročník ZS</SelectItem>
                <SelectItem value="5. ročník LS">5. ročník LS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="abbreviation">Zkratka</Label>
            <Input
              id="abbreviation"
              value={formData.abbreviation}
              onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
              placeholder="např. IZP"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Název předmětu *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="celý název předmětu"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="completion_type">Způsob ukončení *</Label>
            <Select
              value={formData.completion_type}
              onValueChange={(value) => setFormData({ ...formData, completion_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vyberte způsob ukončení" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Zápočet (Zp)">Zápočet (Zp)</SelectItem>
                <SelectItem value="Klasifikovaný zápočet (KZp)">Klasifikovaný zápočet (KZp)</SelectItem>
                <SelectItem value="Zkouška (Zk)">Zkouška (Zk)</SelectItem>
                <SelectItem value="Zápočet + Zkouška (Zp+Zk)">Zápočet&nbsp;+&nbsp;Zkouška (Zp+Zk)</SelectItem>
                <SelectItem value="Ostatní">Ostatní</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject_type">Typ předmětu *</Label>
            <Select
              value={formData.subject_type}
              onValueChange={(value) => setFormData({ ...formData, subject_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vyberte typ předmětu" />
              </SelectTrigger>
              <SelectContent>
                {getSubjectTypeOptions().map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="credits">Počet kreditů *</Label>
            <Input
              id="credits"
              type="number"
              value={formData.credits}
              onChange={(e) => setFormData({ ...formData, credits: Number.parseInt(e.target.value) || 0 })}
              min="0"
              max="20"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Počet hodin</Label>
            <Input
              id="hours"
              type="number"
              value={formData.hours}
              onChange={(e) => setFormData({ ...formData, hours: Number.parseInt(e.target.value) || 0 })}
              min="0"
              max="200"
              placeholder="volitelné"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isFieldVisibleForState("points", subjectState) && (
            <div className="space-y-2">
              <Label htmlFor="points">Počet bodů</Label>
              <Input
                id="points"
                type="number"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                min="0"
                max="100"
                placeholder="volitelné"
              />
            </div>
          )}

          {isFieldVisibleForState("grade", subjectState) && (
            <div className="space-y-2">
              <Label htmlFor="grade">Známka</Label>
              <Input
                id="grade"
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                placeholder="např. A, 1, výborně"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="lecturer">Přednášející</Label>
            <Input
              id="lecturer"
              value={formData.lecturer}
              onChange={(e) => setFormData({ ...formData, lecturer: e.target.value })}
              placeholder="jméno hlavního přednášejícího"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="department">Katedra</Label>
          <DepartmentAutocomplete
            value={formData.department}
            onChange={(value) => setFormData({ ...formData, department: value })}
            departments={departments}
            placeholder="Vyberte nebo zadejte katedru..."
          />
        </div>

        {/* Final Date for Completed Subjects */}
        {isFieldVisibleForState("final_date", subjectState) && (
          <div className="space-y-2">
            <Label htmlFor="final_date">Datum ukončení *</Label>
            <Input
              id="final_date"
              type="date"
              value={formData.final_date}
              onChange={(e) => setFormData({ ...formData, final_date: e.target.value })}
              required={subjectState === "completed"}
            />
          </div>
        )}

        {/* Subject State Selector */}
        <div className="space-y-3 p-4 border rounded-lg bg-primary-50">
          <Label className="text-sm font-medium">Stav předmětu</Label>
          <RadioGroup value={subjectState} onValueChange={(value) => setSubjectState(value as SubjectState)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="planned" id="planned" />
              <Label htmlFor="planned" className="cursor-pointer">{getSubjectStateText("planned")}</Label>
              <span className="text-xs text-gray-600">- ještě nebyl zahájen</span>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="active" id="active" />
              <Label htmlFor="active" className="cursor-pointer">{getSubjectStateText("active")}</Label>
              <span className="text-xs text-gray-600">- probíhá</span>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="completed" id="completed" />
              <Label htmlFor="completed" className="cursor-pointer">{getSubjectStateText("completed")}</Label>
              <span className="text-xs text-gray-600">- ukončený</span>
            </div>
          </RadioGroup>
        </div>

        {/* Repeat Subject Section */}
        <div className="space-y-3 p-4 border rounded-lg bg-primary-50">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_repeat"
              checked={formData.is_repeat}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_repeat: checked as boolean, repeats_subject_id: "" })
              }
            />
            <Label htmlFor="is_repeat" className="cursor-pointer text-sm font-medium">
              Opakovaný předmět
            </Label>
          </div>
          {formData.is_repeat && (
            <div className="mt-3 space-y-2">
              <Label htmlFor="repeats_subject_id">Opakuje předmět *</Label>
              <Select
                value={formData.repeats_subject_id}
                onValueChange={(value) => setFormData({ ...formData, repeats_subject_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte předmět, který opakujete" />
                </SelectTrigger>
                <SelectContent>
                  {availableSubjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.semester} - {subject.abbreviation ? `${subject.abbreviation} - ` : ''}{subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-600">
                Opakovaný předmět bude sdílet materiály a studijní zápisy s původním předmětem.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
            Zrušit
          </Button>
          <Button
            type="submit"
            disabled={
              loading ||
              !formData.semester ||
              !formData.name ||
              !formData.completion_type ||
              !formData.subject_type ||
              (subjectState === "completed" && !formData.final_date) ||
              (formData.is_repeat && !formData.repeats_subject_id)
            }
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
