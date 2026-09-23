import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { makeGraphRequest } from "@/lib/utils/onedrive"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Nejste přihlášeni." }, { status: 401 })
    }

    const { onedriveId } = await request.json()

    if (!onedriveId) {
      return NextResponse.json({ error: "Chybí ID souboru v OneDrive." }, { status: 400 })
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
          error: "Nepodařilo se vytvořit veřejný odkaz. Osobní účty Microsoft nemusí anonymní sdílení podporovat.",
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
        { error: "Přístup k OneDrive vypršel. Přihlaste se znovu.", needsReauth: true },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: "Nepodařilo se vytvořit veřejný odkaz." },
      { status: 500 }
    )
  }
}
