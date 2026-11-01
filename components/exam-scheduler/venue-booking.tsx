"use client"

import React from "react"
import { ExternalLink, MapPin } from "lucide-react"
import { EXAM_VENUE_INFO } from "@/lib/constants"
import type { PlanTerm } from "@/components/exam-scheduler/plan-model"

// A planned slot of a window term at a venue (Testovací centrum PEF): it still has to be booked
// there; locking it records the booking (docs/EXAM_WINDOWS.md).
export function VenueBookingLine({ term }: { term: PlanTerm }) {
  if (!term.windowId || !term.venue) return null
  const info = EXAM_VENUE_INFO[term.venue]
  return (
    <p className="text-xs text-amber-700 dark:text-amber-300" title={info.bookingHint}>
      <MapPin className="mr-0.5 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
      Rezervovat místo v {info.shortLabel}
      {term.venueOccupancy !== null && term.venueOccupancy !== undefined ? ` (obsazeno ${term.venueOccupancy} %)` : ""}
      {" · "}
      <a
        href={info.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-0.5 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:underline"
      >
        otevírací doba
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </p>
  )
}

/** Label of the lock button: for a venue slot, locking means "I have booked it". */
export function lockLabel(term: PlanTerm, fallback?: string): string | undefined {
  return term.windowId ? "Mám rezervaci" : fallback
}
