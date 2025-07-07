import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { OneDriveTokenManager } from "@/lib/utils/onedrive-token-manager"
import { exec } from "child_process"
import { promisify } from "util"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import os from "os"
import { checkPandocInstallation } from "@/lib/utils/check-pandoc"

const execAsync = promisify(exec)

interface ConversionResult {
  html: string
  mediaPath: string | null
  cacheKey: string
  title: string | null
}

interface CacheData {
  html_content: string
  title: string | null
  onedrive_last_modified: string
  generated_at: string
  cache_key: string
  has_media: boolean
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params
  const { searchParams } = new URL(request.url)
  const forceRegenerate = searchParams.get("flush") === "1"
  
  try {
    // Check if Pandoc is installed
    const pandocInstalled = await checkPandocInstallation()
    if (!pandocInstalled) {
      return NextResponse.json(
        { error: "Pandoc is not installed on the server. Please contact the administrator." },
        { status: 500 }
      )
    }
    
    const supabase = await createServerClient()
    
    // Get the study note by public slug
    const { data: note, error } = await supabase
      .from("study_notes")
      .select("*")
      .eq("public_slug", slug)
      .eq("is_public", true)
      .single()
    
    if (error || !note) {
      return NextResponse.json({ error: "Study note not found" }, { status: 404 })
    }
    
    // Check if we have a cached version
    const { data: cachedData } = await supabase
      .from("study_notes_cache")
      .select("*")
      .eq("study_note_id", note.id)
      .single()
    
    let onedriveLastModified: Date | null = null
    let onedriveAccessible = true
    let fileBuffer: ArrayBuffer | null = null
    
    // Try to access OneDrive to check for updates
    try {
      // Get download URL from OneDrive
      const downloadUrl = note.onedrive_download_url
      if (!downloadUrl) {
        // Try to get from share link
        const shareUrl = note.onedrive_web_url
        const tokenManager = new OneDriveTokenManager()
        const token = await tokenManager.getAccessToken()
        
        const shareResponse = await fetch(
          `https://graph.microsoft.com/v1.0/shares/${encodeURIComponent(btoa(shareUrl))}/driveItem`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        )
        
        if (shareResponse.ok) {
          const shareData = await shareResponse.json()
          onedriveLastModified = new Date(shareData.lastModifiedDateTime)
          
          // Download the file
          const downloadResponse = await fetch(
            `https://graph.microsoft.com/v1.0/shares/${encodeURIComponent(btoa(shareUrl))}/driveItem/content`,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          )
          
          if (downloadResponse.ok) {
            fileBuffer = await downloadResponse.arrayBuffer()
          }
        }
      } else {
        // Direct download URL
        const response = await fetch(downloadUrl)
        if (response.ok) {
          fileBuffer = await response.arrayBuffer()
          // Try to get last modified from headers
          const lastModified = response.headers.get("last-modified")
          if (lastModified) {
            onedriveLastModified = new Date(lastModified)
          }
        }
      }
    } catch (error) {
      console.error("OneDrive access error:", error)
      onedriveAccessible = false
    }
    
    // Determine if we should use cache or regenerate
    const shouldRegenerate = forceRegenerate || 
      !cachedData || 
      (onedriveAccessible && fileBuffer && onedriveLastModified && 
        new Date(cachedData.onedrive_last_modified) < onedriveLastModified)
    
    if (!shouldRegenerate && cachedData) {
      // Use cached version
      console.log("Using cached version for:", slug)
      
      return NextResponse.json({
        html: cachedData.html_content,
        title: cachedData.title,
        cacheKey: cachedData.cache_key,
        mediaPath: cachedData.has_media ? `media-${cachedData.cache_key}` : null,
        cached: true,
        onedriveLastModified: cachedData.onedrive_last_modified,
        generatedAt: cachedData.generated_at,
        onedriveAccessible
      })
    }
    
    // Need to regenerate
    if (!fileBuffer) {
      if (cachedData) {
        // OneDrive not accessible but we have cache
        return NextResponse.json({
          html: cachedData.html_content,
          title: cachedData.title,
          cacheKey: cachedData.cache_key,
          mediaPath: cachedData.has_media ? `media-${cachedData.cache_key}` : null,
          cached: true,
          onedriveLastModified: cachedData.onedrive_last_modified,
          generatedAt: cachedData.generated_at,
          onedriveAccessible: false
        })
      }
      
      return NextResponse.json(
        { error: "Unable to access file and no cache available" },
        { status: 500 }
      )
    }
    
    // Generate new cache key
    const cacheKey = crypto
      .createHash("md5")
      .update(`${note.id}-${onedriveLastModified?.toISOString() || Date.now()}`)
      .digest("hex")
    
    // Convert the document
    const result = await convertDocxToHtml(
      Buffer.from(fileBuffer),
      note.file_name,
      cacheKey
    )
    
    // Store in database
    if (cachedData) {
      // Update existing cache
      await supabase
        .from("study_notes_cache")
        .update({
          html_content: result.html,
          title: result.title,
          onedrive_last_modified: onedriveLastModified || new Date(),
          generated_at: new Date(),
          cache_key: cacheKey,
          has_media: !!result.mediaPath
        })
        .eq("study_note_id", note.id)
    } else {
      // Insert new cache
      await supabase
        .from("study_notes_cache")
        .insert({
          study_note_id: note.id,
          html_content: result.html,
          title: result.title,
          onedrive_last_modified: onedriveLastModified || new Date(),
          cache_key: cacheKey,
          has_media: !!result.mediaPath
        })
    }
    
    // Store media files if any
    if (result.mediaPath) {
      await storeMediaInDatabase(note.id, result.mediaPath)
    }
    
    return NextResponse.json({
      ...result,
      cached: false,
      onedriveLastModified: onedriveLastModified?.toISOString(),
      generatedAt: new Date().toISOString(),
      onedriveAccessible
    })
  } catch (error) {
    console.error("Conversion error:", error)
    
    // Try to return cached version if available
    try {
      const supabase = await createServerClient()
      
      // Get the study note again to ensure we have the ID
      const { data: noteForCache } = await supabase
        .from("study_notes")
        .select("id")
        .eq("public_slug", slug)
        .eq("is_public", true)
        .single()
      
      if (noteForCache) {
        const { data: cachedData } = await supabase
          .from("study_notes_cache")
          .select("*")
          .eq("study_note_id", noteForCache.id)
          .single()
        
        if (cachedData) {
          return NextResponse.json({
            html: cachedData.html_content,
            title: cachedData.title,
            cacheKey: cachedData.cache_key,
            mediaPath: cachedData.has_media ? `media-${cachedData.cache_key}` : null,
            cached: true,
            onedriveLastModified: cachedData.onedrive_last_modified,
            generatedAt: cachedData.generated_at,
            onedriveAccessible: false,
            error: "Fell back to cache due to error"
          })
        }
      }
    } catch (cacheError) {
      console.error("Cache fallback error:", cacheError)
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Conversion failed" },
      { status: 500 }
    )
  }
}

