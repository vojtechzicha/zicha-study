import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string; path: string[] }> }
) {
  const params = await context.params
  const { slug, path: pathSegments } = params
  
  if (!pathSegments || pathSegments.length === 0) {
    return NextResponse.json({ error: "Invalid media path" }, { status: 400 })
  }
  
  try {
    const supabase = await createServerClient()
    
    // Get the study note by public slug
    const { data: note, error: noteError } = await supabase
      .from("study_notes")
      .select("id")
      .eq("public_slug", slug)
      .eq("is_public", true)
      .single()
    
    if (noteError || !note) {
      return NextResponse.json({ error: "Study note not found" }, { status: 404 })
    }
    
    // Get the cache record
    const { data: cache, error: cacheError } = await supabase
      .from("study_notes_cache")
      .select("id")
      .eq("study_note_id", note.id)
      .single()
    
    if (cacheError || !cache) {
      return NextResponse.json({ error: "No cached content found" }, { status: 404 })
    }
    
    // Construct the file path
    let cleanedSegments = [...pathSegments]
    if (cleanedSegments[0] === 'media' && cleanedSegments.length > 1) {
      cleanedSegments = cleanedSegments.slice(1)
    }
    
    const filePath = `media/${cleanedSegments.join('/')}`
    
    // Get the media file from database
    const { data: mediaFile, error: mediaError } = await supabase
      .from("study_notes_media")
      .select("file_data, mime_type")
      .eq("cache_id", cache.id)
      .eq("file_path", filePath)
      .single()
    
    if (mediaError || !mediaFile) {
      console.error("Media not found:", filePath, mediaError)
      return NextResponse.json({ error: "Media file not found" }, { status: 404 })
    }
    
    // Decode the base64 data from database
    const fileBuffer = Buffer.from(mediaFile.file_data, 'base64')
    
    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mediaFile.mime_type,
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