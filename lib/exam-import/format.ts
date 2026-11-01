import { EXAM_TERM_SOURCE_LABELS, type ExamTermExternal, type ExamTermSource } from "@/lib/constants"

// Display helpers for synced exam terms (exam_terms.external). Source times are Prague-local
// "YYYY-MM-DDTHH:MM" strings, so they are formatted as text, never through Date and a time zone.

/** "2026-11-30T08:05" → "30. 11. 8:05"; adds the year when it isn't `currentYear`. */
export function formatSourceDateTime(value: string | null | undefined, currentYear?: number): string | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!m) return null
  const [, y, mo, d, h, mi] = m
  const year = currentYear !== undefined && Number(y) === currentYear ? "" : ` ${Number(y)}`
  return `${Number(d)}. ${Number(mo)}.${year} ${Number(h)}:${mi}`
}

/** "Přihlašování 30. 11. 0:00 – 11. 12. 23:59", or one side when the other is unknown. */
export function formatRegistrationWindow(external: Pick<ExamTermExternal, "registration_from" | "registration_to">, currentYear?: number) {
  const from = formatSourceDateTime(external.registration_from, currentYear)
  const to = formatSourceDateTime(external.registration_to, currentYear)
  if (from && to) return `Přihlašování ${from} – ${to}`
  if (from) return `Přihlašování od ${from}`
  if (to) return `Přihlašování do ${to}`
  return null
}

/** "4/30 přihlášeno", "4 přihlášeno" (no capacity) or null. */
export function formatCapacity(external: Pick<ExamTermExternal, "capacity" | "registered_count">): string | null {
  const { capacity, registered_count: count } = external
  if (count === null || count === undefined) return capacity ? `kapacita ${capacity}` : null
  return capacity ? `${count}/${capacity} přihlášeno` : `${count} přihlášeno`
}

export function sourceLabel(source: string | null | undefined): string | null {
  return source && source in EXAM_TERM_SOURCE_LABELS ? EXAM_TERM_SOURCE_LABELS[source as ExamTermSource] : null
}
