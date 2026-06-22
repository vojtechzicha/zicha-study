import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import * as db from "@/lib/mongodb/db"

// Serves inline images embedded in Markdown study notes.
// Public notes are readable by anyone; private notes require an authenticated session.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ noteId: string; mediaId: string }> }
) {
  const { noteId, mediaId } = await context.params

  try {
    const note = await db.getStudyNoteById(noteId)
    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (!note.is_public) {
      const session = await auth()
      if (!session) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
    }

    const media = await db.getMarkdownNoteMedia(noteId, mediaId)
    if (!media?.file_data) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 })
    }

    const fileData = media.file_data as { buffer?: ArrayBufferLike } | Buffer
    let buffer: Buffer
    if (Buffer.isBuffer(fileData)) {
      buffer = fileData
    } else if (fileData && typeof fileData === "object" && "buffer" in fileData && fileData.buffer) {
      buffer = Buffer.from(fileData.buffer as ArrayBufferLike)
    } else {
      return NextResponse.json({ error: "Invalid media data" }, { status: 500 })
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": (media.mime_type as string) || "application/octet-stream",
        "Cache-Control": "private, max-age=31536000",
        "Content-Length": buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("Markdown note media error:", error)
    return NextResponse.json({ error: "Failed to serve media" }, { status: 500 })
  }
}
