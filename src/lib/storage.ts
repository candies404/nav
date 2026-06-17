import navigationData from '@/navsphere/content/navigation.json'
import navigationDefaultData from '@/navsphere/content/navigation-default.json'
import resourceMetadataData from '@/navsphere/content/resource-metadata.json'
import siteData from '@/navsphere/content/site.json'
import { uint8ArrayToBase64 } from '@/lib/buffer-utils'
import { del, list, put } from '@vercel/blob'

type RedisResponse<T> = {
  result?: T
  error?: string
}

type DataCacheEntry = {
  value: unknown
  expiresAt: number
}

const MISSING_REDIS_CONFIG_MESSAGE =
  '未配置 KV_REST_API_URL 或 KV_REST_API_TOKEN。当前只能读取内置默认数据，后台保存需要先配置 Upstash Redis/KV REST 数据库。'

export type StoredAsset = {
  id: string
  contentType: string
  base64: string
  createdAt: string
}

export type BlobAsset = {
  pathname: string
  url: string
  downloadUrl: string
  size: number
  uploadedAt: string
}

const DATA_PREFIX = process.env.UPSTASH_REDIS_KEY_PREFIX || 'navsphere'
const DATA_CACHE_TTL_MS = Number(process.env.NAVSPHERE_DATA_CACHE_TTL_MS || 60_000)
const DATA_ERROR_CACHE_TTL_MS = Number(process.env.NAVSPHERE_DATA_ERROR_CACHE_TTL_MS || 5_000)
const BLOB_CACHE_MAX_AGE_SECONDS = Number(process.env.NAVSPHERE_BLOB_CACHE_MAX_AGE_SECONDS || 31_536_000)
const globalCache = globalThis as typeof globalThis & {
  __navsphereDataCache?: Map<string, DataCacheEntry>
  __navsphereRedisConfigWarned?: boolean
}
const dataCache = globalCache.__navsphereDataCache ?? new Map<string, DataCacheEntry>()
globalCache.__navsphereDataCache = dataCache

function warnMissingRedisConfig() {
  if (globalCache.__navsphereRedisConfigWarned) return

  globalCache.__navsphereRedisConfigWarned = true
  console.warn(MISSING_REDIS_CONFIG_MESSAGE)
}

function isMissingRedisConfigError(error: unknown) {
  return error instanceof Error && error.message === MISSING_REDIS_CONFIG_MESSAGE
}

export function getStorageErrorMessage(error: unknown, fallback: string) {
  return isMissingRedisConfigError(error) ? MISSING_REDIS_CONFIG_MESSAGE : fallback
}

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN

  if (!url || !token) {
    warnMissingRedisConfig()
    throw new Error(MISSING_REDIS_CONFIG_MESSAGE)
  }

  return { url, token }
}

