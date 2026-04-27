function envBool(value: string | undefined): boolean {
  return value === "true" || value === "1"
}

// NEXT_PUBLIC_* values are inlined at build time, so they are safe to read here.
const USE_SUBDOMAIN = envBool(process.env.NEXT_PUBLIC_USE_SUBDOMAIN_SHARE_URLS)
const SHARE_BASE_DOMAIN = process.env.NEXT_PUBLIC_SHARE_BASE_DOMAIN || ""

function pathOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : ""
}

/**
 * Origin used when previewing share URLs. Returns the apex domain (with
 * https://) when subdomain mode is enabled; otherwise the current window origin.
 */
export function getShareOrigin(): string {
  if (USE_SUBDOMAIN && SHARE_BASE_DOMAIN) {
    return `https://${SHARE_BASE_DOMAIN}`
  }
  return pathOrigin()
}

/**
 * Build a public share URL from one or more path slugs.
 *
 * - Subdomain mode (NEXT_PUBLIC_USE_SUBDOMAIN_SHARE_URLS=true with a base
 *   domain set): the FIRST slug becomes a single subdomain, remaining
 *   segments stay in the path. ["newton", "mat"] → https://newton.zicha.study/mat.
 *   The middleware still accepts deeper subdomain forms for back-compat.
 * - Default: returns e.g. {origin}/newton/mat.
 *
 * Empty/nullish slugs are dropped.
 */
export function getShareUrl(...slugs: Array<string | null | undefined>): string {
  const cleaned = slugs.filter((s): s is string => typeof s === "string" && s.length > 0)

  if (USE_SUBDOMAIN && SHARE_BASE_DOMAIN && cleaned.length > 0) {
    const [head, ...rest] = cleaned
    const base = `https://${head}.${SHARE_BASE_DOMAIN}`
    return rest.length > 0 ? `${base}/${rest.join("/")}` : base
  }

  const origin = pathOrigin()
  return cleaned.length > 0 ? `${origin}/${cleaned.join("/")}` : origin
}

/** True when share previews should be rendered in subdomain form. */
export const isSubdomainShareEnabled: boolean = USE_SUBDOMAIN && Boolean(SHARE_BASE_DOMAIN)
