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
    const query = url.searchParams.get('q')
    
    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 })
    }
    
    // Build Microsoft Graph API search URL
    const graphUrl = `https://graph.microsoft.com/v1.0/me/drive/search(q='${encodeURIComponent(query)}')`
    
    // Call Microsoft Graph API to search OneDrive
    const graphResponse = await fetch(graphUrl, {
      headers: {
        "Authorization": `Bearer ${session.provider_token}`,
        "Content-Type": "application/json"
      }
    })

    if (!graphResponse.ok) {
      if (graphResponse.status === 401) {
        return NextResponse.json({ error: "Access token expired. Please sign in again." }, { status: 401 })
      }
      throw new Error(`Microsoft Graph API error: ${graphResponse.status}`)
    }

    const data = await graphResponse.json()
    
    // Process search results - only return files, not folders
    const files = data.value.filter((item: any) => 
      item.file && (
        item.file.mimeType?.includes("pdf") ||
        item.file.mimeType?.includes("document") ||
        item.file.mimeType?.includes("spreadsheet") ||
        item.file.mimeType?.includes("presentation") ||
        item.file.mimeType?.includes("text") ||
        item.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt)$/i)
      )
    ).map((item: any) => ({
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
    }))

    return NextResponse.json({ files })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to search OneDrive files" },
      { status: 500 }
    )
  }
}