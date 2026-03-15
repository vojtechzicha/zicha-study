import { NextRequest, NextResponse } from "next/server"
import * as db from "@/lib/mongodb/db"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string; path: string[] }> }
) {
  const params = await context.params
  const { slug, path: pathSegments } = params
  const { searchParams } = new URL(request.url)
  const studyId = searchParams.get('studyId')

  if (!pathSegments || pathSegments.length === 0) {
    return NextResponse.json({ error: "Invalid media path" }, { status: 400 })
  }

  try {
    // Get the study note by public slug and study_id
    const note = await db.getPublicStudyNoteBySlug(slug, studyId || undefined)

    if (!note) {
      return NextResponse.json({ error: "Study note not found" }, { status: 404 })
    }

    const noteId = note._id as string

    // Get the cache record
    const cache = await db.getStudyNotesCache(noteId)

    if (!cache) {
      return NextResponse.json({ error: "No cached content found" }, { status: 404 })
    }

    const cacheId = cache._id as string

    // Construct the file path
    let cleanedSegments = [...pathSegments]
    if (cleanedSegments[0] === 'media' && cleanedSegments.length > 1) {
      cleanedSegments = cleanedSegments.slice(1)
    }

    const filePath = `media/${cleanedSegments.join('/')}`

    // Get the media file from database
    const mediaFile = await db.getMediaFile(cacheId, filePath)

    if (!mediaFile) {
      console.error("Media not found:", filePath)
      return NextResponse.json({ error: "Media file not found" }, { status: 404 })
    }

    // MongoDB Binary - extract the buffer directly
    let fileBuffer: Buffer
    if (mediaFile.file_data && typeof mediaFile.file_data === 'object' && 'buffer' in mediaFile.file_data) {
      // MongoDB Binary type
      fileBuffer = Buffer.from(mediaFile.file_data.buffer)
    } else if (Buffer.isBuffer(mediaFile.file_data)) {
      fileBuffer = mediaFile.file_data
    } else {
      console.error("Unexpected file_data type:", typeof mediaFile.file_data)
      return NextResponse.json({ error: "Invalid media data format" }, { status: 500 })
    }

    if (fileBuffer.length === 0) {
      console.error("Empty buffer after decoding")
      return NextResponse.json({ error: "Empty media file" }, { status: 500 })
    }

    // Return the file with appropriate headers
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": mediaFile.mime_type || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
        "Content-Length": fileBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("Media serving error:", error)
    return NextResponse.json(
      { error: "Failed to serve media" },
      { status: 500 }
    )
  }
}
