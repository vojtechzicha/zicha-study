// ALLOWED_EMAILS decides who may sign in, and is re-checked on every MCP request so
// removing an address also cuts off the Claude connectors that address authorized.
// Data isn't scoped per user, so an empty list lets any personal account read and edit everything.
export function isEmailAllowed(email: string | null | undefined): boolean {
  const allowedEmails = process.env.ALLOWED_EMAILS?.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean) || []
  if (allowedEmails.length === 0) return true
  const normalized = email?.toLowerCase()
  return !!normalized && allowedEmails.includes(normalized)
}
