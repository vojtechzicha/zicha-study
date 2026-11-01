"use client"

import React, { useMemo } from "react"
import { ChevronLeft, ChevronRight, Home, Lock, Loader2, Monitor, Moon, Palmtree, TrainFront, LockOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { StudyLogo } from "@/components/study-logo"
import { SyncedTermInfo } from "@/components/synced-term-info"
import { VenueBookingLine, lockLabel } from "@/components/exam-scheduler/venue-booking"
import { cn } from "@/lib/utils"
import { PRE_TERM_LABEL, TENTATIVE_TERM_LABEL } from "@/lib/constants"
import { czPlural } from "@/lib/utils/task-format"
import type { ScheduleItem } from "@/lib/exam-scheduler"
import { monthKey, monthWeeks, sundayIndex, weekTripSegments, type PlanTrip } from "@/lib/exam-scheduler/calendar"
import {
  formatDayLong,
  formatDayShort,
  formatMonth,
  formatMonthShort,
  type PlanStudy,
  type PlanTerm,
} from "./plan-model"

const WEEKDAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"]
const DAY_HEAD_PX = 26 // day number row
const LANE_PX = 20 // one trip bar plus gap
const MAX_CHIPS = 3

export interface PeriodWindow {
  studyId: string
  name: string
  start: string
  end: string
}

interface PlanCalendarProps {
  months: string[]
  month: string
  onMonthChange: (_month: string) => void
  terms: PlanTerm[]
  items: ScheduleItem[]
  trips: PlanTrip[]
  studies: Map<string, PlanStudy>
  windows: PeriodWindow[]
  today: string
  openDay: string | null
  onOpenDayChange: (_day: string | null) => void
  onLock: (_term: PlanTerm) => void
  onUnlock: (_term: PlanTerm) => void
  busyIds: Set<string>
}

export function PlanCalendar({
  months,
  month,
  onMonthChange,
  terms,
  items,
  trips,
  studies,
  windows,
  today,
  openDay,
  onOpenDayChange,
  onLock,
  onUnlock,
  busyIds,
}: PlanCalendarProps) {
  const weeks = useMemo(() => monthWeeks(month), [month])
  const index = months.indexOf(month)

  const termsByDay = useMemo(() => {
    const map = new Map<string, PlanTerm[]>()
    for (const t of terms) {
      const list = map.get(t.date) || []
      list.push(t)
      map.set(t.date, list)
    }
    for (const list of map.values()) list.sort((a, b) => Number(b.inPlan) - Number(a.inPlan) || a.startTime.localeCompare(b.startTime))
    return map
  }, [terms])

  const itemsByDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    for (const it of items) {
      if (it.type === "exam") continue
      const list = map.get(it.date) || []
      list.push(it)
      map.set(it.date, list)
    }
    return map
  }, [items])

  const termsByRequirement = useMemo(() => {
    const map = new Map<string, PlanTerm[]>()
    for (const t of terms) {
      const list = map.get(t.requirementId) || []
      list.push(t)
      map.set(t.requirementId, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    return map
  }, [terms])

  const monthStats = useMemo(() => {
    const map = new Map<string, { planned: number; open: number }>()
    for (const t of terms) {
      if (!t.inPlan) continue
      const m = monthKey(t.date)
      const s = map.get(m) || { planned: 0, open: 0 }
      s.planned++
      if (!t.locked) s.open++
      map.set(m, s)
    }
    return map
  }, [terms])

  const inWindow = (day: string) => windows.some((w) => day >= w.start && day <= w.end)

  return (
    <div>
      <div className="flex items-center gap-2 px-4 sm:px-5 pt-4 pb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={index <= 0}
          onClick={() => onMonthChange(months[index - 1])}
          aria-label="Předchozí měsíc"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-foreground min-w-[9.5rem] tabular-nums">{formatMonth(month)}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={index < 0 || index >= months.length - 1}
          onClick={() => onMonthChange(months[index + 1])}
          aria-label="Další měsíc"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="ml-auto hidden md:flex items-center gap-1" role="group" aria-label="Měsíce">
          {months.map((m) => {
            const s = monthStats.get(m)
            return (
              <button
                key={m}
                type="button"
                onClick={() => onMonthChange(m)}
                aria-pressed={m === month}
                className={cn(
                  "relative rounded-md px-2.5 py-1 text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                  m === month
                    ? "bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200 font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {formatMonthShort(m)}
                {m.slice(0, 4) !== today.slice(0, 4) && <span className="ml-0.5 text-xs opacity-70">{m.slice(2, 4)}</span>}
                {s && s.open > 0 && (
                  <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Nezamčené termíny" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-border">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={cn(
                "px-1.5 sm:px-2 py-1.5 text-xs font-medium",
                i >= 5 ? "text-muted-foreground/70" : "text-muted-foreground"
              )}
            >
              {d}
            </div>
          ))}
        </div>

        {weeks.map((week) => {
          const segments = weekTripSegments(week, trips)
          const lanes = segments.reduce((n, s) => Math.max(n, s.lane + 1), 0)
          const padTop = DAY_HEAD_PX + lanes * LANE_PX
          return (
            <div key={week[0]} className="relative grid grid-cols-7 border-b border-border last:border-b-0">
              {week.map((day, col) => (
                <DayCell
                  key={day}
                  day={day}
                  col={col}
                  padTop={padTop}
                  outside={monthKey(day) !== month}
                  isToday={day === today}
                  isPast={day < today}
                  weekend={[0, 6].includes(sundayIndex(day))}
                  inWindow={inWindow(day)}
                  terms={termsByDay.get(day) || []}
                  travel={itemsByDay.get(day) || []}
                  studies={studies}
                  termsByRequirement={termsByRequirement}
                  open={openDay === day}
                  onOpenChange={(o) => onOpenDayChange(o ? day : null)}
                  onGoTo={(d) => {
                    onMonthChange(monthKey(d))
                    onOpenDayChange(d)
                  }}
                  onLock={onLock}
                  onUnlock={onUnlock}
                  busyIds={busyIds}
                  windows={windows}
                />
              ))}

              {segments.map((seg) => {
                const study = studies.get(seg.trip.studyId)
                const span = seg.colEnd - seg.colStart + 1
                return (
                  <div
                    key={`${seg.trip.studyId}-${seg.trip.start}`}
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute grid h-[18px] items-center text-[11px] font-medium",
                      study?.tone.ribbon,
                      seg.startsHere ? "rounded-l-full" : "",
                      seg.endsHere ? "rounded-r-full" : ""
                    )}
                    style={{
                      top: DAY_HEAD_PX + seg.lane * LANE_PX,
                      left: `calc(${(seg.colStart / 7) * 100}% + ${seg.startsHere ? 4 : 0}px)`,
                      width: `calc(${(span / 7) * 100}% - ${(seg.startsHere ? 4 : 0) + (seg.endsHere ? 4 : 0)}px)`,
                      gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))`,
                    }}
                  >
                    {week.slice(seg.colStart, seg.colEnd + 1).map((day) => {
                      const isStart = day === seg.trip.start
                      const isEnd = day === seg.trip.end
                      const night = seg.trip.nights.includes(day)
                      const { departTime, returnTime } = seg.trip
                      return (
                        <span key={day} className="flex min-w-0 items-center gap-1 overflow-hidden px-1.5 tabular-nums">
                          {isStart && study?.logo_url && (
                            <StudyLogo
                              logoUrl={study.logo_url}
                              studyName={study.name}
                              size="sm"
                              className="hidden sm:flex h-3.5 w-3.5 shrink-0 rounded-sm border-0 p-0"
                            />
                          )}
                          {isStart && <TrainFront className="h-3 w-3 shrink-0" />}
                          {isStart && departTime && <span className="hidden md:inline truncate">{departTime}</span>}
                          {isStart && isEnd && returnTime && (
                            <span className="hidden xl:inline truncate opacity-80">– {returnTime}</span>
                          )}
                          {night && <Moon className="ml-auto h-3 w-3 shrink-0" />}
                          {isEnd && !isStart && !night && (
                            <>
                              <Home className="h-3 w-3 shrink-0" />
                              {returnTime && <span className="hidden md:inline truncate">{returnTime}</span>}
                            </>
                          )}
                        </span>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface DayCellProps {
  day: string
  col: number
  padTop: number
  outside: boolean
  isToday: boolean
  isPast: boolean
  weekend: boolean
  inWindow: boolean
  terms: PlanTerm[]
  travel: ScheduleItem[]
  studies: Map<string, PlanStudy>
  termsByRequirement: Map<string, PlanTerm[]>
  windows: PeriodWindow[]
  open: boolean
  onOpenChange: (_open: boolean) => void
  onGoTo: (_day: string) => void
  onLock: (_term: PlanTerm) => void
  onUnlock: (_term: PlanTerm) => void
  busyIds: Set<string>
}

function DayCell({
  day,
  col,
  padTop,
  outside,
  isToday,
  isPast,
  weekend,
  inWindow,
  terms,
  travel,
  studies,
  termsByRequirement,
  windows,
  open,
  onOpenChange,
  onGoTo,
  onLock,
  onUnlock,
  busyIds,
}: DayCellProps) {
  const planned = terms.filter((t) => t.inPlan)
  const others = terms.filter((t) => !t.inPlan)
  const interactive = terms.length > 0 || travel.length > 0
  const dayNum = Number(day.slice(8, 10))

  const cellClass = cn(
    "relative min-h-[5.5rem] sm:min-h-[7rem] text-left align-top border-r border-border last:border-r-0",
    col === 6 && "border-r-0",
    inWindow && "bg-primary-50 dark:bg-primary-950",
    outside && "opacity-45",
    interactive &&
      "cursor-pointer transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500",
    open && "bg-muted"
  )

  const content = (
    <>
      <span
        className={cn(
          "absolute left-1.5 top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs tabular-nums",
          isToday
            ? "bg-primary-600 text-white font-semibold"
            : isPast
              ? "text-muted-foreground/60"
              : weekend
                ? "text-muted-foreground"
                : "text-foreground/80"
        )}
      >
        {dayNum}
      </span>
      <span className="flex flex-col gap-0.5 px-1 pb-1.5" style={{ paddingTop: padTop }}>
        {planned.slice(0, MAX_CHIPS).map((t) => (
          <TermChip key={t.id} term={t} study={studies.get(t.studyId)} />
        ))}
        {planned.length > MAX_CHIPS && (
          <span className="px-1 text-[10px] text-muted-foreground">+{planned.length - MAX_CHIPS}</span>
        )}
        {others.length > 0 && (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-0.5 pt-0.5">
            {others.slice(0, 4).map((t) => (
              <span key={t.id} className="flex min-w-0 items-center gap-1 text-[10px] leading-4 text-muted-foreground">
                {t.locked ? (
                  <Lock className="h-2.5 w-2.5 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Zamčeno mimo plán" />
                ) : (
                  <span className={cn("h-2 w-2 shrink-0 rounded-full border-[1.5px]", studies.get(t.studyId)?.tone.ring)} />
                )}
                <span className="hidden lg:inline truncate">{t.shortcut}</span>
              </span>
            ))}
            {others.length > 4 && <span className="text-[10px] text-muted-foreground">+{others.length - 4}</span>}
          </span>
        )}
      </span>
    </>
  )

  if (!interactive) return <div className={cellClass}>{content}</div>

  const label = [
    formatDayLong(day),
    planned.length > 0 ? `${planned.length} ${czPlural(planned.length, "zkouška v plánu", "zkoušky v plánu", "zkoušek v plánu")}` : null,
    others.length > 0 ? `${others.length} ${czPlural(others.length, "jiný termín", "jiné termíny", "jiných termínů")}` : null,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className={cellClass} aria-label={label}>
          {content}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={col >= 4 ? "end" : "start"}
        className="w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto p-0"
      >
        <DayDetail
          day={day}
          planned={planned}
          others={others}
          travel={travel}
          studies={studies}
          termsByRequirement={termsByRequirement}
          windows={windows}
          onGoTo={onGoTo}
          onLock={onLock}
          onUnlock={onUnlock}
          busyIds={busyIds}
        />
      </PopoverContent>
    </Popover>
  )
}

function TermChip({ term, study }: { term: PlanTerm; study?: PlanStudy }) {
  const tone = study?.tone
  return (
    <span
      className={cn(
        "relative flex min-w-0 items-center gap-1 rounded px-1 sm:px-1.5 py-px text-[10px] sm:text-xs font-medium leading-4",
        term.locked ? tone?.solid : cn("border border-dashed bg-card", tone?.dashed)
      )}
    >
      {term.locked && <Lock className="hidden sm:block h-2.5 w-2.5 shrink-0" />}
      <span className="truncate">{term.shortcut}</span>
      <span className="hidden xl:inline ml-auto shrink-0 tabular-nums font-normal opacity-80">{term.startTime}</span>
      {!term.locked && (
        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-card" aria-hidden="true" />
      )}
    </span>
  )
}

interface DayDetailProps {
  day: string
  planned: PlanTerm[]
  others: PlanTerm[]
  travel: ScheduleItem[]
  studies: Map<string, PlanStudy>
  termsByRequirement: Map<string, PlanTerm[]>
  windows: PeriodWindow[]
  onGoTo: (_day: string) => void
  onLock: (_term: PlanTerm) => void
  onUnlock: (_term: PlanTerm) => void
  busyIds: Set<string>
}

function DayDetail({ day, planned, others, travel, studies, termsByRequirement, windows, onGoTo, onLock, onUnlock, busyIds }: DayDetailProps) {
  const dayWindows = windows.filter((w) => day >= w.start && day <= w.end)
  return (
    <div className="divide-y divide-border">
      <div className="px-4 py-3">
        <h3 className="font-semibold text-foreground first-letter:uppercase">{formatDayLong(day)}</h3>
        {dayWindows.length > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">{dayWindows.map((w) => w.name).join(", ")}</p>
        )}
        {travel.length > 0 && (
          <ul className="mt-2 space-y-1">
            {travel.map((it, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-foreground/80">
                {it.type === "travel_to" ? (
                  <TrainFront className="h-3.5 w-3.5 text-muted-foreground" />
                ) : it.type === "travel_from" ? (
                  <Home className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className={cn("h-2 w-2 rounded-full", it.studyId && studies.get(it.studyId)?.tone.swatch)} />
                <span>
                  {it.type === "travel_to"
                    ? `Odjezd do školy ${it.startTime}`
                    : it.type === "travel_from"
                      ? `Cesta domů ${it.startTime}`
                      : "Noc u školy"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {planned.map((t) => {
        const alternatives = (termsByRequirement.get(t.requirementId) || []).filter((o) => o.id !== t.id)
        return (
          <TermDetail key={t.id} term={t} study={studies.get(t.studyId)}>
            <div className="flex items-center gap-2">
              {t.locked ? (
                <>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    Zamčeno
                  </span>
                  <UnlockButton term={t} busy={busyIds.has(t.id)} onUnlock={onUnlock} className="ml-auto" />
                </>
              ) : (
                <>
                  <span className="text-xs text-amber-700 dark:text-amber-300">V plánu, ale nezamčeno</span>
                  <LockButton term={t} busy={busyIds.has(t.id)} onLock={onLock} className="ml-auto" label={lockLabel(t)} />
                </>
              )}
            </div>
            {alternatives.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">
                  {alternatives.length === 1 ? "Jiný termín" : "Jiné termíny"}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {alternatives.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onGoTo(o.date)}
                      className="rounded border border-border px-1.5 py-0.5 text-xs tabular-nums text-foreground/80 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      {formatDayShort(o.date)} {o.startTime}
                      {o.partLabel ? ` – ${o.partLabel}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </TermDetail>
        )
      })}

      {others.map((t) => {
        const chosen = (termsByRequirement.get(t.requirementId) || []).filter((o) => o.inPlan)
        return (
          <TermDetail key={t.id} term={t} study={studies.get(t.studyId)} muted>
            <div className="flex items-center gap-2">
              <span className="flex flex-col text-xs text-muted-foreground">
                {chosen.length > 0 ? (
                  <span>
                    V plánu je{" "}
                    {chosen.map((c, i) => (
                      <React.Fragment key={c.id}>
                        {i > 0 && ", "}
                        <button
                          type="button"
                          onClick={() => onGoTo(c.date)}
                          className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                        >
                          {formatDayShort(c.date)}
                        </button>
                      </React.Fragment>
                    ))}
                  </span>
                ) : (
                  "Mimo plán"
                )}
                {t.locked && (
                  <span className="mt-0.5 flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <Lock className="h-3 w-3" />
                    Zamčeno, ale mimo plán
                  </span>
                )}
              </span>
              {t.locked ? (
                <UnlockButton term={t} busy={busyIds.has(t.id)} onUnlock={onUnlock} className="ml-auto" />
              ) : (
                <LockButton term={t} busy={busyIds.has(t.id)} onLock={onLock} className="ml-auto" label={lockLabel(t, "Zamknout tento")} />
              )}
            </div>
          </TermDetail>
        )
      })}
    </div>
  )
}

function TermDetail({ term, study, muted = false, children }: { term: PlanTerm; study?: PlanStudy; muted?: boolean; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
            muted ? cn("border-[1.5px]", study?.tone.ring) : study?.tone.swatch
          )}
        />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium leading-snug", muted ? "text-foreground/80" : "text-foreground")}>
            <span className="tabular-nums">{term.shortcut}</span> {term.subjectName}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {term.startTime}–{term.endTime}
            {study ? ` – ${study.name}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {term.partLabel && (
              <Badge variant="secondary" className="bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 font-normal">
                {term.partLabel}
              </Badge>
            )}
            {term.isPreTerm && (
              <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-normal">
                {PRE_TERM_LABEL}
              </Badge>
            )}
            {term.isTentative && (
              <Badge variant="outline" className="border-dashed border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 font-normal">
                {TENTATIVE_TERM_LABEL}
              </Badge>
            )}
            {term.isOnline && (
              <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 font-normal">
                <Monitor className="h-3 w-3 mr-1" />
                Online
              </Badge>
            )}
            {term.requiresPto && (
              <Badge variant="secondary" className="bg-muted text-muted-foreground font-normal">
                <Palmtree className="h-3 w-3 mr-1" />
                Dovolená
              </Badge>
            )}
          </div>
          {term.external && (
            <div className="mt-1.5">
              <SyncedTermInfo term={term} />
            </div>
          )}
          {term.windowId && (
            <div className="mt-1.5">
              <VenueBookingLine term={term} />
            </div>
          )}
          {term.note && <p className="mt-1.5 text-xs text-muted-foreground">{term.note}</p>}
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function LockButton({
  term,
  busy,
  onLock,
  className,
  label = "Zamknout",
}: {
  term: PlanTerm
  busy: boolean
  onLock: (_term: PlanTerm) => void
  className?: string
  label?: string
}) {
  return (
    <Button
      size="sm"
      onClick={() => onLock(term)}
      disabled={busy}
      className={cn("h-7 px-2.5 text-xs bg-primary-600 hover:bg-primary-700 text-white", className)}
    >
      {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Lock className="h-3 w-3 mr-1" />}
      {label}
    </Button>
  )
}

export function UnlockButton({
  term,
  busy,
  onUnlock,
  className,
}: {
  term: PlanTerm
  busy: boolean
  onUnlock: (_term: PlanTerm) => void
  className?: string
}) {
  return (
    <Button variant="ghost" size="sm" className={cn("h-7 px-2 text-xs", className)} disabled={busy} onClick={() => onUnlock(term)}>
      {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <LockOpen className="h-3 w-3 mr-1" />}
      Odemknout
    </Button>
  )
}
