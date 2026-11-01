import { z } from "zod"
import { EXAM_VENUES, type VenueDay } from "@/lib/constants"

// Opening days of exam venues (Testovací centrum PEF), as the venue publishes them. The importer
// (agents-study exam-watch) posts every day the venue currently lists; days inside the listed
// range that are no longer listed were closed. See docs/EXAM_WINDOWS.md.

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM.")

export const venueDaysRequestSchema = z
  .object({
    venue: z.enum([EXAM_VENUES.TC_PEF]),
    days: z
      .array(
        z
          .object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
            open_from: clock,
            open_to: clock,
            occupancy: z.number().int().min(0).max(100).nullable().default(null),
          })
          .strict()
          .refine((d) => d.open_from < d.open_to, "open_from must be before open_to.")
      )
      .max(400),
    dry_run: z.boolean().optional().default(false),
  })
  .strict()

export type VenueDaysRequest = z.infer<typeof venueDaysRequestSchema>

export interface VenueDaysPlan {
  upserts: VenueDay[]
  deletes: string[] // dates
  added: string[] // newly opened days
  removed: string[] // days the venue no longer lists inside its range
  changed: string[] // hours changed (occupancy changes alone don't count)
  publishedThrough: string | null
}

export function planVenueDays(existing: VenueDay[], request: VenueDaysRequest, previousThrough: string | null): VenueDaysPlan {
  const incoming = [...new Map(request.days.map((d) => [d.date, { venue: request.venue, ...d }])).values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  )
  const plan: VenueDaysPlan = { upserts: incoming, deletes: [], added: [], removed: [], changed: [], publishedThrough: previousThrough }
  if (incoming.length === 0) return plan

  const from = incoming[0].date
  const to = incoming[incoming.length - 1].date
  const known = new Map(existing.map((d) => [d.date, d]))
  const listed = new Set(incoming.map((d) => d.date))
  for (const day of incoming) {
    const before = known.get(day.date)
    if (!before) plan.added.push(day.date)
    else if (before.open_from !== day.open_from || before.open_to !== day.open_to) plan.changed.push(day.date)
  }
  for (const day of existing) {
    if (day.date >= from && day.date <= to && !listed.has(day.date)) {
      plan.deletes.push(day.date)
      plan.removed.push(day.date)
    }
  }
  plan.publishedThrough = previousThrough && previousThrough > to ? previousThrough : to
  return plan
}
