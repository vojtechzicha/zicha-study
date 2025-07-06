import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

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

    // Get the access token from the user's session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.provider_token) {
      return NextResponse.json({ error: "No access token available" }, { status: 401 })
    }

    // Create a public share link for the OneDrive file
    const shareResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${onedriveId}/createLink`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.provider_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "view", // View-only permission
        scope: "anonymous" // No authentication required
      })
    })

    if (!shareResponse.ok) {
      const errorData = await shareResponse.json()
      console.error("Microsoft Graph API error:", errorData)
      return NextResponse.json(
        { error: errorData.error?.message || "Failed to create share link" },
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}