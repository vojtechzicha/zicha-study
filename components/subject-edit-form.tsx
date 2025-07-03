"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, Save, Trash2 } from "lucide-react"
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
import { SubjectState, isFieldVisibleForState, getSubjectStateText, getSubjectStatus, requiresCredit, requiresExam } from "@/lib/status-utils"

interface Subject {
  id: string
  study_id: string
  semester: string
  abbreviation: string
  name: string
  completion_type: string
  subject_type: string
  credits: number
  hours?: number
  points?: number
  grade?: string
  lecturer?: string
  department?: string
  completed: boolean
  exam_completed: boolean
  credit_completed: boolean
  planned?: boolean
  final_date?: string
  created_at: string
}

interface SubjectEditFormProps {
  subject: Subject
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function SubjectEditForm({ subject, open, onClose, onSuccess }: SubjectEditFormProps) {
  const [subjectState, setSubjectState] = useState<SubjectState>(getSubjectStatus(subject))
  const [formData, setFormData] = useState({
    semester: subject.semester,
    abbreviation: subject.abbreviation,
    name: subject.name,
    completion_type: subject.completion_type,
    subject_type: subject.subject_type,
    credits: subject.credits,
    hours: subject.hours || 0,
    points: subject.points?.toString() || "",
    grade: subject.grade || "",
    lecturer: subject.lecturer || "",
    department: subject.department || "",
    final_date: subject.final_date || "",
    credit_completed: subject.credit_completed,
    exam_completed: subject.exam_completed,
  })
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Prepare update data
    const updateData: any = {
      semester: formData.semester,
      abbreviation: formData.abbreviation,
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
    }

    // If marking as completed, automatically mark credit and exam as completed if required
    if (subjectState === "completed") {
      if (requiresCredit(formData.completion_type)) {
        updateData.credit_completed = true
      }
      if (requiresExam(formData.completion_type)) {
        updateData.exam_completed = true
      }
      // Set final date to today if not provided
      if (!updateData.final_date) {
        updateData.final_date = new Date().toISOString().split('T')[0]
      }
    } else if (subjectState === "active") {
      // For active subjects, preserve the checkbox states
      updateData.exam_completed = formData.exam_completed
      updateData.credit_completed = formData.credit_completed
    } else {
      // For planned subjects, clear completion fields
      updateData.exam_completed = false
      updateData.credit_completed = false
    }

    const { error } = await supabase
      .from("subjects")
      .update(updateData)
      .eq("id", subject.id)

    if (error) {
      setError("Chyba při ukládání předmětu. Zkuste to prosím znovu.")
      setLoading(false)
    } else {
      onSuccess()
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    const { error } = await supabase.from("subjects").delete().eq("id", subject.id)

    if (error) {
      setError("Chyba při mazání předmětu. Zkuste to prosím znovu.")
      setDeleting(false)
    } else {
      onSuccess()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Úprava předmětu {subject.abbreviation}
          </DialogTitle>
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
                  <Label htmlFor="abbreviation">Zkratka *</Label>
                  <Input
                    id="abbreviation"
                    value={formData.abbreviation}
                    onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                    placeholder="např. IZP"
                    required
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
                      <SelectItem value="Povinný">Povinný</SelectItem>
                      <SelectItem value="Povinně volitelný">Povinně volitelný</SelectItem>
                      <SelectItem value="Volitelný">Volitelný</SelectItem>
                      <SelectItem value="Ostatní">Ostatní</SelectItem>
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
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="název katedry"
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
              <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
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

              {/* Credit and Exam Completion Toggles */}
              {subjectState === "active" && (
                <div className="space-y-3 p-4 border rounded-lg bg-blue-50">
                  <Label className="text-sm font-medium">Průběžné plnění</Label>
                  <div className="space-y-3">
                    {requiresCredit(formData.completion_type) && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="credit_completed"
                          checked={formData.credit_completed}
                          onCheckedChange={(checked) => 
                            setFormData({ ...formData, credit_completed: checked as boolean })
                          }
                          className="peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          style={formData.credit_completed ? {
                            backgroundColor: 'rgb(37, 99, 235)',
                            borderColor: 'rgb(37, 99, 235)',
                            color: 'white'
                          } : {}}
                        />
                        <Label htmlFor="credit_completed" className="cursor-pointer">
                          Zápočet splněn
                        </Label>
                      </div>
                    )}
                    {requiresExam(formData.completion_type) && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="exam_completed"
                          checked={formData.exam_completed}
                          onCheckedChange={(checked) => 
                            setFormData({ ...formData, exam_completed: checked as boolean })
                          }
                          className="peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          style={formData.exam_completed ? {
                            backgroundColor: 'rgb(37, 99, 235)',
                            borderColor: 'rgb(37, 99, 235)',
                            color: 'white'
                          } : {}}
                        />
                        <Label htmlFor="exam_completed" className="cursor-pointer">
                          Zkouška splněna
                        </Label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
                  Zrušit
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" disabled={deleting}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deleting ? "Mazání..." : "Smazat"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Smazat předmět?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Opravdu chcete smazat předmět "{subject.name}"? Tato akce je nevratná.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Zrušit</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                        Smazat
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button
                  type="submit"
                  disabled={
                    loading ||
                    !formData.semester ||
                    !formData.abbreviation ||
                    !formData.name ||
                    !formData.completion_type ||
                    !formData.subject_type ||
                    (subjectState === "completed" && !formData.final_date)
                  }
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? "Ukládání..." : "Uložit změny"}
                </Button>
              </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}