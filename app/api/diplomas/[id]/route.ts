import { NextRequest, NextResponse } from "next/server"
import { getDiplomaData } from "@/lib/mongodb/db"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  try {
    const study = await getDiplomaData(id)

    if (!study?.diploma_data || !study?.diploma_mime_type) {
      return NextResponse.json({ error: "Diploma not found" }, { status: 404 })
    }

    const buffer = Buffer.from(study.diploma_data.buffer)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": study.diploma_mime_type,
        "Cache-Control": "public, max-age=86400",
        "Content-Length": buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("Diploma serving error:", error)
    return NextResponse.json({ error: "Failed to serve diploma" }, { status: 500 })
  }
}
