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
  DEFAULT_EXAM_PART_LABELS,
  MIN_EXAM_PARTS,
  PRE_TERM_LABEL,
  TENTATIVE_TERM_LABEL,
  getTermPartIds,
  type ExamPartsConfig,
  type ExamTermExternal,
} from "@/lib/constants"
import { SyncedTermInfo, isSyncedTerm, type SyncedTerm } from "@/components/synced-term-info"
import { sortSubjects, getUniqueSemestersSorted } from "@/lib/utils/subject-utils"
import { czDayWord } from "@/lib/utils/task-format"
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
  part_ids?: string[]
  is_pre_term?: boolean
  is_tentative?: boolean
  source?: string | null
  external?: ExamTermExternal | null
}

interface TermDraft {
  id?: string
  date: string
  start_time: string
  duration_minutes: number
  is_online: boolean
  note: string
  locked: boolean
  part_ids: string[] // parts covered, in exam order; empty for plain subjects
  is_pre_term: boolean
  is_tentative: boolean
  // Set for a term synced from a university system: its date, time and flags come from there.
  synced: SyncedTerm | null
}

interface SubjectGroup {
  subjectId: string
  terms: TermDraft[]
  // Set when the exam's parts are registered separately.
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

const SYNCED_FIELD_TITLE = "Datum a čas se přebírají z univerzitního systému."

function toDraft(t: EditorTerm, parts: ExamPartsConfig | null): TermDraft {
  return {
    id: t.id,
    date: t.date,
    start_time: (t.start_time || "09:00").substring(0, 5),
    duration_minutes: t.duration_minutes,
    is_online: !!t.is_online,
    note: t.note || "",
    locked: !!t.locked,
    part_ids: getTermPartIds(t, parts),
    is_pre_term: !!t.is_pre_term,
    is_tentative: !!t.is_tentative,
    synced: isSyncedTerm(t) ? { source: t.source, external: t.external } : null,
  }
}

// Locking a term unlocks the terms it can't be combined with: every other term
// of a plain subject, or the terms sharing a part for a split one.
function keepLock(terms: TermDraft[], index: number, split: boolean): TermDraft[] {
  const kept = terms[index]
  return terms.map((t, i) =>
    i !== index && t.locked && (!split || t.part_ids.some((id) => kept.part_ids.includes(id)))
      ? { ...t, locked: false }
      : t
  )
}

function nextPartId(parts: ExamPartsConfig): string {
  const used = new Set(parts.parts.map((p) => p.id))
  let n = parts.parts.length + 1
  while (used.has(`p${n}`)) n++
  return `p${n}`
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
      list.push(toDraft(t, period?.exam_parts?.[t.subject_id] ?? null))
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

  const updateGroup = (subjectId: string, update: (_grp: SubjectGroup) => SubjectGroup) => {
    setGroups((g) => g.map((grp) => (grp.subjectId === subjectId ? update(grp) : grp)))
  }

  const setSplit = (subjectId: string, split: boolean) => {
    updateGroup(subjectId, (grp) => {
      if (split) {
        const parts = DEFAULT_EXAM_PART_LABELS.map((label, i) => ({ id: `p${i + 1}`, label }))
        // Existing terms stay whole exams until parts are picked.
        return {
          ...grp,
          parts: { parts, ordered: true },
          terms: grp.terms.map((t) => ({ ...t, part_ids: parts.map((p) => p.id) })),
        }
      }
      // Back to a plain subject: only one term may stay locked.
      const firstLocked = grp.terms.findIndex((t) => t.locked)
      return {
        ...grp,
        parts: null,
        terms: grp.terms.map((t, i) => ({ ...t, part_ids: [], locked: i === firstLocked })),
      }
    })
  }

  const setMinGapDays = (subjectId: string, value: string) => {
    const days = Math.max(0, Math.min(60, Math.floor(Number(value) || 0)))
    updateGroup(subjectId, (grp) => {
      if (!grp.parts) return grp
      const parts = { ...grp.parts }
      if (days > 0) parts.min_gap_days = days
      else delete parts.min_gap_days
      return { ...grp, parts }
    })
  }

  const setOrdered = (subjectId: string, ordered: boolean) => {
    updateGroup(subjectId, (grp) => (grp.parts ? { ...grp, parts: { ...grp.parts, ordered } } : grp))
  }

  const renamePart = (subjectId: string, partId: string, label: string) => {
    updateGroup(subjectId, (grp) =>
      grp.parts
        ? { ...grp, parts: { ...grp.parts, parts: grp.parts.parts.map((p) => (p.id === partId ? { ...p, label } : p)) } }
        : grp
    )
  }

  const addPart = (subjectId: string) => {
    updateGroup(subjectId, (grp) => {
      if (!grp.parts) return grp
      const part = { id: nextPartId(grp.parts), label: `Část ${grp.parts.parts.length + 1}` }
      return { ...grp, parts: { ...grp.parts, parts: [...grp.parts.parts, part] } }
    })
  }

  const removePart = (subjectId: string, partId: string) => {
    updateGroup(subjectId, (grp) => {
      if (!grp.parts || grp.parts.parts.length <= MIN_EXAM_PARTS) return grp
      return {
        ...grp,
        parts: { ...grp.parts, parts: grp.parts.parts.filter((p) => p.id !== partId) },
        terms: grp.terms.map((t) => ({ ...t, part_ids: t.part_ids.filter((id) => id !== partId) })),
      }
    })
  }

  const toggleTermPart = (subjectId: string, index: number, partId: string) => {
    updateGroup(subjectId, (grp) => {
      if (!grp.parts) return grp
      const order = grp.parts.parts.map((p) => p.id)
      const terms = grp.terms.map((t, i) => {
        if (i !== index) return t
        const ids = t.part_ids.includes(partId) ? t.part_ids.filter((id) => id !== partId) : [...t.part_ids, partId]
        return { ...t, part_ids: order.filter((id) => ids.includes(id)) }
      })
      return { ...grp, terms: terms[index].locked ? keepLock(terms, index, true) : terms }
    })
  }

  const addTerm = (subjectId: string) => {
    updateGroup(subjectId, (grp) => ({
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
          is_pre_term: false,
          is_tentative: false,
          synced: null,
          // Split subjects copy the parts of the previous term (all parts for the first one).
          part_ids: grp.parts
            ? (grp.terms[grp.terms.length - 1]?.part_ids ?? grp.parts.parts.map((p) => p.id))
            : [],
        },
      ],
    }))
  }

  const updateTerm = (subjectId: string, index: number, field: keyof TermDraft, value: string | number | boolean) => {
    updateGroup(subjectId, (grp) => {
      const newTerms = grp.terms.map((t, i) => (i === index ? { ...t, [field]: value } : t))
      // Only one term per subject (per part for split subjects) can be locked.
      if (field === "locked" && value === true) {
        return { ...grp, terms: keepLock(newTerms, index, !!grp.parts) }
      }
      return { ...grp, terms: newTerms }
    })
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
    const splitGroups = groups.filter((g) => g.parts)
    if (splitGroups.some((g) => g.parts!.parts.some((p) => !p.label.trim()))) {
      toast({ title: "Vyplňte názvy všech částí", variant: "destructive" })
      return
    }
    if (splitGroups.some((g) => g.terms.some((t) => t.date && t.part_ids.length === 0))) {
      toast({ title: "Vyberte u každého termínu aspoň jednu část", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      // 1. Upsert period. subject_ids keeps subjects that have no terms yet
      // as members of the period, so they don't silently disappear.
      const subjectIds = groups.map((g) => g.subjectId)
      const examParts: Record<string, ExamPartsConfig> = {}
      for (const g of groups) {
        if (g.parts) {
          examParts[g.subjectId] = { ...g.parts, parts: g.parts.parts.map((p) => ({ ...p, label: p.label.trim() })) }
        }
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
            part_ids: grp.parts ? t.part_ids : [],
            is_pre_term: t.is_pre_term,
            is_tentative: t.is_tentative,
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
                              Zkouška má části
                            </Label>
                          </div>
                          {grp.parts && (
                            <div className="flex items-center h-9 px-2 border rounded-md bg-card">
                              <Checkbox
                                id={`ordered-${grp.subjectId}`}
                                checked={grp.parts.ordered}
                                onCheckedChange={(c) => setOrdered(grp.subjectId, c === true)}
                                className="mr-2"
                              />
                              <Label htmlFor={`ordered-${grp.subjectId}`} className="text-sm cursor-pointer">
                                Závazné pořadí
                              </Label>
                            </div>
                          )}
                          {grp.parts && (
                            <div className="flex items-center gap-2 h-9 px-2 border rounded-md bg-card">
                              <Label htmlFor={`gap-days-${grp.subjectId}`} className="text-sm">
                                Odstup částí
                              </Label>
                              <Input
                                id={`gap-days-${grp.subjectId}`}
                                type="number"
                                min={0}
                                max={60}
                                value={grp.parts.min_gap_days ?? 0}
                                onChange={(e) => setMinGapDays(grp.subjectId, e.target.value)}
                                className="h-7 w-16"
                              />
                              <span className="text-sm text-muted-foreground">{czDayWord(grp.parts.min_gap_days ?? 0)}</span>
                            </div>
                          )}
                        </div>
                        {grp.parts && (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              {grp.parts.parts.map((part, i) => (
                                <div key={part.id} className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}.</span>
                                  <Input
                                    value={part.label}
                                    onChange={(e) => renamePart(grp.subjectId, part.id, e.target.value)}
                                    aria-label={`Název ${i + 1}. části`}
                                    className="h-9 w-32"
                                  />
                                  {grp.parts!.parts.length > MIN_EXAM_PARTS && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removePart(grp.subjectId, part.id)}
                                      aria-label="Odebrat část"
                                      className="h-9 w-9 p-0 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                              <Button type="button" variant="outline" size="sm" onClick={() => addPart(grp.subjectId)} className="h-9">
                                <Plus className="h-4 w-4 mr-1" />
                                Přidat část
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Každá část se naplánuje právě jednou. Termín se všemi částmi je celá zkouška.
                            </p>
                          </>
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
                          {term.synced && <SyncedTermInfo term={term.synced} />}
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
                                disabled={!!term.synced}
                                title={term.synced ? SYNCED_FIELD_TITLE : undefined}
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
                                disabled={!!term.synced}
                                title={term.synced ? SYNCED_FIELD_TITLE : undefined}
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
                              <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Části v termínu">
                                {grp.parts.parts.map((part, i) => {
                                  const selected = term.part_ids.includes(part.id)
                                  return (
                                    <button
                                      key={part.id}
                                      type="button"
                                      aria-pressed={selected}
                                      onClick={() => toggleTermPart(grp.subjectId, index, part.id)}
                                      className={`h-9 px-2.5 rounded-md border text-sm transition-colors ${
                                        selected
                                          ? "bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800"
                                          : "border-border text-muted-foreground hover:bg-muted/60"
                                      }`}
                                    >
                                      {part.label.trim() || `${i + 1}. část`}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                            <Input
                              value={term.note}
                              onChange={(e) => updateTerm(grp.subjectId, index, "note", e.target.value)}
                              placeholder="Poznámka"
                              className="h-9 flex-1 min-w-[8rem]"
                            />
                            <div className="flex items-center h-9 px-2 border rounded-md bg-card">
                              <Checkbox
                                id={`preterm-${grp.subjectId}-${index}`}
                                checked={term.is_pre_term}
                                onCheckedChange={(c) => updateTerm(grp.subjectId, index, "is_pre_term", c as boolean)}
                                disabled={!!term.synced}
                                className="mr-2"
                              />
                              <Label htmlFor={`preterm-${grp.subjectId}-${index}`} className="text-sm cursor-pointer">
                                {PRE_TERM_LABEL}
                              </Label>
                            </div>
                            <div className="flex items-center h-9 px-2 border rounded-md bg-card">
                              <Checkbox
                                id={`tentative-${grp.subjectId}-${index}`}
                                checked={term.is_tentative}
                                onCheckedChange={(c) => updateTerm(grp.subjectId, index, "is_tentative", c as boolean)}
                                disabled={!!term.synced}
                                className="mr-2"
                              />
                              <Label htmlFor={`tentative-${grp.subjectId}-${index}`} className="text-sm cursor-pointer">
                                {TENTATIVE_TERM_LABEL}
                              </Label>
                            </div>
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
                              title={term.synced ? "Odebraný synchronizovaný termín se znovu nenačte." : undefined}
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
