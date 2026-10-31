import { handlePracticePageUpload } from "@/lib/practice/upload-handlers"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Upload one practice page (generator HTML or JSON envelope). Auth: a bearer token from the MCP
// tool create_practice_upload; see lib/practice/upload.ts and docs/MCP.md.
export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return handlePracticePageUpload(request, slug)
}
