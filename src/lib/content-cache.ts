import { unstable_cache } from 'next/cache'
import { getFileContent } from '@/lib/storage'
import {
  NAVIGATION_CONTENT_CACHE_TAG,
  SITE_CONTENT_CACHE_TAG,
} from '@/lib/cache-tags'
import type { NavigationDataRaw } from '@/types/navigation'
import type { SiteInfo } from '@/types/site'

const NAVIGATION_PATH = 'src/navsphere/content/navigation.json'
const SITE_PATH = 'src/navsphere/content/site.json'
const CONTENT_CACHE_REVALIDATE_SECONDS = getPositiveInteger(
  process.env.NAVSPHERE_CONTENT_CACHE_REVALIDATE_SECONDS,
  300
)
const CONTENT_READ_TIMEOUT_MS = getPositiveInteger(
  process.env.NAVSPHERE_CONTENT_READ_TIMEOUT_MS,
  5_000
)

type ContentReadOptions = {
  fresh?: boolean
  requestTimeoutMs?: number
}

const readCachedNavigationContent = unstable_cache(
  () => readStrictContent<NavigationDataRaw>(NAVIGATION_PATH),
  ['navsphere-navigation-content-v1'],
  {
    tags: [NAVIGATION_CONTENT_CACHE_TAG],
    revalidate: CONTENT_CACHE_REVALIDATE_SECONDS,
  }
)

const readCachedSiteContent = unstable_cache(
  () => readStrictContent<SiteInfo>(SITE_PATH),
  ['navsphere-site-content-v1'],
  {
    tags: [SITE_CONTENT_CACHE_TAG],
    revalidate: CONTENT_CACHE_REVALIDATE_SECONDS,
  }
)

export function getNavigationContent(options: ContentReadOptions = {}) {
  if (options.fresh) {
    return readFreshContent<NavigationDataRaw>(NAVIGATION_PATH, options.requestTimeoutMs)
  }

  return readCachedContent(
    NAVIGATION_PATH,
    readCachedNavigationContent,
    options.requestTimeoutMs
  )
}

export function getSiteContent(options: ContentReadOptions = {}) {
  if (options.fresh) {
    return readFreshContent<SiteInfo>(SITE_PATH, options.requestTimeoutMs)
  }

  return readCachedContent(
    SITE_PATH,
    readCachedSiteContent,
    options.requestTimeoutMs
  )
}

async function readCachedContent<T>(
  path: string,
  cachedReader: () => Promise<T>,
  requestTimeoutMs?: number
) {
  try {
    return await cachedReader()
  } catch (error) {
    console.error(`Persistent content cache missed and storage read failed for ${path}:`, error)

    // The strict storage read records a short-lived process-local fallback.
    // Reading again without bypassing the cache returns it immediately instead
    // of issuing a second request to an unavailable data source.
    return getFileContent(path, {
      maxAgeMs: CONTENT_READ_TIMEOUT_MS,
      requestTimeoutMs: requestTimeoutMs ?? CONTENT_READ_TIMEOUT_MS,
    }) as Promise<T>
  }
}

function readFreshContent<T>(path: string, requestTimeoutMs?: number) {
  return getFileContent(path, {
    bypassCache: true,
    requestTimeoutMs: requestTimeoutMs ?? CONTENT_READ_TIMEOUT_MS,
  }) as Promise<T>
}

function readStrictContent<T>(path: string) {
  return getFileContent(path, {
    bypassCache: true,
    requestTimeoutMs: CONTENT_READ_TIMEOUT_MS,
    fallbackOnError: false,
  }) as Promise<T>
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

