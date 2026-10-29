import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import type { z, ZodRawShape } from "zod"
import * as db from "@/lib/mongodb/db"
import { MCP_SCOPES, type McpAuth } from "@/lib/mcp/oauth"

// Every MCP tool is a zod input shape plus a handler that goes through lib/mongodb/db.ts,
// exactly like the Server Actions. Read tools need study:read, everything else
// study:write; tools the token can't use are not even listed.

export type ToolAccess = "read" | "write" | "delete"

export interface ToolContext {
  auth: McpAuth
}

export interface ToolDefinition<Shape extends ZodRawShape = ZodRawShape> {
  name: string
  title: string
  description: string
  access: ToolAccess
  input: Shape
  handler: (_args: z.objectOutputType<Shape, z.ZodTypeAny>, _ctx: ToolContext) => Promise<unknown>
}

export function defineTool<Shape extends ZodRawShape>(def: ToolDefinition<Shape>): ToolDefinition {
  return def as unknown as ToolDefinition
}

// Expected failures (not found, validation). The message is shown to the agent.
export class ToolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ToolError"
  }
}

export function requireDoc<T>(doc: T | null | undefined, what: string, id: string): T {
  if (!doc) throw new ToolError(`${what} ${id} not found.`)
  return doc
}

export function canUse(def: ToolDefinition, scopes: string[]): boolean {
  return def.access === "read" ? scopes.includes(MCP_SCOPES.READ) : scopes.includes(MCP_SCOPES.WRITE)
}

function textResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data ?? null, null, 2) }] }
}

function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] }
}

export async function runTool(def: ToolDefinition, args: unknown, ctx: ToolContext): Promise<CallToolResult> {
  if (!canUse(def, ctx.auth.scopes)) {
    return errorResult(`This connection is read-only; ${def.name} needs the study:write scope.`)
  }
  try {
    return textResult(await def.handler(args as never, ctx))
  } catch (err: any) {
    if (err instanceof ToolError) return errorResult(err.message)
    if (err?.code === 11000) return errorResult("A record with the same unique value already exists.")
    // db.ts throws plain Errors with Czech, user-facing messages for rule violations
    // (repeat cycles, subjects still referenced), so pass those through.
    console.error(`MCP tool ${def.name} failed:`, err)
    return errorResult(err?.message || "Unknown error.")
  }
}

export function registerTools(server: McpServer, tools: ToolDefinition[], ctx: ToolContext) {
  for (const def of tools) {
    if (!canUse(def, ctx.auth.scopes)) continue
    server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        inputSchema: def.input,
        annotations: {
          title: def.title,
          readOnlyHint: def.access === "read",
          destructiveHint: def.access === "delete",
          openWorldHint: false,
        },
      },
      ((args: unknown) => runTool(def, args, ctx)) as never
    )
  }
}

// ─── Audit log ──────────────────────────────────────────────────────────────

type AuditAction = "create" | "update" | "delete"

export async function audit(
  ctx: ToolContext,
  entry: { tool: string; action: AuditAction; collection: string; documentId: string; before?: unknown; after?: unknown }
) {
  await db.insertMcpAuditEntry({
    tool: entry.tool,
    action: entry.action,
    collection: entry.collection,
    document_id: entry.documentId,
    before: entry.before ?? null,
    after: entry.after ?? null,
    grant_id: ctx.auth.grantId,
    client_name: ctx.auth.clientName,
    email: ctx.auth.email,
  })
}

// Fields of `patch` that differ from `before`, for dry runs and change summaries.
export function diffFields(before: Record<string, any>, patch: Record<string, any>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of Object.keys(patch)) {
    if (JSON.stringify(before[key] ?? null) !== JSON.stringify(patch[key] ?? null)) {
      changes[key] = { from: before[key] ?? null, to: patch[key] ?? null }
    }
  }
  return changes
}

// ─── Write helpers: dry run, write, audit, return the stored record ─────────

interface WriteTarget {
  ctx: ToolContext
  tool: string
  collection: string
}

export async function commitCreate(
  target: WriteTarget,
  create: () => Promise<Record<string, any>>
) {
  const doc = db.normalizeId(await create())!
  await audit(target.ctx, { ...target, action: "create", documentId: doc.id, after: doc })
  return { created: doc }
}

export async function commitUpdate(
  target: WriteTarget & {
    before: Record<string, any>
    patch: Record<string, any>
    dryRun?: boolean
    write: (_patch: Record<string, any>) => Promise<void>
    reload: () => Promise<Record<string, any> | null>
  }
) {
  const before = db.normalizeId(target.before)!
  const changes = diffFields(before, target.patch)
  if (target.dryRun) return { dry_run: true, changes }
  if (Object.keys(changes).length === 0) return { changes, updated: before }

  await target.write(target.patch)
  const after = db.normalizeId(await target.reload())
  await audit(target.ctx, { ...target, action: "update", documentId: before.id, before, after })
  return { changes, updated: after }
}

export async function commitDelete(
  target: WriteTarget & {
    before: Record<string, any>
    dryRun?: boolean
    // What else disappears with the record, shown in dry runs and results.
    cascade?: Record<string, number>
    remove: () => Promise<void>
  }
) {
  const before = db.normalizeId(target.before)!
  const summary = { record: before, also_deleted: target.cascade ?? {} }
  if (target.dryRun) return { dry_run: true, would_delete: summary }

  await target.remove()
  await audit(target.ctx, { ...target, action: "delete", documentId: before.id, before: { ...before, also_deleted: target.cascade ?? {} } })
  return { deleted: summary }
}
