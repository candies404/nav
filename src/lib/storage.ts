import navigationData from '@/navsphere/content/navigation.json'
import navigationDefaultData from '@/navsphere/content/navigation-default.json'
import resourceMetadataData from '@/navsphere/content/resource-metadata.json'
import siteData from '@/navsphere/content/site.json'
import { uint8ArrayToBase64 } from '@/lib/buffer-utils'

type RedisResponse<T> = {
  result?: T
  error?: string
}

type DataCacheEntry = {
  value: unknown
  expiresAt: number
}

export type StoredAsset = {
  id: string
  contentType: string
  base64: string
  createdAt: string
}

const DATA_PREFIX = process.env.UPSTASH_REDIS_KEY_PREFIX || 'navsphere'
const DATA_CACHE_TTL_MS = Number(process.env.NAVSPHERE_DATA_CACHE_TTL_MS || 60_000)
const DATA_ERROR_CACHE_TTL_MS = Number(process.env.NAVSPHERE_DATA_ERROR_CACHE_TTL_MS || 5_000)
const globalCache = globalThis as typeof globalThis & {
  __navsphereDataCache?: Map<string, DataCacheEntry>
}
const dataCache = globalCache.__navsphereDataCache ?? new Map<string, DataCacheEntry>()
globalCache.__navsphereDataCache = dataCache

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN')
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
    console.error('Error fetching data from Redis:', error)
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
  const id = `${cleanFolder}_${cleanPrefix}_${Date.now()}_${crypto.randomUUID()}.${ext}`
  const asset: StoredAsset = {
    id,
    contentType: contentTypeFromExtension(ext),
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

export async function getAsset(id: string): Promise<StoredAsset | null> {
  const raw = await redisCommand<string>(['GET', assetKey(id)])
  if (!raw) return null

  return JSON.parse(raw) as StoredAsset
}
