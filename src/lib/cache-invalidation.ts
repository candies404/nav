import { revalidatePath, revalidateTag } from 'next/cache'
import {
  NAVIGATION_CONTENT_CACHE_TAG,
  SITE_CONTENT_CACHE_TAG,
} from '@/lib/cache-tags'

const globalCache = globalThis as typeof globalThis & {
  __navsphereAdminStatsCache?: unknown
}

function revalidatePaths(paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path)
    } catch (error) {
      console.warn(`Failed to revalidate ${path}:`, error)
    }
  }
}

export function revalidateNavigationContent() {
  delete globalCache.__navsphereAdminStatsCache
  revalidateTag(NAVIGATION_CONTENT_CACHE_TAG)
  revalidatePaths([
    '/api/home/navigation',
    '/api/navigation',
    '/api/admin/stats',
  ])
}

export function revalidateSiteContent() {
  revalidateTag(SITE_CONTENT_CACHE_TAG)
  revalidatePaths([
    '/api/home/site',
    '/api/site',
  ])
}
