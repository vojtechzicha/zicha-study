import { NextRequest, NextResponse } from "next/server"
import { getLogoData } from "@/lib/mongodb/db"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  try {
    const study = await getLogoData(id)

    if (!study?.logo_data || !study?.logo_mime_type) {
      return NextResponse.json({ error: "Logo not found" }, { status: 404 })
    }

    const buffer = Buffer.from(study.logo_data.buffer)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": study.logo_mime_type,
        "Cache-Control": "public, max-age=86400",
        "Content-Length": buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("Logo serving error:", error)
    return NextResponse.json({ error: "Failed to serve logo" }, { status: 500 })
  }
}
