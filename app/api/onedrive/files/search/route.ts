import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { makeGraphRequest } from "@/lib/utils/onedrive"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const query = url.searchParams.get('q')

    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 })
    }

    const graphUrl = `https://graph.microsoft.com/v1.0/me/drive/search(q='${encodeURIComponent(query)}')`
    const graphResponse = await makeGraphRequest(graphUrl)
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
    console.error("OneDrive search error:", error)

    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json(
        { error: error.message, needsReauth: true },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: "Failed to search OneDrive files" },
      { status: 500 }
    )
  }
}
