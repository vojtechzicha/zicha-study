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
import { isPandocAvailable, getPandocUnavailableMessage } from "@/lib/utils/pandoc-vercel"

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
    // Check if we're on Vercel
    if (!isPandocAvailable()) {
      // Return from cache if available
      const supabase = await createServerClient()
      
      const { data: note } = await supabase
        .from("study_notes")
        .select("*")
        .eq("public_slug", slug)
        .eq("is_public", true)
        .single()
        
      if (note) {
        const { data: cachedData } = await supabase
          .from("study_notes_cache")
          .select("*")
          .eq("study_note_id", note.id)
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
            vercelDeployment: true
          })
        }
      }
      
      // No cache available, return error message
      return NextResponse.json({
        html: getPandocUnavailableMessage(),
        title: "Konverze není dostupná",
        cached: false,
        vercelDeployment: true,
        error: "Pandoc not available on Vercel"
      })
    }
    
    // Check if Pandoc is installed (for non-Vercel environments)
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
      const tokenResult = await OneDriveTokenManager.getValidToken()
      
      if (!tokenResult.token) {
        console.error("No OneDrive token available:", tokenResult.error)
        onedriveAccessible = false
      } else {
        // Get file metadata using direct API with the file's OneDrive ID
        const metadataResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${note.onedrive_id}`,
          {
            headers: { Authorization: `Bearer ${tokenResult.token}` }
          }
        )
        
        if (metadataResponse.ok) {
          const fileData = await metadataResponse.json()
          onedriveLastModified = new Date(fileData.lastModifiedDateTime)
          console.log("OneDrive file last modified:", fileData.lastModifiedDateTime)
          
          // Download the file content
          const downloadResponse = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/items/${note.onedrive_id}/content`,
            {
              headers: { Authorization: `Bearer ${tokenResult.token}` }
            }
          )
          
          if (downloadResponse.ok) {
            fileBuffer = await downloadResponse.arrayBuffer()
          } else {
            console.error("Failed to download file content:", downloadResponse.status)
          }
        } else {
          console.error("Failed to get file metadata:", metadataResponse.status)
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
    
    // Generate new cache key including generation time for cache busting
    const cacheKey = crypto
      .createHash("md5")
      .update(`${note.id}-${onedriveLastModified?.toISOString() || 'unknown'}-${Date.now()}`)
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
          onedrive_last_modified: onedriveLastModified || cachedData.onedrive_last_modified,
          generated_at: new Date(),
          cache_key: cacheKey,
          has_media: !!result.mediaPath
        })
        .eq("study_note_id", note.id)
    } else {
      // Insert new cache - only insert if we have a valid last modified date
      if (!onedriveLastModified) {
        throw new Error("Unable to determine file modification date from OneDrive")
      }
      
      await supabase
        .from("study_notes_cache")
        .insert({
          study_note_id: note.id,
          html_content: result.html,
          title: result.title,
          onedrive_last_modified: onedriveLastModified,
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
      
      // Convert to hex string for PostgreSQL BYTEA
      // Supabase expects hex string with \x prefix for BYTEA columns
      const hexString = `\\x${fileData.toString('hex')}`
      
      await supabase
        .from("study_notes_media")
        .insert({
          cache_id: cacheRecord.id,
          file_path: `media/${file}`,
          file_data: hexString,
          mime_type: mimeTypes[ext] || 'application/octet-stream'
        })
    }
    
    // Clean up temp media directory
    await fs.rm(mediaPath, { recursive: true, force: true })
  } catch (error) {
    console.error("Error storing media in database:", error)
  }
}