import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { makeGraphRequest } from "@/lib/utils/onedrive"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { onedriveId } = await request.json()

    if (!onedriveId) {
      return NextResponse.json({ error: "OneDrive ID is required" }, { status: 400 })
    }

    // Try to create a public share link for the OneDrive file
    let shareResponse = await makeGraphRequest(
      `https://graph.microsoft.com/v1.0/me/drive/items/${onedriveId}/createLink`,
      {
        method: "POST",
        body: JSON.stringify({
          type: "view",
          scope: "anonymous"
        })
      }
    )

    if (!shareResponse.ok) {
      const errorData = await shareResponse.json()
      console.error("Microsoft Graph API error:", errorData)

      if (errorData.error?.code === 'accessDenied') {
        const fileResponse = await makeGraphRequest(
          `https://graph.microsoft.com/v1.0/me/drive/items/${onedriveId}`
        )

        if (fileResponse.ok) {
          const fileData = await fileResponse.json()
          return NextResponse.json({
            shareUrl: fileData.webUrl,
            shareId: onedriveId
          })
        }
      }

      return NextResponse.json(
        {
          error: "Personal Microsoft accounts may not support anonymous file sharing. The file will still be accessible but may require Microsoft account login.",
          fallback: true
        },
        { status: shareResponse.status }
      )
    }

    const shareData = await shareResponse.json()

    return NextResponse.json({
      shareUrl: shareData.link.webUrl,
      shareId: shareData.id
    })
  } catch (error) {
    console.error("OneDrive share error:", error)

    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json(
        { error: error.message, needsReauth: true },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
