import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { OneDriveTokenManagerV2 } from "@/lib/utils/onedrive-token-manager-v2"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { onedriveId } = await request.json()
    
    if (!onedriveId) {
      return NextResponse.json({ error: "OneDrive ID is required" }, { status: 400 })
    }

    // Try to create a public share link for the OneDrive file
    // Personal Microsoft accounts may not support anonymous sharing
    let shareResponse = await OneDriveTokenManagerV2.makeAuthenticatedRequest(
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
      
      // For personal accounts, anonymous sharing may not be supported
      // Fall back to getting the file info and creating a shareable link manually
      if (errorData.error?.code === 'accessDenied') {
        // Get the file metadata to construct a public share URL
        const fileResponse = await OneDriveTokenManagerV2.makeAuthenticatedRequest(
          `https://graph.microsoft.com/v1.0/me/drive/items/${onedriveId}`
        )

        if (fileResponse.ok) {
          const fileData = await fileResponse.json()
          // Use the web URL which should be publicly accessible for personal OneDrive
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
    
    // Check if it's a token-related error
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