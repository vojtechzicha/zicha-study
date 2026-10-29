import { z } from "zod"
import { ToolError } from "@/lib/mcp/tool-kit"

// Shared input primitives for MCP tools. Enum-like fields take their values from
// lib/constants.ts, so agents can only store values the app knows how to display.

export function enumOf<T extends Record<string, string>>(values: T) {
  return z.enum(Object.values(values) as [string, ...string[]])
}

export const recordId = z.string().trim().min(1).max(100)

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")

export const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use HH:MM.")

export const text = (max: number) => z.string().trim().min(1).max(max)

export const optionalText = (max: number) => z.string().trim().max(max).nullable()

// Public addresses: same rules as cleanSlugInput() in lib/utils/slug.ts.
export const publicSlug = z
  .string()
  .regex(/^[a-z0-9_-]{3,50}$/, "Use 3–50 lowercase letters, digits, - or _.")

export const dryRun = z
  .boolean()
  .optional()
  .describe("Return the changes without saving them.")

// Turns "" into null for nullable text the agent may clear.
export function emptyToNull<T extends Record<string, any>>(fields: T): T {
  const out: Record<string, any> = { ...fields }
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === "string" && value.trim() === "") out[key] = null
  }
  return out as T
}

export function requireFields(fields: Record<string, any>, required: string[], what: string) {
  const missing = required.filter((key) => fields[key] === undefined || fields[key] === null)
  if (missing.length > 0) {
    throw new ToolError(`${what} needs: ${missing.join(", ")}.`)
  }
}
