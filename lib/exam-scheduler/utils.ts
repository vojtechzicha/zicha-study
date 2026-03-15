/**
 * Parse time string (HH:MM) to minutes since midnight
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to HH:MM format
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Add minutes to a time string
 */
export function addMinutesToTime(time: string, minutesToAdd: number): string {
  const totalMinutes = parseTimeToMinutes(time) + minutesToAdd;
  return minutesToTime(totalMinutes);
}

/**
 * Compare two time strings
 * Returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareTime(a: string, b: string): number {
  return parseTimeToMinutes(a) - parseTimeToMinutes(b);
}

/**
 * Check if time a is before time b
 */
export function isBefore(a: string, b: string): boolean {
  return compareTime(a, b) < 0;
}

/**
 * Check if time a is after time b
 */
export function isAfter(a: string, b: string): boolean {
  return compareTime(a, b) > 0;
}

/**
 * Format date for display (e.g., "St, 2. led")
 */
export function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("cs-CZ", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Get the previous day's date string
 * Uses UTC to avoid timezone issues
 */
export function getPreviousDay(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`); // Use noon UTC to avoid DST issues
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().split("T")[0];
}

/**
 * Get the next day's date string
 * Uses UTC to avoid timezone issues
 */
export function getNextDay(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`); // Use noon UTC to avoid DST issues
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().split("T")[0];
}

/**
 * Compare two date strings
 */
export function compareDate(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Calculate number of days between two date strings (exclusive)
 * Returns the number of nights you'd need to stay if traveling from dateA to dateB
 * For example: daysBetween("2025-01-10", "2025-01-12") = 2 (nights of Jan 10 and Jan 11)
 */
export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(`${dateA}T12:00:00Z`);
  const b = new Date(`${dateB}T12:00:00Z`);
  const diffMs = b.getTime() - a.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Group items by a key function
 */
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
