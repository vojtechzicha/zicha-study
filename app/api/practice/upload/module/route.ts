import { handlePracticeModuleUpload } from "@/lib/practice/upload-handlers"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Upload a practice module manifest (index texts, groups and page order). Auth: a bearer token
// from the MCP tool create_practice_upload; see lib/practice/upload.ts and docs/MCP.md.
export async function PUT(request: Request) {
  return handlePracticeModuleUpload(request)
}
