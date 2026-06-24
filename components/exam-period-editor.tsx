"use client"

import React, { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Calendar, Clock, Monitor, Lock, Loader2 } from "lucide-react"
import { EXAM_DURATION_OPTIONS, EXAM_SCHEDULER_DEFAULTS } from "@/lib/constants"
import { useToast } from "@/hooks/use-toast"
import {
  createExamPeriodAction,
  updateExamPeriodAction,
  createExamTermAction,
  updateExamTermAction,
  deleteExamTermAction,
  removeSubjectFromPeriodAction,
} from "@/lib/actions/exam-scheduler"

export interface EditorStudy {
  id: string
  name: string
}

export interface EditorSubject {
  id: string
  study_id: string
  name: string
  abbreviation: string | null
  semester?: string
}

export interface EditorPeriod {
  id: string
  study_id: string
  name: string
  start_date: string
  due_date: string
}

export interface EditorTerm {
  id: string
  period_id: string
  study_id: string
  subject_id: string
  date: string
  start_time: string
  duration_minutes: number
  is_online: boolean
  note: string | null
  locked: boolean
}

interface TermDraft {
  id?: string
  date: string
  start_time: string
  duration_minutes: number
  is_online: boolean
  note: string
  locked: boolean
}

interface SubjectGroup {
  subjectId: string
  terms: TermDraft[]
}

interface ExamPeriodEditorProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  studies: EditorStudy[]
  subjects: EditorSubject[]
  period: EditorPeriod | null // null = create new
  terms: EditorTerm[] // existing terms for the period (empty for new)
  onSaved: () => void
}

function toDraft(t: EditorTerm): TermDraft {
  return {
    id: t.id,
    date: t.date,
    start_time: (t.start_time || "09:00").substring(0, 5),
    duration_minutes: t.duration_minutes,
    is_online: !!t.is_online,
    note: t.note || "",
    locked: !!t.locked,
  }
}

