import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  cacheFaviconForUrl,
  getDomainFromFaviconProxy,
  getDomainFromUrl,
  isGeneratedFaviconUrl,
} from '@/lib/favicon-cache'
import {
  commitFile,
  getFileContent,
  getStorageErrorMessage,
  isBlobStorageConfigured,
} from '@/lib/storage'
import type { NavigationData, NavigationItem, NavigationSubItem } from '@/types/navigation'

export const runtime = 'edge'

const NAVIGATION_PATH = 'src/navsphere/content/navigation.json'
const DEFAULT_BATCH_LIMIT = Number(process.env.NAVSPHERE_FAVICON_BATCH_LIMIT || 80)
const BATCH_CONCURRENCY = Number(process.env.NAVSPHERE_FAVICON_BATCH_CONCURRENCY || 6)

type FaviconBatchOptions = {
  force?: boolean
  limit?: number
}

type ItemRef = {
  item: NavigationSubItem
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const options = await readOptions(request)
    const limit = normalizeLimit(options.limit)
    const data = await getFileContent(NAVIGATION_PATH) as NavigationData
    const allItems = collectItems(data.navigationItems || [])
    const candidates = allItems.filter(({ item }) => shouldCacheIcon(item, Boolean(options.force)))
    const selected = candidates.slice(0, limit)
    const errors: Array<{ title: string, href: string, error: string }> = []

    let updated = 0
    let cacheHits = 0
    let uploaded = 0
    let cursor = 0

    async function worker() {
      while (cursor < selected.length) {
        const { item } = selected[cursor++]

        try {
          const result = await cacheFaviconForUrl({
            href: item.href,
            iconUrl: item.icon,
            domain: getDomainFromFaviconProxy(item.icon) || getDomainFromUrl(item.href),
          })

          if (!result) continue

          if (item.icon !== result.icon) {
            item.icon = result.icon
            updated += 1
          }

          if (result.cached) {
            cacheHits += 1
          } else {
            uploaded += 1
          }
        } catch (error) {
          errors.push({
            title: item.title,
            href: item.href,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, selected.length) }, worker))

    if (updated > 0) {
      await commitFile(
        NAVIGATION_PATH,
        JSON.stringify(data, null, 2),
        'Cache navigation favicons'
      )
    }

    return NextResponse.json({
      success: true,
      storage: isBlobStorageConfigured() ? 'blob' : 'kv',
      processed: selected.length,
      updated,
      cacheHits,
      uploaded,
      failed: errors.length,
      remaining: Math.max(candidates.length - selected.length, 0),
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    console.error('Failed to cache favicons:', error)
    return NextResponse.json(
      {
        error: getStorageErrorMessage(error, 'Failed to cache favicons'),
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

async function readOptions(request: Request): Promise<FaviconBatchOptions> {
  if (request.headers.get('content-length') === '0') return {}

  try {
    return await request.json()
  } catch {
    return {}
  }
}

function normalizeLimit(value: unknown) {
  const parsed = typeof value === 'number' ? value : DEFAULT_BATCH_LIMIT
  if (!Number.isFinite(parsed)) return DEFAULT_BATCH_LIMIT

  return Math.min(Math.max(Math.floor(parsed), 1), 300)
}

function collectItems(items: NavigationItem[]) {
  const refs: ItemRef[] = []

  for (const category of items) {
    for (const item of category.items || []) {
      refs.push({ item })
    }

    for (const subCategory of category.subCategories || []) {
      for (const item of subCategory.items || []) {
        refs.push({ item })
      }
    }
  }

  return refs
}

function shouldCacheIcon(item: NavigationSubItem, force: boolean) {
  if (!item.href || !getDomainFromUrl(item.href)) return false

  if (force) return true

  return !item.icon || isGeneratedFaviconUrl(item.icon)
}
