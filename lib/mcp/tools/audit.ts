import { z } from "zod"
import * as db from "@/lib/mongodb/db"
import { defineTool } from "@/lib/mcp/tool-kit"

export const auditTools = [
  defineTool({
    name: "list_recent_changes",
    title: "List recent changes",
    description:
      "The latest writes made through this MCP server (any connection), newest first, with the record before and after. Use it to review or undo earlier changes.",
    access: "read",
    input: { limit: z.number().int().min(1).max(100).optional().describe("Default 20.") },
    handler: async ({ limit }) => db.normalizeIds(await db.getMcpAuditEntries(limit ?? 20)),
  }),
]
