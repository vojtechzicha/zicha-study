"use client"

import React, { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Calendar, Clock, Monitor, Lock, Loader2 } from "lucide-react"
import {
  EXAM_DURATION_OPTIONS,
  EXAM_SCHEDULER_DEFAULTS,
  EXAM_TERM_PARTS,
  EXAM_TERM_PART_LABELS,
  EXAM_PART_ORDERS,
  EXAM_PART_ORDER_LABELS,
  getExamTermPart,
  type ExamTermPart,
  type ExamPartOrder,
  type ExamPartsConfig,
} from "@/lib/constants"
import { sortSubjects, getUniqueSemestersSorted } from "@/lib/utils/subject-utils"
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
  subject_type?: string
  completed?: boolean
  planned?: boolean
}

export interface EditorPeriod {
  id: string
  study_id: string
  name: string
  start_date: string
  due_date: string
  subject_ids?: string[]
  exam_parts?: Record<string, ExamPartsConfig>
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
  part?: ExamTermPart
}

interface TermDraft {
  id?: string
  date: string
  start_time: string
  duration_minutes: number
  is_online: boolean
  note: string
  locked: boolean
  part: ExamTermPart
}

interface SubjectGroup {
  subjectId: string
  terms: TermDraft[]
  // Set when the written and oral part are registered separately.
  parts: ExamPartsConfig | null
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
    part: getExamTermPart(t),
  }
}

// Terms that can't be locked together with `term`: any other term of a plain
// subject; for a split subject, a combined term excludes all others and a
// written/oral term excludes combined terms and other terms of its part.
function locksConflict(term: TermDraft, other: TermDraft, split: boolean): boolean {
  if (!split) return true
  if (term.part === EXAM_TERM_PARTS.COMBINED || other.part === EXAM_TERM_PARTS.COMBINED) return true
  return term.part === other.part
}

function keepLock(terms: TermDraft[], index: number, split: boolean): TermDraft[] {
  const kept = terms[index]
  return terms.map((t, i) => (i !== index && t.locked && locksConflict(kept, t, split) ? { ...t, locked: false } : t))
}

