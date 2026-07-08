import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { cacheFaviconForUrl } from '@/lib/favicon-cache'
import { fetchWebsiteMetadata, isValidWebsiteUrl } from '@/lib/website-metadata'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { url } = await request.json()
    if (typeof url !== 'string' || !isValidWebsiteUrl(url)) {
      return NextResponse.json({ error: 'Please provide a valid website URL' }, { status: 400 })
    }

    const metadata = await fetchWebsiteMetadata(url)

    // Metadata is useful immediately; favicon mirroring is cached by domain so repeated links share one stored icon.
    if (metadata.icon) {
      try {
        const cachedFavicon = await cacheFaviconForUrl({
          href: url,
          iconUrl: metadata.icon,
          referer: url,
        })

        if (cachedFavicon) {
          metadata.icon = cachedFavicon.icon
        }
      } catch (error) {
        console.warn('Failed to cache favicon:', error)
      }
    }

    return NextResponse.json(metadata)
  } catch (error) {
    console.error('Failed to fetch website metadata:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch website metadata' },
      { status: 500 }
    )
  }
}
