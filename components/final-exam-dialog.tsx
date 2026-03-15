"use client"

import { useState } from "react"
import { createFinalExam, updateFinalExamAction } from "@/lib/actions/final-exams"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { FinalExam } from "@/lib/constants"

interface FinalExamDialogProps {
  studyId: string
  exam?: FinalExam | null
  onClose: () => void
  onSave: () => void
}

const GRADES = ["A", "B", "C", "D", "E", "F", "N"]

export function FinalExamDialog({ studyId, exam, onClose, onSave }: FinalExamDialogProps) {
  const [formData, setFormData] = useState({
    shortcut: exam?.shortcut || "",
    name: exam?.name || "",
    grade: exam?.grade || "none",
    exam_date: exam?.exam_date || "",
    examiner: exam?.examiner || "",
    examination_committee_head: exam?.examination_committee_head || "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const data = {
        ...formData,
        study_id: studyId,
        shortcut: formData.shortcut || null,
        grade: formData.grade === "none" ? null : formData.grade || null,
        exam_date: formData.exam_date || null,
        examiner: formData.examiner || null,
        examination_committee_head: formData.examination_committee_head || null,
      }

      if (exam) {
        const { error: updateError } = await updateFinalExamAction(exam.id, data)
        if (updateError) throw new Error(updateError.message)
      } else {
        const result = await createFinalExam(data)
        if (result.error) throw new Error(result.error.message)
      }

      onSave()
    } catch (err) {
      console.error("Error saving final exam:", err)
      setError(err instanceof Error ? err.message : "Nastala chyba při ukládání")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {exam ? "Upravit předmět SZZ" : "Přidat předmět SZZ"}
            </DialogTitle>
            <DialogDescription>
              {exam 
                ? "Upravte informace o předmětu státní závěrečné zkoušky" 
                : "Vyplňte informace o novém předmětu státní závěrečné zkoušky"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <Label htmlFor="shortcut">Zkratka</Label>
                <Input
                  id="shortcut"
                  value={formData.shortcut}
                  onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                  placeholder="SZZ1"
                />
              </div>
              <div className="col-span-3">
                <Label htmlFor="name">Název předmětu *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="např. Obhajoba diplomové práce"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="grade">Hodnocení</Label>
                <Select
                  value={formData.grade}
                  onValueChange={(value) => setFormData({ ...formData, grade: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte hodnocení" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bez hodnocení</SelectItem>
                    {GRADES.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="exam_date">Datum zkoušky</Label>
                <Input
                  id="exam_date"
                  type="date"
                  value={formData.exam_date}
                  onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="examiner">Zkoušející</Label>
              <Input
                id="examiner"
                value={formData.examiner}
                onChange={(e) => setFormData({ ...formData, examiner: e.target.value })}
                placeholder="např. doc. Ing. Jan Novák, Ph.D."
              />
            </div>

            <div>
              <Label htmlFor="examination_committee_head">Předseda zkušební komise</Label>
              <Input
                id="examination_committee_head"
                value={formData.examination_committee_head}
                onChange={(e) => setFormData({ ...formData, examination_committee_head: e.target.value })}
                placeholder="např. prof. Ing. Petr Dvořák, CSc."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Zrušit
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
            >
              {loading ? "Ukládání..." : exam ? "Uložit změny" : "Přidat předmět"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}