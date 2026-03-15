import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { makeGraphRequest } from '@/lib/utils/onedrive'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/utils/rate-limit'

export async function GET() {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limiting
  const rateLimitResult = checkRateLimit(`onedrive-picker:session`, RATE_LIMITS.ONEDRIVE_FILES)
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult.resetTime)
  }

  try {
    const graphResponse = await makeGraphRequest('https://graph.microsoft.com/v1.0/me/drive/root/children')
    const data = await graphResponse.json()

    const files = data.value
      .filter(
        (item: any) =>
          item.file &&
          (item.file.mimeType?.includes('pdf') ||
            item.file.mimeType?.includes('document') ||
            item.file.mimeType?.includes('spreadsheet') ||
            item.file.mimeType?.includes('presentation') ||
            item.file.mimeType?.includes('text') ||
            item.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|pod)$/i))
      )
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        webUrl: item.webUrl,
        createdDateTime: item.createdDateTime,
        lastModifiedDateTime: item.lastModifiedDateTime,
        '@microsoft.graph.downloadUrl': item['@microsoft.graph.downloadUrl'],
        file: {
          mimeType: item.file.mimeType,
        },
        parentReference: item.parentReference,
      }))

    return NextResponse.json({ files })
  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message, needsReauth: true }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to access OneDrive files' }, { status: 500 })
  }
}
