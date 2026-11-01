"use client"

import React from "react"
import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  EXTERNAL_TERM_STATUS,
  EXTERNAL_TERM_STATUS_LABELS,
  type ExamTermExternal,
  type ExternalTermStatus,
} from "@/lib/constants"
import { formatCapacity, formatRegistrationWindow, sourceLabel } from "@/lib/exam-import/format"

// What the university system says about a synced exam term (docs/EXAM_IMPORT.md).

const STATUS_CLASSES: Record<ExternalTermStatus, string> = {
  registered: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200",
  available: "bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300",
  unavailable: "bg-muted text-muted-foreground",
}

export interface SyncedTerm {
  source?: string | null
  external?: ExamTermExternal | null
}

export function isSyncedTerm(term: SyncedTerm): boolean {
  return !!sourceLabel(term.source) && !!term.external
}

/** Badge plus one line of details; `compact` shows only the badges and the room. */
export function SyncedTermInfo({ term, compact = false }: { term: SyncedTerm; compact?: boolean }) {
  const label = sourceLabel(term.source)
  const x = term.external
  if (!label || !x) return null

  const year = new Date().getFullYear()
  const details = compact
    ? [x.room]
    : [x.kind, x.term_type, x.room, x.examiners, formatCapacity(x), formatRegistrationWindow(x, year)]
  const line = details.filter(Boolean).join(" · ")
  const status = x.status in STATUS_CLASSES ? x.status : EXTERNAL_TERM_STATUS.AVAILABLE

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        <Badge
          variant="outline"
          className="border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-normal"
          title={`Synchronizováno z ${label}`}
        >
          <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
          {label}
        </Badge>
        <Badge variant="secondary" className={`${STATUS_CLASSES[status]} font-normal`}>
          {EXTERNAL_TERM_STATUS_LABELS[status]}
        </Badge>
        {line && <span className="text-muted-foreground">{line}</span>}
        {x.url?.startsWith("https://") && (
          <a
            href={x.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 underline-offset-2 hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            {x.status === EXTERNAL_TERM_STATUS.REGISTERED ? `Otevřít v ${label}` : `Přihlásit v ${label}`}
          </a>
        )}
      </div>
      {!compact && x.status === EXTERNAL_TERM_STATUS.UNAVAILABLE && x.status_note && (
        <p className="text-xs text-muted-foreground">{x.status_note}</p>
      )}
      {x.removed_at && (
        <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />V {label} už termín není. Zůstal, protože je zamčený.
        </p>
      )}
    </div>
  )
}
