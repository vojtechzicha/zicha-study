"use client"

import React from "react"
import { AlertTriangle, CheckCircle2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { czPlural } from "@/lib/utils/task-format"
import { registrationState } from "@/lib/exam-scheduler/calendar"
import type { UnschedulableRequirement } from "@/lib/exam-scheduler"
import { LockButton } from "./plan-calendar"
import { formatDayShort, type PlanStudy, type PlanTerm } from "./plan-model"

export interface MissingTerms {
  periodId: string
  periodName: string
  studyId: string
  subjects: string[] // shortcuts
}

interface LockQueueProps {
  queue: PlanTerm[] // planned, unlocked, in lock order
  alternatives: Map<string, number> // requirementId → other terms
  studies: Map<string, PlanStudy>
  now: string
  busyIds: Set<string>
  onLock: (_term: PlanTerm) => void
  onShow: (_term: PlanTerm) => void
  unschedulable: UnschedulableRequirement[]
  missing: MissingTerms[]
  onEditPeriod: (_periodId: string) => void
  plannedCount: number
}

/** "2026-12-11T23:59" → "11. 12."; keeps the time unless it is the start or end of the day. */
function formatRegistrationMoment(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!m) return value
  const [, , mo, d, h, mi] = m
  const time = `${h}:${mi}` === "00:00" || `${h}:${mi}` === "23:59" ? "" : ` ${Number(h)}:${mi}`
  return `${Number(d)}.\u00a0${Number(mo)}.${time}`
}

function RegistrationLine({ term, now }: { term: PlanTerm; now: string }) {
  const state = registrationState(term.external, now)
  switch (state.kind) {
    case "open":
      return (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {state.until ? `Přihlašování do ${formatRegistrationMoment(state.until)}` : "Přihlašování běží"}
        </p>
      )
    case "opens":
      return <p className="text-xs text-muted-foreground">Přihlašování od {formatRegistrationMoment(state.from)}</p>
    case "registered":
      return <p className="text-xs text-green-700 dark:text-green-300">Přihlášen</p>
    case "closed":
      return <p className="text-xs text-red-700 dark:text-red-300">Přihlašování skončilo</p>
    default:
      return null
  }
}

export function LockQueue({
  queue,
  alternatives,
  studies,
  now,
  busyIds,
  onLock,
  onShow,
  unschedulable,
  missing,
  onEditPeriod,
  plannedCount,
}: LockQueueProps) {
  const missingCount = missing.reduce((n, m) => n + m.subjects.length, 0)

  return (
    <div className="space-y-6">
      <section aria-labelledby="lock-queue-title">
        <div className="flex items-baseline gap-2">
          <h2 id="lock-queue-title" className="text-base font-semibold text-foreground">
            K zamknutí
          </h2>
          {queue.length > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 text-xs font-semibold tabular-nums text-amber-800 dark:text-amber-200">
              {queue.length}
            </span>
          )}
        </div>

        {queue.length === 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            {plannedCount > 0 ? "Všechny termíny v plánu jsou zamčené." : "V plánu zatím nic není."}
          </p>
        ) : (
          <ol className="mt-3 space-y-px overflow-hidden rounded-lg border border-border">
            {queue.map((t) => {
              const study = studies.get(t.studyId)
              const alt = alternatives.get(t.requirementId) || 0
              return (
                <li key={t.id} className="bg-card px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onShow(t)}
                    className="flex w-full items-start gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px] border-dashed", study?.tone.ring)} />
                    <span className="min-w-0 text-sm leading-snug text-foreground hover:underline">
                      <span className="font-semibold">{t.shortcut}</span> {t.subjectName}
                    </span>
                  </button>
                  <div className="mt-1 flex items-end gap-2 pl-[1.125rem]">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs tabular-nums text-foreground/80">
                        {formatDayShort(t.date)} {t.startTime}
                        {t.partLabel ? ` – ${t.partLabel}` : ""}
                      </p>
                      <RegistrationLine term={t} now={now} />
                      {alt > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {alt} {czPlural(alt, "jiný termín", "jiné termíny", "jiných termínů")}
                        </p>
                      )}
                    </div>
                    <LockButton term={t} busy={busyIds.has(t.id)} onLock={onLock} className="shrink-0" />
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {unschedulable.length > 0 && (
        <section aria-labelledby="unschedulable-title">
          <h2 id="unschedulable-title" className="flex items-center gap-1.5 text-base font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            Nevejde se do plánu
          </h2>
          <ul className="mt-2 space-y-1.5">
            {unschedulable.map((u) => (
              <li key={u.requirementId} className="text-sm">
                <span className="font-medium text-foreground">{u.subjectName}</span>
                <span className="block text-xs text-muted-foreground">
                  {u.periodName}: {u.reason}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {missingCount > 0 && (
        <section aria-labelledby="missing-title">
          <div className="flex items-baseline gap-2">
            <h2 id="missing-title" className="text-base font-semibold text-foreground">
              Bez termínů
            </h2>
            <span className="rounded-full bg-muted px-2 text-xs font-semibold tabular-nums text-muted-foreground">{missingCount}</span>
          </div>
          <ul className="mt-2 space-y-2">
            {missing.map((m) => {
              const study = studies.get(m.studyId)
              return (
                <li key={m.periodId} className="flex items-start gap-2">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", study?.tone.swatch)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{m.periodName}</p>
                    <p className="text-xs text-muted-foreground break-words">{m.subjects.join(", ")}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditPeriod(m.periodId)}
                    className="h-7 shrink-0 px-2 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Termíny
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
