import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { makeGraphRequest } from "@/lib/utils/onedrive"
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/utils/rate-limit"
import type { OneDriveItem, OneDriveProcessedItem, OneDriveFolderItem, OneDriveFileItem } from "@/lib/types/onedrive"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limiting
  const rateLimitResult = checkRateLimit(`onedrive-files:session`, RATE_LIMITS.ONEDRIVE_FILES)
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult.resetTime)
  }

  try {
    // Parse query parameters
    const url = new URL(request.url)
    const path = url.searchParams.get('path') || '/drive/root:'

    // Validate path parameter to prevent path traversal attacks
    const validPathPatterns = [
      /^\/drive\/root:$/,
      /^\/drive\/items\/[a-zA-Z0-9!]+$/,
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
      graphUrl = 'https://graph.microsoft.com/v1.0/me/drive/root/children'
    } else {
      graphUrl = `https://graph.microsoft.com/v1.0/me${path}/children`
    }

    const graphResponse = await makeGraphRequest(graphUrl)
    const data = await graphResponse.json()

    if (!data || !data.value) {
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
