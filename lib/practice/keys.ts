// Stable keys for practice examples. Progress ("Prošel jsem") is stored per key, so a key must
// survive regenerating a page. Pages carry data-key (it always wins); for pages without one the
// key comes from the example title, with the same algorithm the generators use:
//   re.sub(r"[^a-z0-9]+", "-", ascii_lower(title))[:80].strip("-") or "priklad"

const MAX_KEY_LENGTH = 80

export function practiceExampleKey(title: string): string {
  const ascii = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
  const key = ascii
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_KEY_LENGTH)
    .replace(/^-+|-+$/g, "")
  return key || "priklad"
}

// Appends -2, -3, … to keys that repeat within one page (skipping suffixes another key already uses).
export function dedupeKeys(keys: string[]): string[] {
  const used = new Set<string>()
  return keys.map((key) => {
    let candidate = key
    for (let n = 2; used.has(candidate); n++) candidate = `${key}-${n}`
    used.add(candidate)
    return candidate
  })
}
