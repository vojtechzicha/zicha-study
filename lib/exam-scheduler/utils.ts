/** "HH:MM" -> minutes since midnight. */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

export function addMinutesToTime(time: string, minutesToAdd: number): string {
  const totalMinutes = parseTimeToMinutes(time) + minutesToAdd;
  return minutesToTime(totalMinutes);
}

export function compareTime(a: string, b: string): number {
  return parseTimeToMinutes(a) - parseTimeToMinutes(b);
}

export function isBefore(a: string, b: string): boolean {
  return compareTime(a, b) < 0;
}

export function isAfter(a: string, b: string): boolean {
  return compareTime(a, b) > 0;
}

/** Czech short display format, e.g. "St, 2. led". */
export function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("cs-CZ", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function getPreviousDay(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`); // Use noon UTC to avoid DST issues
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().split("T")[0];
}

export function getNextDay(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`); // Use noon UTC to avoid DST issues
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().split("T")[0];
}

/** YYYY-MM-DD strings sort correctly as plain strings. */
export function compareDate(a: string, b: string): number {
  return a.localeCompare(b);
}

/** 0 = Sunday ... 6 = Saturday. Noon UTC avoids timezone/DST shifts. */
export function getDayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

export function isWorkingDay(dateStr: string, workingDays: number[]): boolean {
  return workingDays.includes(getDayOfWeek(dateStr));
}

/**
 * Number of nights between two dates, e.g. daysBetween("2025-01-10", "2025-01-12") = 2
 * (nights of Jan 10 and Jan 11).
 */
export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(`${dateA}T12:00:00Z`);
  const b = new Date(`${dateB}T12:00:00Z`);
  const diffMs = b.getTime() - a.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (_item: T) => K
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key) || [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}
