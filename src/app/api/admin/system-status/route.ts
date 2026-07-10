import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'
import { auth } from '@/lib/auth'

export const runtime = 'edge'

type StatusLevel = 'available' | 'degraded' | 'unconfigured' | 'error'

type ServiceStatus = {
  id: string
  title: string
  status: StatusLevel
  configured: boolean
  target?: string
  latencyMs?: number
  details: string
  action: string
}

const REDIS_URL = process.env.KV_REST_API_URL
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN
const REDIS_KEY_PREFIX = process.env.UPSTASH_REDIS_KEY_PREFIX || 'navsphere'
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN
const BLOB_STORE_ID = process.env.BLOB_STORE_ID
const DATA_HISTORY_LIMIT = process.env.NAVSPHERE_DATA_HISTORY_LIMIT || '10'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const [redis, blob] = await Promise.all([
    checkRedisStatus(),
    checkBlobStatus(),
  ])

  const capabilities = buildCapabilities(redis)

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    environment: {
      redisKeyPrefix: REDIS_KEY_PREFIX,
      redisRestHost: getHostName(REDIS_URL),
      blobStoreIdConfigured: Boolean(BLOB_STORE_ID),
      dataHistoryLimit: DATA_HISTORY_LIMIT,
    },
    services: [redis, blob],
    capabilities,
  })
}

async function checkRedisStatus(): Promise<ServiceStatus> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return {
      id: 'redis',
      title: 'Redis/KV',
      status: 'unconfigured',
      configured: false,
      target: '导航数据、历史版本、KV 图标缓存索引',
      details: '缺少 KV_REST_API_URL 或 KV_REST_API_TOKEN。',
      action: '配置 Upstash Redis/KV REST URL 和 Token 后，导航保存、历史版本和 KV 缓存能力才可完整使用。',
    }
  }

  const startedAt = Date.now()
  try {
    const response = await fetch(REDIS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['PING']),
      cache: 'no-store',
    })
    const latencyMs = Date.now() - startedAt

    if (!response.ok) {
      return {
        id: 'redis',
        title: 'Redis/KV',
        status: 'error',
        configured: true,
        target: '导航数据、历史版本、KV 图标缓存索引',
        latencyMs,
        details: `REST 请求失败：${response.status} ${response.statusText}`,
        action: '检查 KV_REST_API_URL、KV_REST_API_TOKEN 是否匹配当前 Upstash 数据库，并确认部署网络可访问该地址。',
      }
    }

    const payload = await response.json() as { result?: unknown; error?: string }
    if (payload.error) {
      return {
        id: 'redis',
        title: 'Redis/KV',
        status: 'error',
        configured: true,
        target: '导航数据、历史版本、KV 图标缓存索引',
        latencyMs,
        details: `Redis 返回错误：${payload.error}`,
        action: '检查 Redis Token 权限和数据库状态。',
      }
    }

    return {
      id: 'redis',
      title: 'Redis/KV',
      status: 'available',
      configured: true,
      target: '导航数据、历史版本、KV 图标缓存索引',
      latencyMs,
      details: 'REST PING 成功。',
      action: '无需处理。',
    }
  } catch (error) {
    return {
      id: 'redis',
      title: 'Redis/KV',
      status: 'error',
      configured: true,
      target: '导航数据、历史版本、KV 图标缓存索引',
      details: getErrorMessage(error),
      action: '检查当前环境网络、Upstash 实例地址和 Token。',
    }
  }
}

async function checkBlobStatus(): Promise<ServiceStatus> {
  if (!BLOB_TOKEN) {
    return {
      id: 'blob',
      title: 'Vercel Blob',
      status: 'unconfigured',
      configured: false,
      target: '图片资源库、自动缓存图标文件',
      details: '缺少 BLOB_READ_WRITE_TOKEN。',
      action: '配置 BLOB_READ_WRITE_TOKEN 后，图片资源上传和 Blob 图标缓存才可使用。',
    }
  }

  const startedAt = Date.now()
  try {
    await list({
      limit: 1,
      storeId: BLOB_STORE_ID,
    })

    return {
      id: 'blob',
      title: 'Vercel Blob',
      status: 'available',
      configured: true,
      target: '图片资源库、自动缓存图标文件',
      latencyMs: Date.now() - startedAt,
      details: BLOB_STORE_ID ? 'Blob 列表检查成功，已配置 Store ID。' : 'Blob 列表检查成功，未单独配置 Store ID。',
      action: '无需处理。',
    }
  } catch (error) {
    return {
      id: 'blob',
      title: 'Vercel Blob',
      status: 'error',
      configured: true,
      target: '图片资源库、自动缓存图标文件',
      latencyMs: Date.now() - startedAt,
      details: getErrorMessage(error),
      action: '检查 BLOB_READ_WRITE_TOKEN、BLOB_STORE_ID 和 Blob Store 权限。',
    }
  }
}

function buildCapabilities(redis: ServiceStatus): ServiceStatus[] {
  const redisReady = redis.status === 'available'

  return [
    {
      id: 'navigation-data',
      title: '导航数据保存',
      status: redisReady ? 'available' : redis.status,
      configured: redis.configured,
      target: 'Redis/KV',
      details: redisReady ? '导航数据可保存到 Redis/KV。' : '导航读取会回退到内置默认数据，后台保存不可完整使用。',
      action: redisReady ? '无需处理。' : redis.action,
    },
    {
      id: 'history',
      title: '历史版本',
      status: redisReady ? 'available' : redis.status,
      configured: redis.configured,
      target: 'Redis/KV List',
      details: redisReady ? `默认保留最近 ${DATA_HISTORY_LIMIT} 个版本。` : '历史版本依赖 Redis/KV，当前不可完整使用。',
      action: redisReady ? '无需处理。' : redis.action,
    },
  ]
}

function getHostName(value?: string) {
  if (!value) return ''

  try {
    return new URL(value).hostname
  } catch {
    return ''
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
