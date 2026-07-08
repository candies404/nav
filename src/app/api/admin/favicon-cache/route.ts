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
import { fetchWebsiteMetadata, type WebsiteMetadata } from '@/lib/website-metadata'
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
  force: boolean
}

type FaviconCacheResult = {
  success: true
  storage: 'blob' | 'kv'
  processed: number
  updated: number
  iconUpdated: number
  descriptionUpdated: number
  cacheHits: number
  uploaded: number
  failed: number
  batches: number
  remaining: number
  errors: Array<{ title: string, href: string, error: string }>
}

type FaviconBatchResult = {
  updated: number
  iconUpdated: number
  descriptionUpdated: number
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
        message: '没有需要补全的图标或描述',
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
        message: '图标与描述补全任务已在后台启动',
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
  const force = Boolean(options.force)
  const candidates = allItems.filter(({ item }) => shouldProcessItem(item, force))
  const limit = normalizeLimit(options.limit, candidates.length)
  const selected = candidates.slice(0, limit)

  return {
    data,
    selected,
    totalCandidates: candidates.length,
    force,
  }
}

async function runFaviconCacheJob(job: FaviconCacheJob): Promise<FaviconCacheResult> {
  const errors: Array<{ title: string, href: string, error: string }> = []

  let processed = 0
  let updated = 0
  let iconUpdated = 0
  let descriptionUpdated = 0
  let cacheHits = 0
  let uploaded = 0
  let failed = 0

  for (let start = 0; start < job.selected.length; start += BATCH_SIZE) {
    const batch = job.selected.slice(start, start + BATCH_SIZE)
    const result = await processFaviconBatch(batch, job.force, errors)

    processed += batch.length
    updated += result.updated
    iconUpdated += result.iconUpdated
    descriptionUpdated += result.descriptionUpdated
    cacheHits += result.cacheHits
    uploaded += result.uploaded
    failed += result.failed

    if (result.updated > 0) {
      await commitFile(
        NAVIGATION_PATH,
        JSON.stringify(job.data, null, 2),
        'Complete navigation icons and descriptions'
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
    iconUpdated,
    descriptionUpdated,
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
  force: boolean,
  errors: Array<{ title: string, href: string, error: string }>
): Promise<FaviconBatchResult> {
  let updated = 0
  let iconUpdated = 0
  let descriptionUpdated = 0
  let cacheHits = 0
  let uploaded = 0
  let failed = 0
  let cursor = 0

  async function worker() {
    while (cursor < batch.length) {
      const { item } = batch[cursor++]

      try {
        const needsIcon = shouldCacheIcon(item, force)
        const needsDescription = shouldUpdateDescription(item, force)
        let metadata: WebsiteMetadata | null = null

        if (needsDescription || (needsIcon && !item.icon?.trim())) {
          metadata = await fetchWebsiteMetadata(item.href)
        }

        if (needsDescription) {
          const description = metadata?.description?.trim()
          if (description && item.description !== description) {
            item.description = description
            descriptionUpdated += 1
            updated += 1
          }
        }

        if (needsIcon) {
          try {
            const result = await cacheFaviconForUrl({
              href: item.href,
              iconUrl: metadata?.icon || item.icon,
              domain: getDomainFromFaviconProxy(item.icon) || getDomainFromUrl(item.href),
            })

            if (!result) continue

            if (item.icon !== result.icon) {
              item.icon = result.icon
              iconUpdated += 1
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
    iconUpdated,
    descriptionUpdated,
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

function shouldProcessItem(item: NavigationSubItem, force: boolean) {
  if (!item.href || !getDomainFromUrl(item.href)) return false

  return shouldCacheIcon(item, force) || shouldUpdateDescription(item, force)
}

function shouldCacheIcon(item: NavigationSubItem, force: boolean) {
  if (force) return true

  return !item.icon || isGeneratedFaviconUrl(item.icon)
}

function shouldUpdateDescription(item: NavigationSubItem, force: boolean) {
  if (force) return true

  return !item.description?.trim()
}
