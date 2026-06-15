import { getCachedFavicon, saveAsset, setCachedFavicon } from '@/lib/storage'

const ICON_FETCH_TIMEOUT_MS = 5_000
const MAX_ICON_BYTES = 512 * 1024
const IMAGE_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]

export type CachedFaviconResult = {
  icon: string
  cached: boolean
  domain: string
}

export function getDomainFromUrl(url: string) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export function getDomainFromFaviconProxy(icon?: string) {
  if (!icon) return ''

  try {
    if (icon.startsWith('/api/favicon?')) {
      return new URLSearchParams(icon.split('?')[1] || '').get('domain')?.toLowerCase() || ''
    }

    const parsed = new URL(icon)
    if (parsed.hostname === 'www.google.com' && parsed.pathname.startsWith('/s2/favicons')) {
      return parsed.searchParams.get('domain')?.toLowerCase() || ''
    }
  } catch {
    return ''
  }

  return ''
}

export function isGeneratedFaviconUrl(icon?: string) {
  if (!icon) return true

  if (icon.startsWith('/api/favicon?')) return true

  try {
    const parsed = new URL(icon)
    return parsed.hostname === 'www.google.com' && parsed.pathname.startsWith('/s2/favicons')
  } catch {
    return false
  }
}

export function googleFaviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`
}

export async function cacheFaviconForUrl(input: {
  href: string
  iconUrl?: string
  domain?: string
  referer?: string
}): Promise<CachedFaviconResult | null> {
  const domain = (input.domain || getDomainFromFaviconProxy(input.iconUrl) || getDomainFromUrl(input.href)).toLowerCase()
  if (!domain) return null

  const cached = await getCachedFavicon(domain)
  if (cached) {
    return { icon: cached, cached: true, domain }
  }

  const sourceUrl = input.iconUrl && !isGeneratedFaviconUrl(input.iconUrl)
    ? input.iconUrl
    : googleFaviconUrl(domain)
  const icon = await mirrorFavicon(sourceUrl, input.referer || input.href, domain)

  await setCachedFavicon(domain, icon)
  return { icon, cached: false, domain }
}

async function mirrorFavicon(iconUrl: string, referer: string, domain: string) {
  const response = await fetch(iconUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 Chrome/138 Safari/537.36',
      Accept: `${IMAGE_CONTENT_TYPES.join(',')},image/*,*/*;q=0.8`,
      Referer: referer,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(ICON_FETCH_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Favicon request failed for ${domain}: ${response.status}`)
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || ''
  if (contentType && !IMAGE_CONTENT_TYPES.includes(contentType) && !contentType.startsWith('image/')) {
    throw new Error(`Unexpected favicon content type for ${domain}: ${contentType}`)
  }

  const binaryData = new Uint8Array(await response.arrayBuffer())
  if (binaryData.byteLength === 0) {
    throw new Error(`Empty favicon response for ${domain}`)
  }

  if (binaryData.byteLength > MAX_ICON_BYTES) {
    throw new Error(`Favicon is too large for ${domain}: ${binaryData.byteLength} bytes`)
  }

  const { path } = await saveAsset(
    binaryData,
    getFileExtension(iconUrl, contentType),
    safePrefix(domain),
    'favicons'
  )

  return path
}

function getFileExtension(url: string, contentType: string) {
  const extensionFromContentType = extensionByContentType(contentType)
  if (extensionFromContentType) return extensionFromContentType

  try {
    const extension = new URL(url).pathname.split('.').pop()?.toLowerCase()
    return extension && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'].includes(extension)
      ? extension
      : 'png'
  } catch {
    return 'png'
  }
}

function extensionByContentType(contentType: string) {
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/jpeg') return 'jpg'
  if (contentType === 'image/webp') return 'webp'
  if (contentType === 'image/gif') return 'gif'
  if (contentType === 'image/svg+xml') return 'svg'
  if (contentType === 'image/x-icon' || contentType === 'image/vnd.microsoft.icon') return 'ico'

  return ''
}

function safePrefix(domain: string) {
  return `favicon_${domain.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)}`
}
