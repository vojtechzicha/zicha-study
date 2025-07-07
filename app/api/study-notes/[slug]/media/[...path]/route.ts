import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import os from "os"

const CACHE_DIR = path.join(os.tmpdir(), "study-notes-cache")

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
  const { path: pathSegments } = params
  
  if (!pathSegments || pathSegments.length === 0) {
    return NextResponse.json({ error: "Invalid media path" }, { status: 400 })
  }
  
  try {
    // Extract cache key from the URL
    const url = new URL(request.url)
    const cacheKey = url.searchParams.get("key")
    
    if (!cacheKey) {
      return NextResponse.json({ error: "Missing cache key" }, { status: 400 })
    }
    
    // Construct the media file path
    const mediaDir = path.join(CACHE_DIR, `media-${cacheKey}`)
    
    // Handle the case where "media" might be duplicated in the path
    let cleanedSegments = [...pathSegments]
    if (cleanedSegments[0] === 'media' && cleanedSegments.length > 1) {
      // Remove the first "media" if it's duplicated
      cleanedSegments = cleanedSegments.slice(1)
    }
    
    const mediaPath = path.join(mediaDir, ...cleanedSegments)
    
    // Security: Ensure the resolved path is within the media directory
    const resolvedPath = path.resolve(mediaPath)
    const resolvedMediaDir = path.resolve(mediaDir)
    
    if (!resolvedPath.startsWith(resolvedMediaDir)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 403 })
    }
    
    // Check if file exists
    try {
      await fs.access(mediaPath)
    } catch {
      return NextResponse.json({ error: "Media not found" }, { status: 404 })
    }
    
    // Read the file
    const fileBuffer = await fs.readFile(mediaPath)
    
    // Determine MIME type
    const ext = path.extname(mediaPath).toLowerCase()
    const mimeType = MIME_TYPES[ext] || "application/octet-stream"
    
    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeType,
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