// Upstash REST API accepts Redis commands as JSON arrays, which keeps the
// storage layer usable in both Node and Edge runtimes without a TCP client.
async function redisCommand<T>(command: unknown[]): Promise<T | null> {
  const { url, token } = getRedisConfig()
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })

  if (!response.ok) {
    throw new Error(`Redis request failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as RedisResponse<T>
  if (data.error) {
    throw new Error(`Redis command failed: ${data.error}`)
  }

  return data.result ?? null
}

function cloneDefault<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function getCachedContent(path: string) {
  if (DATA_CACHE_TTL_MS <= 0) return undefined

  const key = dataKey(path)
  const cached = dataCache.get(key)
  if (!cached) return undefined

  if (cached.expiresAt <= Date.now()) {
    dataCache.delete(key)
    return undefined
  }

  return cloneDefault(cached.value)
}

function setCachedContent(path: string, value: unknown, ttlMs = DATA_CACHE_TTL_MS) {
  if (ttlMs <= 0) return

  dataCache.set(dataKey(path), {
    value: cloneDefault(value),
    expiresAt: Date.now() + ttlMs,
  })
}

// If Redis has not been initialized yet, the app can still boot from the
// bundled JSON content and write the first successful admin edit back to Redis.
function getDefaultContent(path: string) {
  if (path.endsWith('navigation-default.json')) {
    return cloneDefault(navigationDefaultData)
  }

  if (path.endsWith('navigation.json')) {
    return cloneDefault(navigationData)
  }

  if (path.endsWith('site.json')) {
    return cloneDefault(siteData)
  }

  if (path.endsWith('resource-metadata.json')) {
    return cloneDefault(resourceMetadataData)
  }

  return {}
}

// Preserve the original logical file paths while mapping them to Redis-safe keys.
function dataKey(path: string) {
  return `${DATA_PREFIX}:data:${path.replace(/[\\/]+/g, ':')}`
}

function assetKey(id: string) {
  return `${DATA_PREFIX}:asset:${id}`
}

function faviconCacheKey(domain: string) {
  return `${DATA_PREFIX}:favicon:${domain.toLowerCase()}`
}

function contentTypeFromExtension(extension: string) {
  const ext = extension.toLowerCase().replace(/^\./, '')

  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'ico') return 'image/x-icon'

  return 'image/png'
}

function normalizeExtension(extension: string) {
  const ext = extension.toLowerCase().replace(/^\./, '')
  return ext || 'png'
}

function hasBlobWriteConfig() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

export function isBlobStorageConfigured() {
  return hasBlobWriteConfig()
}

function getBlobOptions() {
  return {
    storeId: process.env.BLOB_STORE_ID,
  }
}

export async function getFileContent(path: string) {
  const cached = getCachedContent(path)
  if (cached !== undefined) {
    return cached
  }

  try {
    const raw = await redisCommand<string>(['GET', dataKey(path)])
    if (!raw) {
      const defaultContent = getDefaultContent(path)
      setCachedContent(path, defaultContent)
      return defaultContent
    }

    const content = JSON.parse(raw)
    setCachedContent(path, content)
    return cloneDefault(content)
  } catch (error) {
    if (!isMissingRedisConfigError(error)) {
      console.error('Error fetching data from Redis:', error)
    }

    const defaultContent = getDefaultContent(path)
    setCachedContent(path, defaultContent, DATA_ERROR_CACHE_TTL_MS)
    return defaultContent
  }
}

export async function commitFile(
  path: string,
  content: string,
  _message?: string,
  _token?: string,
  retryCount = 3
) {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      await redisCommand<string>(['SET', dataKey(path), content])
      try {
        setCachedContent(path, JSON.parse(content))
      } catch {
        dataCache.delete(dataKey(path))
      }

      return {
        ok: true,
        path,
        key: dataKey(path),
      }
    } catch (error) {
      if (isMissingRedisConfigError(error)) {
        throw error
      }

      if (attempt === retryCount) {
        console.error('Error saving data to Redis:', error)
        throw error
      }

      await delay(500 * attempt)
    }
  }
}

export async function saveAsset(
  binaryData: Uint8Array,
  extension = 'png',
  prefix = 'asset',
  folder = 'assets'
) {
  const ext = normalizeExtension(extension)
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'asset'
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '').replace(/[\\/]+/g, '_') || 'assets'
  const contentType = contentTypeFromExtension(ext)

  if (hasBlobWriteConfig()) {
    const pathname = `${cleanFolder}/${cleanPrefix}_${Date.now()}_${crypto.randomUUID()}.${ext}`
    const blob = await put(pathname, binaryData, {
      access: 'public',
      addRandomSuffix: false,
      contentType,
      cacheControlMaxAge: BLOB_CACHE_MAX_AGE_SECONDS,
      storeId: process.env.BLOB_STORE_ID,
    })

    return {
      path: blob.url,
      hash: blob.pathname,
    }
  }

  const id = `${cleanFolder}_${cleanPrefix}_${Date.now()}_${crypto.randomUUID()}.${ext}`
  const asset: StoredAsset = {
    id,
    contentType,
    base64: uint8ArrayToBase64(binaryData),
    createdAt: new Date().toISOString(),
  }

  await redisCommand<string>(['SET', assetKey(id), JSON.stringify(asset)])

  // Assets are served through an API route so Redis remains the only backing store.
  return {
    path: `/api/assets/${encodeURIComponent(id)}`,
    hash: id,
  }
}

export async function listBlobAssets() {
  if (!hasBlobWriteConfig()) return []

  const blobs: BlobAsset[] = []
  let cursor: string | undefined

  do {
    const result = await list({
      ...getBlobOptions(),
      cursor,
      limit: 1000,
    })

    for (const blob of result.blobs) {
      blobs.push({
        pathname: blob.pathname,
        url: blob.url,
        downloadUrl: blob.downloadUrl,
        size: blob.size,
        uploadedAt: new Date(blob.uploadedAt).toISOString(),
      })
    }

    cursor = result.cursor
  } while (cursor)

  return blobs.sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))
}

export async function deleteBlobAssets(paths: string[]) {
  if (!hasBlobWriteConfig()) return 0

  const blobPaths = paths.filter(Boolean)
  if (blobPaths.length === 0) return 0

  await del(blobPaths, getBlobOptions())
  return blobPaths.length
}

export async function deleteStoredAssets(ids: string[]) {
  const assetIds = [...new Set(ids.filter(Boolean))]
  if (assetIds.length === 0) return 0

  try {
    const deletedCount = await redisCommand<number>(['DEL', ...assetIds.map(assetKey)])
    return deletedCount || 0
  } catch (error) {
    if (!isMissingRedisConfigError(error)) {
      console.warn('Failed to delete stored assets:', error)
    }

    return 0
  }
}

export async function getAsset(id: string): Promise<StoredAsset | null> {
  const raw = await redisCommand<string>(['GET', assetKey(id)])
  if (!raw) return null

  return JSON.parse(raw) as StoredAsset
}

export async function getCachedFavicon(domain: string): Promise<string | null> {
  try {
    return await redisCommand<string>(['GET', faviconCacheKey(domain)])
  } catch (error) {
    if (!isMissingRedisConfigError(error)) {
      console.warn('Failed to read favicon cache:', error)
    }

    return null
  }
}

export async function setCachedFavicon(domain: string, iconUrl: string) {
  try {
    await redisCommand<string>(['SET', faviconCacheKey(domain), iconUrl])
  } catch (error) {
    if (!isMissingRedisConfigError(error)) {
      console.warn('Failed to write favicon cache:', error)
    }
  }
}

export async function deleteCachedFavicon(domain: string, expectedIconUrl?: string) {
  try {
    const normalizedDomain = domain.toLowerCase()

    if (expectedIconUrl) {
      const cachedIconUrl = await redisCommand<string>(['GET', faviconCacheKey(normalizedDomain)])
      if (cachedIconUrl !== expectedIconUrl) {
        return false
      }
    }

    await redisCommand<number>(['DEL', faviconCacheKey(normalizedDomain)])
    return true
  } catch (error) {
    if (!isMissingRedisConfigError(error)) {
      console.warn('Failed to delete favicon cache:', error)
    }

    return false
  }
}
