import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { OneDriveTokenManagerV2 } from "@/lib/utils/onedrive-token-manager-v2"
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/utils/rate-limit"
import type { OneDriveItem, OneDriveProcessedItem, OneDriveFolderItem, OneDriveFileItem } from "@/lib/types/onedrive"

export async function GET(request: Request) {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limiting
  const rateLimitResult = checkRateLimit(`onedrive-files:${user.id}`, RATE_LIMITS.ONEDRIVE_FILES)
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult.resetTime)
  }

  try {
    // Parse query parameters
    const url = new URL(request.url)
    const path = url.searchParams.get('path') || '/drive/root:'

    // Validate path parameter to prevent path traversal attacks
    // Valid paths are:
    // 1. '/drive/root:' - root folder
    // 2. '/drive/items/{itemId}' - specific folder by ID
    // Reject any path containing '..' or other suspicious patterns
    const validPathPatterns = [
      /^\/drive\/root:$/,  // Root folder
      /^\/drive\/items\/[a-zA-Z0-9!]+$/,  // Item by ID (OneDrive IDs are alphanumeric with possible '!')
    ]

    const isValidPath = validPathPatterns.some(pattern => pattern.test(path))
    if (!isValidPath) {
      return NextResponse.json(
        { error: "Invalid path parameter" },
        { status: 400 }
      )
    }

    // Build Microsoft Graph API URL
    let graphUrl: string
    if (path === '/drive/root:') {
      // For root folder, use the correct endpoint
      graphUrl = 'https://graph.microsoft.com/v1.0/me/drive/root/children'
    } else {
      // For specific folders, use the item ID format
      graphUrl = `https://graph.microsoft.com/v1.0/me${path}/children`
    }
    
    // Use the centralized token manager to make the request
    const graphResponse = await OneDriveTokenManagerV2.makeAuthenticatedRequest(graphUrl)

    const data = await graphResponse.json()
    
    // Check if the response has the expected structure
    if (!data || !data.value) {
      // Check if it's a permission error
      if (data?.error?.code === 'itemNotFound') {
        return NextResponse.json(
          { error: "Folder not found or no access permission" },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: data?.error?.message || "Invalid response from OneDrive" },
        { status: 500 }
      )
    }
    
    // Process all items (folders and files)
    const items: OneDriveProcessedItem[] = data.value
      .map((item: OneDriveItem): OneDriveProcessedItem | null => {
        if (item.folder) {
          // It's a folder
          const folderItem: OneDriveFolderItem = {
            id: item.id,
            name: item.name,
            webUrl: item.webUrl,
            createdDateTime: item.createdDateTime,
            lastModifiedDateTime: item.lastModifiedDateTime,
            parentReference: item.parentReference,
            folder: {
              childCount: item.folder.childCount
            }
          }
          return folderItem
        } else if (item.file && (
          item.file.mimeType?.includes("pdf") ||
          item.file.mimeType?.includes("document") ||
          item.file.mimeType?.includes("spreadsheet") ||
          item.file.mimeType?.includes("presentation") ||
          item.file.mimeType?.includes("text") ||
          item.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|pod)$/i)
        )) {
          // It's a document file
          const fileItem: OneDriveFileItem = {
            id: item.id,
            name: item.name,
            size: item.size,
            webUrl: item.webUrl,
            createdDateTime: item.createdDateTime,
            lastModifiedDateTime: item.lastModifiedDateTime,
            "@microsoft.graph.downloadUrl": item["@microsoft.graph.downloadUrl"],
            file: {
              mimeType: item.file.mimeType
            },
            parentReference: item.parentReference
          }
          return fileItem
        }
        return null
      })
      .filter((item: OneDriveProcessedItem | null): item is OneDriveProcessedItem => item !== null)

    // Sort folders first, then files
    items.sort((a, b) => {
      const aIsFolder = 'folder' in a
      const bIsFolder = 'folder' in b
      if (aIsFolder && !bIsFolder) return -1
      if (!aIsFolder && bIsFolder) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({ files: items })
  } catch (error) {
    // Check if it's a token-related error
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json(
        { error: error.message, needsReauth: true },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to access OneDrive files" },
      { status: 500 }
    )
  }
}