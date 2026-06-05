import { getAsset } from '@/lib/storage'

export const runtime = 'edge'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const asset = await getAsset(decodeURIComponent(id))

  if (!asset) {
    return new Response('Not found', { status: 404 })
  }

  const binaryData = Uint8Array.from(atob(asset.base64), char => char.charCodeAt(0))

  return new Response(binaryData, {
    headers: {
      'Content-Type': asset.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
