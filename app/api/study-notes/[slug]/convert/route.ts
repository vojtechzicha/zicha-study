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

// Cache directory for converted files
const CACHE_DIR = path.join(os.tmpdir(), "study-notes-cache")

interface ConversionResult {
  html: string
  mediaPath: string | null
  cacheKey: string
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params
  
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
    
    // Generate cache key based on file ID and modification time
    const cacheKey = crypto
      .createHash("md5")
      .update(`${note.onedrive_id}-${note.last_modified_onedrive || note.updated_at}`)
      .digest("hex")
    
    const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`)
    
    // Check if we have a cached version
    try {
      await fs.access(cacheFilePath)
      const cachedData = await fs.readFile(cacheFilePath, "utf-8")
      const cached = JSON.parse(cachedData) as ConversionResult
      
      // Return cached version
      return NextResponse.json({
        html: cached.html,
        mediaPath: cached.mediaPath,
        cacheKey: cached.cacheKey,
        cached: true
      })
    } catch {
      // Cache miss, continue with conversion
    }
    
    // Download the DOCX file from OneDrive
    const downloadUrl = note.onedrive_download_url
    if (!downloadUrl) {
      // If no download URL, try to get it using the file ID
      const graphUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${note.onedrive_id}/content`
      const response = await OneDriveTokenManager.makeAuthenticatedRequest(graphUrl)
      
      if (!response.ok) {
        throw new Error("Failed to download file from OneDrive")
      }
      
      const fileBuffer = await response.arrayBuffer()
      const result = await convertDocxToHtml(
        Buffer.from(fileBuffer),
        note.file_name,
        cacheKey
      )
      
      // Cache the result
      await fs.mkdir(CACHE_DIR, { recursive: true })
      await fs.writeFile(cacheFilePath, JSON.stringify(result))
      
      return NextResponse.json({
        ...result,
        cached: false
      })
    }
    
    // Download using the download URL
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error("Failed to download file from OneDrive")
    }
    
    const fileBuffer = await response.arrayBuffer()
    const result = await convertDocxToHtml(
      Buffer.from(fileBuffer),
      note.file_name,
      cacheKey
    )
    
    // Cache the result
    await fs.mkdir(CACHE_DIR, { recursive: true })
    await fs.writeFile(cacheFilePath, JSON.stringify(result))
    
    return NextResponse.json({
      ...result,
      cached: false
    })
  } catch (error) {
    console.error("Conversion error:", error)
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
  const tempDir = path.join(os.tmpdir(), `docx-conversion-${cacheKey}`)
  // Use a sanitized filename to avoid issues with special characters
  const sanitizedFileName = "document.docx"
  const docxPath = path.join(tempDir, sanitizedFileName)
  const htmlPath = path.join(tempDir, "output.html")
  const mediaDir = path.join(tempDir, "media")
  const luaFilterPath = path.join(process.cwd(), "lib", "utils", "remove-toc.lua")
  const templatePath = path.join(process.cwd(), "lib", "utils", "study-note-template.html")
  
  try {
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true })
    
    // Write DOCX file
    await fs.writeFile(docxPath, fileBuffer)
    
    // Verify file was written
    try {
      const stats = await fs.stat(docxPath)
      console.log(`DOCX file written: ${docxPath}, size: ${stats.size} bytes`)
    } catch (err) {
      throw new Error(`Failed to write DOCX file: ${err}`)
    }
    
    // Check if Lua filter exists
    let luaFilterArg = ""
    try {
      await fs.access(luaFilterPath)
      luaFilterArg = `--lua-filter="${luaFilterPath}"`
    } catch {
      console.warn("Lua filter not found, proceeding without it")
    }
    
    // Check if template exists
    let templateArg = ""
    try {
      await fs.access(templatePath)
      templateArg = `--template=${templatePath}`
    } catch {
      console.warn("Template not found, using default")
    }
    
    // Build Pandoc arguments array (safer than string concatenation)
    const pandocArgs = [
      docxPath,
      "-f", "docx",
      "-t", "html5",
      "-s",
      "-o", htmlPath,
      "--katex",
      "--toc",
      "--toc-depth=3",
      `--extract-media=${mediaDir}`,
      "--wrap=none",
      "--metadata=document-css:false",
      "--no-highlight"
    ]
    
    if (templateArg) {
      pandocArgs.push(templateArg)
    }
    
    if (luaFilterArg) {
      pandocArgs.push(`--lua-filter=${luaFilterPath}`)
    }
    
    // Run Pandoc with error handling using spawn for better argument handling
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
            reject(new Error("Pandoc is not installed. Please install Pandoc to use this feature."))
          } else {
            reject(error)
          }
        })
        
        pandocProcess.on("close", (code) => {
          if (code === 0) {
            if (stderr) {
              console.warn("Pandoc warnings:", stderr)
            }
            resolve()
          } else {
            reject(new Error(`Pandoc exited with code ${code}: ${stderr}`))
          }
        })
      })
    } catch (error: any) {
      console.error("Pandoc error:", error.message)
      throw new Error(`Document conversion failed: ${error.message}`)
    }
    
    // Read the generated HTML
    let html = await fs.readFile(htmlPath, "utf-8")
    
    // Extract title from the document
    let title: string | null = null
    const titleMatch = html.match(/<h1[^>]*class="study-note-title"[^>]*>([^<]+)<\/h1>/i)
    if (titleMatch) {
      title = titleMatch[1].trim()
    }
    
    // Extract body content if standalone was generated
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    if (bodyMatch) {
      html = bodyMatch[1]
    }
    
    // Remove any title blocks that Pandoc might have generated
    html = html.replace(/<header[^>]*id="title-block-header"[^>]*>[\s\S]*?<\/header>/gi, '')
    
    // Check if media directory was created
    let hasMedia = false
    try {
      const mediaStat = await fs.stat(mediaDir)
      hasMedia = mediaStat.isDirectory()
      
      // Also check if it has any files
      if (hasMedia) {
        const mediaFiles = await fs.readdir(mediaDir)
        hasMedia = mediaFiles.length > 0
        if (hasMedia) {
          console.log(`Media directory contains ${mediaFiles.length} files:`, mediaFiles.slice(0, 5))
        }
      }
    } catch {
      // No media directory or it's empty
      hasMedia = false
    }
    
    // Move media to permanent cache location if it exists
    let mediaPath: string | null = null
    if (hasMedia) {
      mediaPath = path.join(CACHE_DIR, `media-${cacheKey}`)
      
      // Ensure cache directory exists
      await fs.mkdir(CACHE_DIR, { recursive: true })
      
      // Remove old media path if it exists
      await fs.rm(mediaPath, { recursive: true, force: true }).catch(() => {})
      
      // Move the media directory
      await fs.rename(mediaDir, mediaPath)
    }
    
    // Clean up temp files (except media which was moved)
    await fs.rm(tempDir, { recursive: true, force: true })
    
    return {
      html,
      mediaPath: hasMedia ? `media-${cacheKey}` : null,
      cacheKey,
      title
    }
  } catch (error) {
    // Clean up on error
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

// Cleanup old cache files (run periodically)
export async function DELETE() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true })
    const files = await fs.readdir(CACHE_DIR)
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    
    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file)
      const stats = await fs.stat(filePath)
      
      if (now - stats.mtimeMs > maxAge) {
        await fs.rm(filePath, { recursive: true, force: true })
      }
    }
    
    return NextResponse.json({ message: "Cache cleaned" })
  } catch {
    return NextResponse.json(
      { error: "Failed to clean cache" },
      { status: 500 }
    )
  }
}