export function ExamPeriodEditor({ open, onOpenChange, studies, subjects, period, terms, onSaved }: ExamPeriodEditorProps) {
  const { toast } = useToast()
  const isNew = !period

  const [studyId, setStudyId] = useState(period?.study_id || studies[0]?.id || "")
  const [name, setName] = useState(period?.name || "")
  const [startDate, setStartDate] = useState(period?.start_date || "")
  const [dueDate, setDueDate] = useState(period?.due_date || "")
  const [saving, setSaving] = useState(false)

  // Group existing terms by subject into editable drafts.
  const initialGroups: SubjectGroup[] = useMemo(() => {
    const map = new Map<string, TermDraft[]>()
    for (const t of terms) {
      const list = map.get(t.subject_id) || []
      list.push(toDraft(t))
      map.set(t.subject_id, list)
    }
    return Array.from(map.entries()).map(([subjectId, ts]) => ({ subjectId, terms: ts }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period?.id])

  const [groups, setGroups] = useState<SubjectGroup[]>(initialGroups)
  // Track original term ids so we can delete removed ones on save.
  const originalTermIds = useMemo(() => new Set(terms.map((t) => t.id)), [period?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const studySubjects = useMemo(
    () => subjects.filter((s) => s.study_id === studyId),
    [subjects, studyId]
  )
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  const usedSubjectIds = new Set(groups.map((g) => g.subjectId))
  const availableSubjects = studySubjects.filter((s) => !usedSubjectIds.has(s.id))

  const addSubjectGroup = (subjectId: string) => {
    if (!subjectId) return
    setGroups((g) => [...g, { subjectId, terms: [] }])
  }

  const removeSubjectGroup = (subjectId: string) => {
    setGroups((g) => g.filter((grp) => grp.subjectId !== subjectId))
  }

  const addTerm = (subjectId: string) => {
    setGroups((g) =>
      g.map((grp) =>
        grp.subjectId === subjectId
          ? {
              ...grp,
              terms: [
                ...grp.terms,
                { date: startDate || "", start_time: "09:00", duration_minutes: EXAM_SCHEDULER_DEFAULTS.DEFAULT_EXAM_DURATION_MINUTES, is_online: false, note: "", locked: false },
              ],
            }
          : grp
      )
    )
  }

  const updateTerm = (subjectId: string, index: number, field: keyof TermDraft, value: string | number | boolean) => {
    setGroups((g) =>
      g.map((grp) => {
        if (grp.subjectId !== subjectId) return grp
        const newTerms = grp.terms.map((t, i) => {
          if (i !== index) return t
          // Only one term per subject can be locked.
          if (field === "locked" && value === true) {
            return { ...t, locked: true }
          }
          return { ...t, [field]: value }
        })
        // Enforce single lock per subject group.
        if (field === "locked" && value === true) {
          return { ...grp, terms: newTerms.map((t, i) => (i === index ? t : { ...t, locked: false })) }
        }
        return { ...grp, terms: newTerms }
      })
    )
  }

  const removeTerm = (subjectId: string, index: number) => {
    setGroups((g) =>
      g.map((grp) => (grp.subjectId === subjectId ? { ...grp, terms: grp.terms.filter((_, i) => i !== index) } : grp))
    )
  }

  const handleSave = async () => {
    if (!studyId || !name.trim() || !startDate || !dueDate) {
      toast({ title: "Vyplňte studium, název a období", variant: "destructive" })
      return
    }
    if (dueDate < startDate) {
      toast({ title: "Konec období je před začátkem", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      // 1. Upsert period.
      let periodId = period?.id
      if (isNew) {
        const res = await createExamPeriodAction({ study_id: studyId, name: name.trim(), start_date: startDate, due_date: dueDate })
        if (res.error || !res.data) {
          toast({ title: "Nepodařilo se vytvořit období", description: res.error?.message, variant: "destructive" })
          setSaving(false)
          return
        }
        periodId = res.data.id
      } else {
        await updateExamPeriodAction(period!.id, { name: name.trim(), start_date: startDate, due_date: dueDate })
      }
      if (!periodId) {
        setSaving(false)
        return
      }

      // 2. Reconcile terms.
      const keptIds = new Set<string>()
      for (const grp of groups) {
        for (const t of grp.terms) {
          if (!t.date) continue // skip incomplete rows
          const payload = {
            period_id: periodId,
            study_id: studyId,
            subject_id: grp.subjectId,
            date: t.date,
            start_time: t.start_time,
            duration_minutes: t.duration_minutes,
            is_online: t.is_online,
            note: t.note || null,
            locked: t.locked,
          }
          if (t.id) {
            keptIds.add(t.id)
            await updateExamTermAction(t.id, payload)
          } else {
            await createExamTermAction(payload)
          }
        }
      }

      // 3. Delete removed terms.
      for (const id of originalTermIds) {
        if (!keptIds.has(id)) {
          await deleteExamTermAction(id)
        }
      }

      // 4. Clean up subject groups that were entirely removed (defensive).
      const remainingSubjects = new Set(groups.map((g) => g.subjectId))
      const originalSubjects = new Set(terms.map((t) => t.subject_id))
      for (const sid of originalSubjects) {
        if (!remainingSubjects.has(sid)) {
          await removeSubjectFromPeriodAction(periodId, sid)
        }
      }

      toast({ title: isNew ? "Období vytvořeno" : "Období uloženo" })
      onSaved()
      onOpenChange(false)
    } catch (err: any) {
      toast({ title: "Chyba při ukládání", description: err?.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nové zkouškové období" : "Upravit zkouškové období"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Period header fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Studium</Label>
              <Select value={studyId} onValueChange={setStudyId} disabled={!isNew}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Vyberte studium" />
                </SelectTrigger>
                <SelectContent>
                  {studies.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Název období</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="např. Zimní zápočty" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Začátek období
              </Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Konec období
              </Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9" />
            </div>
          </div>

          {/* Subjects + terms */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Předměty a termíny</Label>
              {availableSubjects.length > 0 && (
                <Select value="" onValueChange={addSubjectGroup}>
                  <SelectTrigger className="h-9 w-auto min-w-[12rem]">
                    <SelectValue placeholder="+ Přidat předmět" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.abbreviation ? `${s.abbreviation} – ${s.name}` : s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {groups.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                Zatím žádné předměty. Přidejte předmět a jeho možné termíny – plánovač vybere jeden pro každý předmět.
              </p>
            ) : (
              groups.map((grp) => {
                const subj = subjectMap.get(grp.subjectId)
                return (
                  <div key={grp.subjectId} className="border rounded-lg p-3 bg-gray-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-800">
                        {subj ? (subj.abbreviation ? `[${subj.abbreviation}] ${subj.name}` : subj.name) : "Neznámý předmět"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSubjectGroup(grp.subjectId)}
                        className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Odebrat
                      </Button>
                    </div>

                    {grp.terms.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">Žádné termíny</p>
                    ) : (
                      grp.terms.map((term, index) => (
                        <div key={term.id || index} className="p-3 border rounded-lg bg-white space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Datum
                              </Label>
                              <Input
                                type="date"
                                value={term.date}
                                onChange={(e) => updateTerm(grp.subjectId, index, "date", e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Začátek
                              </Label>
                              <Input
                                type="time"
                                value={term.start_time}
                                onChange={(e) => updateTerm(grp.subjectId, index, "start_time", e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Délka</Label>
                              <Select
                                value={term.duration_minutes.toString()}
                                onValueChange={(v) => updateTerm(grp.subjectId, index, "duration_minutes", parseInt(v))}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EXAM_DURATION_OPTIONS.map((d) => (
                                    <SelectItem key={d.value} value={d.value.toString()}>
                                      {d.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs flex items-center gap-1">
                                <Monitor className="h-3 w-3" />
                                Forma
                              </Label>
                              <div className="flex items-center h-9 px-2 border rounded-md bg-white">
                                <Checkbox
                                  id={`online-${grp.subjectId}-${index}`}
                                  checked={term.is_online}
                                  onCheckedChange={(c) => updateTerm(grp.subjectId, index, "is_online", c as boolean)}
                                  className="mr-2"
                                />
                                <Label htmlFor={`online-${grp.subjectId}-${index}`} className="text-sm cursor-pointer">
                                  Online
                                </Label>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <Input
                              value={term.note}
                              onChange={(e) => updateTerm(grp.subjectId, index, "note", e.target.value)}
                              placeholder="volitelná poznámka"
                              className="h-9 flex-1 min-w-[8rem]"
                            />
                            <div className="flex items-center h-9 px-2 border rounded-md bg-white">
                              <Checkbox
                                id={`lock-${grp.subjectId}-${index}`}
                                checked={term.locked}
                                onCheckedChange={(c) => updateTerm(grp.subjectId, index, "locked", c as boolean)}
                                className="mr-2"
                              />
                              <Label htmlFor={`lock-${grp.subjectId}-${index}`} className="text-sm cursor-pointer flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                Zamknout
                              </Label>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTerm(grp.subjectId, index)}
                              className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addTerm(grp.subjectId)}
                      className="w-full border-dashed"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Přidat termín
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Zrušit
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Uložit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
