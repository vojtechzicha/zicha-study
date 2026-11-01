"use client"

import React from "react"
import { Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { StudyLogo } from "@/components/study-logo"
import type { SchedulerStudy } from "@/components/scheduler-study-settings-dialog"

interface SchedulerSettingsSheetProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  studies: SchedulerStudy[] // active studies, enabled or not
  togglingId: string | null
  onToggle: (_study: SchedulerStudy, _enabled: boolean) => void
  onEditStudy: (_study: SchedulerStudy) => void
  breakMinutes: number
  onBreakChange: (_value: number) => void
  partGapMinutes: number
  onPartGapChange: (_value: number) => void
  showPartGap: boolean
}

export function SchedulerSettingsSheet({
  open,
  onOpenChange,
  studies,
  togglingId,
  onToggle,
  onEditStudy,
  breakMinutes,
  onBreakChange,
  partGapMinutes,
  onPartGapChange,
  showPartGap,
}: SchedulerSettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Nastavení plánovače</SheetTitle>
        </SheetHeader>

        <section className="mt-6" aria-labelledby="settings-studies">
          <h3 id="settings-studies" className="text-sm font-semibold text-foreground">
            Studia
          </h3>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {studies.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <StudyLogo logoUrl={s.logo_url} studyName={s.name} size="sm" className="flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  {s.exam_scheduler_enabled ? (
                    <p className="text-xs text-muted-foreground">
                      Cesta {s.transit_duration_hours} h, {s.transit_cost_one_way} Kč, noc {s.accommodation_cost_per_night} Kč
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/70">Nezahrnuto</p>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onEditStudy(s)} aria-label={`Nastavení – ${s.name}`}>
                  <Settings2 className="h-4 w-4" />
                </Button>
                <Switch
                  checked={s.exam_scheduler_enabled}
                  disabled={togglingId === s.id}
                  onCheckedChange={(checked) => onToggle(s, checked)}
                  aria-label={`Zahrnout do plánovače – ${s.name}`}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 space-y-4" aria-labelledby="settings-gaps">
          <h3 id="settings-gaps" className="text-sm font-semibold text-foreground">
            Pauzy
          </h3>
          <div>
            <Label htmlFor="break-minutes">Mezi studii</Label>
            <p className="text-xs text-muted-foreground">Přičte se k přesunu, když jsou v jeden den prezenční zkoušky dvou studií.</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                id="break-minutes"
                type="number"
                min={0}
                step={15}
                value={breakMinutes}
                onChange={(e) => onBreakChange(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-9 w-24"
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
          </div>
          {showPartGap && (
            <div>
              <Label htmlFor="part-gap-minutes">Mezi částmi zkoušky</Label>
              <p className="text-xs text-muted-foreground">Od konce jedné části do začátku další.</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  id="part-gap-minutes"
                  type="number"
                  min={0}
                  step={15}
                  value={partGapMinutes}
                  onChange={(e) => onPartGapChange(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-9 w-24"
                />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            </div>
          )}
        </section>
      </SheetContent>
    </Sheet>
  )
}
