"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import { EXAM_SCHEDULER_DEFAULTS, DEFAULT_WORKING_DAYS, WEEKDAY_OPTIONS } from "@/lib/constants"
import { useToast } from "@/hooks/use-toast"
import { updateStudySchedulerSettingsAction } from "@/lib/actions/exam-scheduler"

export interface SchedulerStudy {
  id: string
  name: string
  logo_url?: string | null
  exam_scheduler_enabled: boolean
  transit_duration_hours: number
  transit_cost_one_way: number
  accommodation_cost_per_night: number
  earliest_arrival_time?: string | null
  prefer_free_day_exams: boolean
  pto_day_cost: number
  working_days: number[]
}

interface SchedulerStudySettingsDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  study: SchedulerStudy
  onSaved: () => void
}

export function SchedulerStudySettingsDialog({ open, onOpenChange, study, onSaved }: SchedulerStudySettingsDialogProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    exam_scheduler_enabled: study.exam_scheduler_enabled,
    transit_duration_hours: study.transit_duration_hours,
    transit_cost_one_way: study.transit_cost_one_way,
    accommodation_cost_per_night: study.accommodation_cost_per_night,
    earliest_arrival_time: study.earliest_arrival_time ? study.earliest_arrival_time.substring(0, 5) : "",
    prefer_free_day_exams: study.prefer_free_day_exams,
    pto_day_cost: study.pto_day_cost,
    working_days: study.working_days && study.working_days.length > 0 ? study.working_days : DEFAULT_WORKING_DAYS,
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateStudySchedulerSettingsAction(study.id, {
        exam_scheduler_enabled: form.exam_scheduler_enabled,
        transit_duration_hours: form.transit_duration_hours,
        transit_cost_one_way: form.transit_cost_one_way,
        accommodation_cost_per_night: form.accommodation_cost_per_night,
        earliest_arrival_time: form.earliest_arrival_time || null,
        prefer_free_day_exams: form.prefer_free_day_exams,
        pto_day_cost: form.pto_day_cost,
        working_days: form.working_days,
      })
      if (res.error) {
        toast({ title: "Nepodařilo se uložit nastavení", description: res.error.message, variant: "destructive" })
        return
      }
      toast({ title: "Nastavení uloženo" })
      onSaved()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nastavení plánovače – {study.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-primary-50/50">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Plánovač zkoušek</Label>
              <p className="text-sm text-muted-foreground">Zahrnout toto studium do plánovače zkoušek</p>
            </div>
            <Switch
              checked={form.exam_scheduler_enabled}
              onCheckedChange={(c) => setForm({ ...form, exam_scheduler_enabled: c })}
            />
          </div>

          {form.exam_scheduler_enabled && (
            <div className="p-4 border rounded-lg bg-primary-50/30 space-y-4">
              <p className="text-sm font-medium text-gray-700">Doprava a ubytování</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="transit_duration">Doba cesty (hodiny)</Label>
                  <Input
                    id="transit_duration"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="12"
                    value={form.transit_duration_hours}
                    onChange={(e) =>
                      setForm({ ...form, transit_duration_hours: parseFloat(e.target.value) || EXAM_SCHEDULER_DEFAULTS.TRANSIT_DURATION_HOURS })
                    }
                  />
                  <p className="text-xs text-gray-500">Jednosměrná cesta do školy</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="earliest_arrival">Nejdřívější příjezd</Label>
                  <Input
                    id="earliest_arrival"
                    type="time"
                    value={form.earliest_arrival_time}
                    onChange={(e) => setForm({ ...form, earliest_arrival_time: e.target.value })}
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
                    value={form.transit_cost_one_way}
                    onChange={(e) => setForm({ ...form, transit_cost_one_way: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-gray-500">Jednosměrná cesta</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accommodation_cost">Ubytování/noc (Kč)</Label>
                  <Input
                    id="accommodation_cost"
                    type="number"
                    min="0"
                    value={form.accommodation_cost_per_night}
                    onChange={(e) => setForm({ ...form, accommodation_cost_per_night: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-gray-500">Cena za noc u školy (0 = bez nákladů)</p>
                </div>
              </div>

              <div className="pt-2 border-t border-primary-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium">Upřednostnit volné dny</Label>
                    <p className="text-xs text-gray-500">
                      Prezenční zkoušky v pracovní dny penalizovat, aby plánovač dal přednost volným dnům, pokud se to vyplatí.
                    </p>
                  </div>
                  <Switch
                    checked={form.prefer_free_day_exams}
                    onCheckedChange={(c) => setForm({ ...form, prefer_free_day_exams: c })}
                  />
                </div>

                {form.prefer_free_day_exams && (
                  <div className="space-y-4">
                    <div className="space-y-2 max-w-xs">
                      <Label htmlFor="pto_day_cost">Cena dne dovolené (Kč)</Label>
                      <Input
                        id="pto_day_cost"
                        type="number"
                        min="0"
                        step="100"
                        value={form.pto_day_cost}
                        onChange={(e) => setForm({ ...form, pto_day_cost: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-gray-500">Vyšší hodnota = silnější preference volných dní.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Pracovní dny</Label>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_OPTIONS.map((day) => {
                          const selected = form.working_days.includes(day.value)
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => {
                                const next = selected
                                  ? form.working_days.filter((d) => d !== day.value)
                                  : [...form.working_days, day.value]
                                setForm({ ...form, working_days: next })
                              }}
                              className={`w-11 h-10 rounded-md border text-sm font-medium transition-colors ${
                                selected
                                  ? "bg-primary-600 text-white border-primary-600 hover:bg-primary-700"
                                  : "bg-white text-gray-600 border-gray-300 hover:bg-primary-50"
                              }`}
                            >
                              {day.label}
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-xs text-gray-500">Dny, kdy pracujete. Zkoušky v ostatní (volné) dny nejsou penalizovány.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
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
