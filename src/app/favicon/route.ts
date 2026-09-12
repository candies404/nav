import { NextResponse } from 'next/server'
import { getSiteContent } from '@/lib/content-cache'

export const runtime = 'nodejs'
export const preferredRegion = 'sin1'

const FALLBACK_FAVICON = '/assets/images/favicon.webp'
const FAVICON_READ_TIMEOUT_MS = 1_000

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  let favicon = FALLBACK_FAVICON

  try {
    const site = await getSiteContent({ requestTimeoutMs: FAVICON_READ_TIMEOUT_MS })
    favicon = getSafeFavicon(site.appearance?.favicon, requestUrl.origin)
  } catch (error) {
    console.warn('Failed to load configured favicon, using fallback:', error)
  }

  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: favicon,
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

function getSafeFavicon(value: string | undefined, origin: string) {
  const favicon = value?.trim()
  if (!favicon || isFaviconRoute(favicon)) return FALLBACK_FAVICON

  if (favicon.startsWith('/') && !favicon.startsWith('//')) {
    try {
      const relativeUrl = new URL(favicon, 'http://navsphere.local')
      return isFaviconRoute(relativeUrl.pathname) ? FALLBACK_FAVICON : favicon
    } catch {
      return FALLBACK_FAVICON
    }
  }

  try {
    const faviconUrl = new URL(favicon)
    if (faviconUrl.protocol !== 'http:' && faviconUrl.protocol !== 'https:') {
      return FALLBACK_FAVICON
    }

    if (faviconUrl.origin === origin && isFaviconRoute(faviconUrl.pathname)) {
      return FALLBACK_FAVICON
    }

    return faviconUrl.toString()
  } catch {
    return FALLBACK_FAVICON
  }
}

function isFaviconRoute(pathname: string) {
  return pathname === '/favicon' || pathname === '/favicon.ico'
}