async function convertDocxToHtml(
  fileBuffer: Buffer,
  fileName: string,
  cacheKey: string
): Promise<ConversionResult> {
  // Create a temporary directory for this conversion
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "docx-convert-"))
  
  try {
    // Write the DOCX file with sanitized name
    const docxPath = path.join(tempDir, "document.docx")
    await fs.writeFile(docxPath, fileBuffer)
    
    // Output paths
    const htmlPath = path.join(tempDir, "output.html")
    const mediaDir = path.join(tempDir, "media")
    
    // Get template path
    const templatePath = path.join(process.cwd(), "lib/utils/study-note-template.html")
    const templateExists = await fs.access(templatePath).then(() => true).catch(() => false)
    
    // Check for Lua filter
    const luaFilterPath = path.join(process.cwd(), "lib/utils/remove-toc.lua")
    const luaFilterExists = await fs.access(luaFilterPath).then(() => true).catch(() => false)
    
    // Build Pandoc command with proper escaping
    const pandocArgs = [
      "document.docx",
      "-o", "output.html",
      "--standalone",
      "--toc",
      "--toc-depth=3",
      "--extract-media=.",
      "--wrap=none",
      "--metadata", "title-prefix=",
      "--metadata", "pagetitle=Study Note",
      "--css=study-note-content.css"
    ]
    
    // Copy template and lua filter to temp directory if they exist
    if (templateExists) {
      await fs.copyFile(templatePath, path.join(tempDir, "study-note-template.html"))
      pandocArgs.push("--template=study-note-template.html")
    }
    
    if (luaFilterExists) {
      await fs.copyFile(luaFilterPath, path.join(tempDir, "remove-toc.lua"))
      pandocArgs.push("--lua-filter=remove-toc.lua")
    }
    
    // Run Pandoc
    try {
      const { spawn } = await import("child_process")
      
      await new Promise<void>((resolve, reject) => {
        const pandocProcess = spawn("pandoc", pandocArgs, {
          cwd: tempDir,
          env: process.env
        })
        
        let stderr = ""
        pandocProcess.stderr.on("data", (data) => {
          stderr += data.toString()
        })
        
        pandocProcess.on("error", (error: any) => {
          if (error.code === "ENOENT") {
            reject(new Error("Pandoc is not installed"))
          } else {
            reject(error)
          }
        })
        
        pandocProcess.on("close", (code) => {
          if (code !== 0) {
            reject(new Error(`Pandoc exited with code ${code}: ${stderr}`))
          } else {
            resolve()
          }
        })
      })
    } catch (error: any) {
      throw new Error(`Document conversion failed: ${error.message}`)
    }
    
    // Read the generated HTML
    let html = await fs.readFile(htmlPath, "utf-8")
    
    // Extract title
    let title: string | null = null
    const titleMatch = html.match(/<h1[^>]*class="study-note-title"[^>]*>([^<]+)<\/h1>/i)
    if (titleMatch) {
      title = titleMatch[1].trim()
    }
    
    // Extract body content if standalone
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    if (bodyMatch) {
      html = bodyMatch[1]
    }
    
    // Remove title blocks
    html = html.replace(/<header[^>]*id="title-block-header"[^>]*>[\s\S]*?<\/header>/gi, '')
    
    // Check if media directory exists
    let hasMedia = false
    try {
      const mediaStat = await fs.stat(mediaDir)
      hasMedia = mediaStat.isDirectory()
      
      if (hasMedia) {
        const mediaFiles = await fs.readdir(mediaDir)
        hasMedia = mediaFiles.length > 0
      }
    } catch {
      hasMedia = false
    }
    
    return {
      html,
      mediaPath: hasMedia ? mediaDir : null,
      cacheKey,
      title
    }
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

async function storeMediaInDatabase(
  noteId: string,
  mediaPath: string
) {
  try {
    const supabase = await createServerClient()
    
    // Get cache record
    const { data: cacheRecord } = await supabase
      .from("study_notes_cache")
      .select("id")
      .eq("study_note_id", noteId)
      .single()
    
    if (!cacheRecord) return
    
    // Delete old media files
    await supabase
      .from("study_notes_media")
      .delete()
      .eq("cache_id", cacheRecord.id)
    
    // Read all media files
    const mediaFiles = await fs.readdir(mediaPath)
    
    for (const file of mediaFiles) {
      const filePath = path.join(mediaPath, file)
      const fileData = await fs.readFile(filePath)
      
      // Determine MIME type
      const ext = path.extname(file).toLowerCase()
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp'
      }
      
      await supabase
        .from("study_notes_media")
        .insert({
          cache_id: cacheRecord.id,
          file_path: `media/${file}`,
          file_data: fileData,
          mime_type: mimeTypes[ext] || 'application/octet-stream'
        })
    }
    
    // Clean up temp media directory
    await fs.rm(mediaPath, { recursive: true, force: true })
  } catch (error) {
    console.error("Error storing media in database:", error)
  }
}