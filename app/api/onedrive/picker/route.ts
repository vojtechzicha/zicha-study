import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET() {
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

    // Call Microsoft Graph API to get OneDrive files
    const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/drive/root/children", {
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
    
    // Filter for files only (not folders) and include common document types
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
      { error: "Failed to access OneDrive files" },
      { status: 500 }
    )
  }
}