import { revalidatePath } from 'next/cache'

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
  revalidatePaths([
    '/api/home/navigation',
    '/api/navigation',
    '/api/admin/stats',
  ])
}

export function revalidateSiteContent() {
  revalidatePaths([
    '/api/home/site',
    '/api/site',
  ])
}
