import { googleFaviconUrl } from '@/lib/favicon-cache'

export interface WebsiteMetadata {
  title: string
  description: string
  icon: string
}

const METADATA_TIMEOUT_MS = 1500

export function isValidWebsiteUrl(value: string) {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export async function fetchWebsiteMetadata(url: string): Promise<WebsiteMetadata> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 Chrome/138 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
    })

    if (!response.ok) {
      return getFallbackMetadata(url)
    }

    const html = await response.text()
    return parseMetadataFromHtml(html, url)
  } catch {
    return getFallbackMetadata(url)
  }
}

function getFallbackMetadata(url: string): WebsiteMetadata {
  try {
    const hostname = new URL(url).hostname
    const title = hostname.replace(/^www\./, '').split('.')[0]

    return {
      title: title ? title.charAt(0).toUpperCase() + title.slice(1) : hostname,
      description: `Visit ${hostname}`,
      icon: googleFaviconUrl(hostname),
    }
  } catch {
    return {
      title: 'Unknown website',
      description: 'Unable to fetch website metadata',
      icon: '',
    }
  }
}

function parseMetadataFromHtml(html: string, url: string): WebsiteMetadata {
  const hostname = new URL(url).hostname
  const title =
    extractMetaContent(html, 'title') ||
    extractMetaContent(html, 'og:title') ||
    extractMetaContent(html, 'twitter:title') ||
    hostname
  const description =
    extractMetaContent(html, 'description') ||
    extractMetaContent(html, 'og:description') ||
    extractMetaContent(html, 'twitter:description') ||
    ''

  return {
    title: decodeHtml(title.trim()),
    description: decodeHtml(description.trim()),
    icon: extractFavicon(html, url) || googleFaviconUrl(hostname),
  }
}

function extractMetaContent(html: string, name: string) {
  if (name === 'title') {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    return match?.[1] || null
  }

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]*name=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${escaped}["']`, 'i'),
    new RegExp(`<meta[^>]*property=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escaped}["']`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

function extractFavicon(html: string, baseUrl: string) {
  const base = new URL(baseUrl)
  const patterns = [
    /<link[^>]*rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*href=["']([^"']*)["']/i,
    /<link[^>]*href=["']([^"']*)["'][^>]*rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["']/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (!match?.[1]) {
      continue
    }

    return new URL(match[1], base.origin).toString()
  }

  return null
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}
