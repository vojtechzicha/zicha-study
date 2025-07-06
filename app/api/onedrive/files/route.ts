import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = await createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get the user's access token from Supabase
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.provider_token) {
      return NextResponse.json({ error: "No access token available" }, { status: 401 })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const path = url.searchParams.get('path') || '/drive/root:'
    
    console.log('OneDrive API - Requested path:', path)
    
    // Build Microsoft Graph API URL
    let graphUrl: string
    if (path === '/drive/root:') {
      // For root folder, use the correct endpoint
      graphUrl = 'https://graph.microsoft.com/v1.0/me/drive/root/children'
    } else {
      // For specific folders, use the item ID format
      graphUrl = `https://graph.microsoft.com/v1.0/me${path}/children`
    }
    console.log('OneDrive API - Graph URL:', graphUrl)
    
    // Call Microsoft Graph API to get OneDrive items
    const graphResponse = await fetch(graphUrl, {
      headers: {
        "Authorization": `Bearer ${session.provider_token}`,
        "Content-Type": "application/json"
      }
    })

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text()
      console.error('OneDrive API - Graph response error:', graphResponse.status, errorText)
      
      if (graphResponse.status === 401) {
        return NextResponse.json({ error: "Access token expired. Please sign in again." }, { status: 401 })
      }
      throw new Error(`Microsoft Graph API error: ${graphResponse.status} - ${errorText}`)
    }

    const data = await graphResponse.json()
    
    // Process all items (folders and files)
    const items = data.value.map((item: any) => {
      if (item.folder) {
        // It's a folder
        return {
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
      } else if (item.file && (
        item.file.mimeType?.includes("pdf") ||
        item.file.mimeType?.includes("document") ||
        item.file.mimeType?.includes("spreadsheet") ||
        item.file.mimeType?.includes("presentation") ||
        item.file.mimeType?.includes("text") ||
        item.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt)$/i)
      )) {
        // It's a document file
        return {
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
      }
      return null
    }).filter(Boolean)

    // Sort folders first, then files
    items.sort((a: any, b: any) => {
      if (a.folder && !b.folder) return -1
      if (!a.folder && b.folder) return 1
      return a.name.localeCompare(b.name)
    })

    console.log('OneDrive API - Success, returning', items.length, 'items')
    return NextResponse.json({ files: items })
  } catch (error) {
    console.error('OneDrive API - Catch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to access OneDrive files" },
      { status: 500 }
    )
  }
}