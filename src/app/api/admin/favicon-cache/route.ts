import { after, NextResponse } from 'next/server'
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
export const maxDuration = 300

const NAVIGATION_PATH = 'src/navsphere/content/navigation.json'
const BATCH_SIZE = positiveInteger(process.env.NAVSPHERE_FAVICON_BATCH_SIZE, 40)
const BATCH_CONCURRENCY = positiveInteger(process.env.NAVSPHERE_FAVICON_BATCH_CONCURRENCY, 6)

type FaviconBatchOptions = {
  force?: boolean
  limit?: number
}

type ItemRef = {
  item: NavigationSubItem
}

type FaviconCacheJob = {
  data: NavigationData
  selected: ItemRef[]
  totalCandidates: number
}

type FaviconCacheResult = {
  success: true
  storage: 'blob' | 'kv'
  processed: number
  updated: number
  cacheHits: number
  uploaded: number
  failed: number
  batches: number
  remaining: number
  errors: Array<{ title: string, href: string, error: string }>
}

type FaviconBatchResult = {
  updated: number
  cacheHits: number
  uploaded: number
  failed: number
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const options = await readOptions(request)
    const job = await createFaviconCacheJob(options)

    if (job.selected.length === 0) {
      return NextResponse.json({
        success: true,
        started: false,
        storage: isBlobStorageConfigured() ? 'blob' : 'kv',
        queued: 0,
        totalCandidates: job.totalCandidates,
        remaining: 0,
        message: '没有需要缓存的图标',
      })
    }

    after(async () => {
      try {
        const result = await runFaviconCacheJob(job)
        console.info('Favicon cache background job completed:', result)
      } catch (error) {
        console.error('Favicon cache background job failed:', error)
      }
    })

    return NextResponse.json(
      {
        success: true,
        started: true,
        storage: isBlobStorageConfigured() ? 'blob' : 'kv',
        queued: job.selected.length,
        batchSize: BATCH_SIZE,
        batches: getBatchCount(job.selected.length),
        totalCandidates: job.totalCandidates,
        remaining: Math.max(job.totalCandidates - job.selected.length, 0),
        message: '图标缓存任务已在后台启动',
      },
      { status: 202 }
    )
  } catch (error) {
    console.error('Failed to start favicon cache job:', error)
    return NextResponse.json(
      {
        error: getStorageErrorMessage(error, 'Failed to start favicon cache job'),
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

async function createFaviconCacheJob(options: FaviconBatchOptions): Promise<FaviconCacheJob> {
  const data = await getFileContent(NAVIGATION_PATH) as NavigationData
  const allItems = collectItems(data.navigationItems || [])
  const candidates = allItems.filter(({ item }) => shouldCacheIcon(item, Boolean(options.force)))
  const limit = normalizeLimit(options.limit, candidates.length)
  const selected = candidates.slice(0, limit)

  return {
    data,
    selected,
    totalCandidates: candidates.length,
  }
}

async function runFaviconCacheJob(job: FaviconCacheJob): Promise<FaviconCacheResult> {
  const errors: Array<{ title: string, href: string, error: string }> = []

  let processed = 0
  let updated = 0
  let cacheHits = 0
  let uploaded = 0
  let failed = 0

  for (let start = 0; start < job.selected.length; start += BATCH_SIZE) {
    const batch = job.selected.slice(start, start + BATCH_SIZE)
    const result = await processFaviconBatch(batch, errors)

    processed += batch.length
    updated += result.updated
    cacheHits += result.cacheHits
    uploaded += result.uploaded
    failed += result.failed

    if (result.updated > 0) {
      await commitFile(
        NAVIGATION_PATH,
        JSON.stringify(job.data, null, 2),
        'Cache navigation favicons'
      )
    }

    console.info('Favicon cache batch completed:', {
      batch: Math.floor(start / BATCH_SIZE) + 1,
      batches: getBatchCount(job.selected.length),
      processed,
      updated,
      failed,
    })
  }

  return {
    success: true,
    storage: isBlobStorageConfigured() ? 'blob' : 'kv',
    processed,
    updated,
    cacheHits,
    uploaded,
    failed,
    batches: getBatchCount(job.selected.length),
    remaining: Math.max(job.totalCandidates - job.selected.length, 0),
    errors: errors.slice(0, 10),
  }
}

async function processFaviconBatch(
  batch: ItemRef[],
  errors: Array<{ title: string, href: string, error: string }>
): Promise<FaviconBatchResult> {
  let updated = 0
  let cacheHits = 0
  let uploaded = 0
  let failed = 0
  let cursor = 0

  async function worker() {
    while (cursor < batch.length) {
      const { item } = batch[cursor++]

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
        failed += 1
        errors.push({
          title: item.title,
          href: item.href,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, batch.length) }, worker))

  return {
    updated,
    cacheHits,
    uploaded,
    failed,
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

function normalizeLimit(value: unknown, total: number) {
  if (value === undefined || value === null || value === 'all') return total

  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return total

  return Math.min(Math.max(Math.floor(parsed), 1), total)
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback

  return Math.floor(parsed)
}

function getBatchCount(total: number) {
  return Math.ceil(total / BATCH_SIZE)
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