export function ExamPeriodEditor({ open, onOpenChange, studies, subjects, period, terms, onSaved }: ExamPeriodEditorProps) {
  const { toast } = useToast()
  const isNew = !period

  const [studyId, setStudyId] = useState(period?.study_id || studies[0]?.id || "")
  const [name, setName] = useState(period?.name || "")
  const [startDate, setStartDate] = useState(period?.start_date || "")
  const [dueDate, setDueDate] = useState(period?.due_date || "")
  const [saving, setSaving] = useState(false)

  // Group existing terms by subject into editable drafts. Subjects stored on
  // the period without any terms yet get an empty group so they survive edits.
  const initialGroups: SubjectGroup[] = useMemo(() => {
    const map = new Map<string, TermDraft[]>()
    for (const sid of period?.subject_ids || []) {
      map.set(sid, [])
    }
    for (const t of terms) {
      const list = map.get(t.subject_id) || []
      list.push(toDraft(t))
      map.set(t.subject_id, list)
    }
    return Array.from(map.entries()).map(([subjectId, ts]) => ({
      subjectId,
      terms: ts,
      parts: period?.exam_parts?.[subjectId] ?? null,
    }))
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
  // Completed subjects (passed or failed) no longer need exam terms, so hide them.
  const availableSubjects = studySubjects.filter((s) => !usedSubjectIds.has(s.id) && !s.completed)

  // Group available subjects by semester (in study order) and sort each group
  // the same way as the subject table on the study detail page.
  const availableSubjectGroups = useMemo(() => {
    const normalized = availableSubjects.map((s) => ({
      ...s,
      semester: s.semester || "",
      subject_type: s.subject_type || "",
      completed: !!s.completed,
    }))
    return getUniqueSemestersSorted(normalized).map((semester) => ({
      semester,
      subjects: sortSubjects(normalized.filter((s) => s.semester === semester)),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studySubjects, groups])

  const addSubjectGroup = (subjectId: string) => {
    if (!subjectId) return
    setGroups((g) => [...g, { subjectId, terms: [], parts: null }])
  }

  const removeSubjectGroup = (subjectId: string) => {
    setGroups((g) => g.filter((grp) => grp.subjectId !== subjectId))
  }

  const setSplit = (subjectId: string, split: boolean) => {
    setGroups((g) =>
      g.map((grp) => {
        if (grp.subjectId !== subjectId) return grp
        if (split) return { ...grp, parts: { order: EXAM_PART_ORDERS.WRITTEN_FIRST } }
        // Back to a plain subject: every term is combined and only one may stay locked.
        const firstLocked = grp.terms.findIndex((t) => t.locked)
        return {
          ...grp,
          parts: null,
          terms: grp.terms.map((t, i) => ({ ...t, part: EXAM_TERM_PARTS.COMBINED, locked: i === firstLocked })),
        }
      })
    )
  }

  const setOrder = (subjectId: string, order: ExamPartOrder) => {
    setGroups((g) => g.map((grp) => (grp.subjectId === subjectId ? { ...grp, parts: { order } } : grp)))
  }

  const addTerm = (subjectId: string) => {
    setGroups((g) =>
      g.map((grp) =>
        grp.subjectId === subjectId
          ? {
              ...grp,
              terms: [
                ...grp.terms,
                {
                  date: startDate || "",
                  start_time: "09:00",
                  duration_minutes: EXAM_SCHEDULER_DEFAULTS.DEFAULT_EXAM_DURATION_MINUTES,
                  is_online: false,
                  note: "",
                  locked: false,
                  // Split subjects default to the part of the previous term.
                  part: grp.parts ? (grp.terms[grp.terms.length - 1]?.part ?? EXAM_TERM_PARTS.WRITTEN) : EXAM_TERM_PARTS.COMBINED,
                },
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
        const newTerms = grp.terms.map((t, i) => (i === index ? { ...t, [field]: value } : t))
        // Only one term per subject (per part for split subjects) can be locked.
        if (newTerms[index].locked && (field === "locked" || field === "part")) {
          return { ...grp, terms: keepLock(newTerms, index, !!grp.parts) }
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
      toast({ title: "Vyplňte studium, název, začátek a konec období", variant: "destructive" })
      return
    }
    if (dueDate < startDate) {
      toast({ title: "Konec období nemůže být před začátkem", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      // 1. Upsert period. subject_ids keeps subjects that have no terms yet
      // as members of the period, so they don't silently disappear.
      const subjectIds = groups.map((g) => g.subjectId)
      const examParts: Record<string, ExamPartsConfig> = {}
      for (const g of groups) {
        if (g.parts) examParts[g.subjectId] = g.parts
      }
      let periodId = period?.id
      if (isNew) {
        const res = await createExamPeriodAction({ study_id: studyId, name: name.trim(), start_date: startDate, due_date: dueDate, subject_ids: subjectIds, exam_parts: examParts })
        if (res.error || !res.data) {
          toast({ title: "Nepodařilo se vytvořit období", description: res.error?.message, variant: "destructive" })
          setSaving(false)
          return
        }
        periodId = res.data.id
      } else {
        await updateExamPeriodAction(period!.id, { name: name.trim(), start_date: startDate, due_date: dueDate, subject_ids: subjectIds, exam_parts: examParts })
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
            part: grp.parts ? t.part : EXAM_TERM_PARTS.COMBINED,
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
      toast({ title: "Nepodařilo se uložit období", description: err?.message, variant: "destructive" })
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Předměty a termíny</Label>
              {availableSubjects.length > 0 && (
                <Select value="" onValueChange={addSubjectGroup}>
                  <SelectTrigger className="h-9 w-auto min-w-[12rem]">
                    <SelectValue placeholder="+ Přidat předmět" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjectGroups.map((grp) => (
                      <SelectGroup key={grp.semester || "none"}>
                        <SelectLabel>{grp.semester || "Bez semestru"}</SelectLabel>
                        {grp.subjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.abbreviation ? `${s.abbreviation} – ${s.name}` : s.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Zatím žádné předměty. Přidejte předmět a jeho možné termíny, plánovač z nich vybere jeden.
              </p>
            ) : (
              groups.map((grp) => {
                const subj = subjectMap.get(grp.subjectId)
                return (
                  <div key={grp.subjectId} className="border rounded-lg p-3 bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        {subj ? (subj.abbreviation ? `[${subj.abbreviation}] ${subj.name}` : subj.name) : "Neznámý předmět"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSubjectGroup(grp.subjectId)}
                        className="h-8 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Odebrat
                      </Button>
                    </div>

                    {subj?.completed && (
                      <p className="text-xs text-muted-foreground italic">
                        Předmět je dokončený, do rozvrhu se nezahrne.
                      </p>
                    )}

                    {!subj?.completed && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center h-9 px-2 border rounded-md bg-card">
                            <Checkbox
                              id={`split-${grp.subjectId}`}
                              checked={!!grp.parts}
                              onCheckedChange={(c) => setSplit(grp.subjectId, c === true)}
                              className="mr-2"
                            />
                            <Label htmlFor={`split-${grp.subjectId}`} className="text-sm cursor-pointer">
                              Písemná a ústní část zvlášť
                            </Label>
                          </div>
                          {grp.parts && (
                            <Select value={grp.parts.order} onValueChange={(v) => setOrder(grp.subjectId, v as ExamPartOrder)}>
                              <SelectTrigger className="h-9 w-auto min-w-[11rem]" aria-label="Pořadí částí">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.values(EXAM_PART_ORDERS).map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {EXAM_PART_ORDER_LABELS[o]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        {grp.parts && (
                          <p className="text-xs text-muted-foreground">
                            Plánovač vybere buď jeden termín celé zkoušky, nebo termín písemné i ústní části.
                          </p>
                        )}
                      </div>
                    )}

                    {grp.terms.length === 0 ? (
                      !subj?.completed && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                          Zatím žádné termíny. Do rozvrhu se předmět dostane, až nějaké přidáte.
                        </p>
                      )
                    ) : (
                      grp.terms.map((term, index) => (
                        <div key={term.id || index} className="p-3 border rounded-lg bg-card space-y-3">
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
                              <div className="flex items-center h-9 px-2 border rounded-md bg-card">
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
                            {grp.parts && (
                              <Select
                                value={term.part}
                                onValueChange={(v) => updateTerm(grp.subjectId, index, "part", v)}
                              >
                                <SelectTrigger className="h-9 w-auto min-w-[9rem]" aria-label="Část zkoušky">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.values(EXAM_TERM_PARTS).map((p) => (
                                    <SelectItem key={p} value={p}>
                                      {EXAM_TERM_PART_LABELS[p]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Input
                              value={term.note}
                              onChange={(e) => updateTerm(grp.subjectId, index, "note", e.target.value)}
                              placeholder="Poznámka"
                              className="h-9 flex-1 min-w-[8rem]"
                            />
                            <div className="flex items-center h-9 px-2 border rounded-md bg-card">
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
                              aria-label="Odebrat termín"
                              className="h-9 w-9 p-0 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
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
