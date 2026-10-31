import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { McpAuth } from "@/lib/mcp/oauth"
import { registerTools, type ToolDefinition } from "@/lib/mcp/tool-kit"
import { auditTools } from "@/lib/mcp/tools/audit"
import { examPeriodTools } from "@/lib/mcp/tools/exam-periods"
import { finalExamTools } from "@/lib/mcp/tools/final-exams"
import { noteTools } from "@/lib/mcp/tools/notes"
import { practiceTools } from "@/lib/mcp/tools/practice"
import { studyTools } from "@/lib/mcp/tools/studies"
import { subjectTools } from "@/lib/mcp/tools/subjects"
import { taskTools } from "@/lib/mcp/tools/tasks"

export const MCP_TOOLS: ToolDefinition[] = [
  ...studyTools,
  ...subjectTools,
  ...finalExamTools,
  ...taskTools,
  ...examPeriodTools,
  ...noteTools,
  ...practiceTools,
  ...auditTools,
]

const INSTRUCTIONS = `Production data of zicha.study, a personal tracker of university and high-school studies (Czech UI and data).
Start with list_studies. Records are linked by id: subjects, final exams, tasks, exam periods and notes belong to a study.
Writes go straight to production: read the record first, prefer dry_run for updates and deletes, and write data in Czech like the existing records.
Every write is logged; list_recent_changes shows the log with the values before each change.
Materials, logos, diplomas and Word/Obsidian note content live on OneDrive and are managed in the app.
Procvičování (practice pages per subject) is private; enable it with update_subject practice_enabled, upload pages with create_practice_upload + HTTP PUT (never through tool arguments).`

// One server per request: the endpoint is stateless and the tool list depends on the token's scopes.
export function createMcpServer(auth: McpAuth, origin?: string) {
  const server = new McpServer({ name: "zicha-study", version: "1.0.0" }, { instructions: INSTRUCTIONS })
  registerTools(server, MCP_TOOLS, { auth, origin })
  return server
}
