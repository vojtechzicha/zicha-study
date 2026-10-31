// Where to go after signing in, from a `callbackUrl` query parameter (e.g. a Todoist link to a
// private practice page). Only same-site paths are accepted: "/x", never "//host", a scheme, or
// a backslash variant that browsers treat as one. Anything else falls back to "/".
export function safeCallbackUrl(value: string | string[] | null | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || raw.length > 2000) return "/"
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/"
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return "/"
  return raw
}
