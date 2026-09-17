import 'server-only'

import { getAuthSecret } from '@/lib/auth-config'

const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_WINDOW_SECONDS = 15 * 60
const REDIS_TIMEOUT_MS = 3_000
const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return { count, ttl }
`

type LocalRateLimitEntry = {
  count: number
  resetAt: number
}

type RedisResponse<T> = {
  result?: T
  error?: string
}

const globalRateLimit = globalThis as typeof globalThis & {
  __navsphereAdminLoginAttempts?: Map<string, LocalRateLimitEntry>
  __navsphereAdminLoginFallbackWarned?: boolean
}
const localAttempts = globalRateLimit.__navsphereAdminLoginAttempts
  ?? new Map<string, LocalRateLimitEntry>()
globalRateLimit.__navsphereAdminLoginAttempts = localAttempts

export type AdminLoginAttemptReservation = {
  allowed: boolean
  retryAfterSeconds: number
}

export async function reserveAdminLoginAttempt(request: Request): Promise<AdminLoginAttemptReservation> {
  const config = getRateLimitConfig()
  const key = await getRateLimitKey(request)

  if (hasRedisConfig()) {
    try {
      const result = await redisCommand<[number, number]>([
        'EVAL',
        RATE_LIMIT_SCRIPT,
        1,
        key,
        config.windowSeconds,
      ])
      const count = Number(result?.[0] || 0)
      const ttl = Math.max(1, Number(result?.[1] || config.windowSeconds))
      return { allowed: count <= config.maxAttempts, retryAfterSeconds: ttl }
    } catch (error) {
      if (process.env.NODE_ENV === 'production') throw error
      warnLocalFallback(error)
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Admin login rate limiting requires KV_REST_API_URL and KV_REST_API_TOKEN')
  }

  return reserveLocalAttempt(key, config.maxAttempts, config.windowSeconds)
}

export async function clearAdminLoginAttempts(request: Request) {
  const key = await getRateLimitKey(request)

  if (hasRedisConfig()) {
    try {
      await redisCommand<number>(['DEL', key])
      return
    } catch (error) {
      if (process.env.NODE_ENV === 'production') throw error
      warnLocalFallback(error)
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Admin login rate limiting requires KV_REST_API_URL and KV_REST_API_TOKEN')
  }

  localAttempts.delete(key)
}

function getRateLimitConfig() {
  return {
    maxAttempts: positiveInteger(process.env.ADMIN_LOGIN_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS),
    windowSeconds: positiveInteger(process.env.ADMIN_LOGIN_WINDOW_SECONDS, DEFAULT_WINDOW_SECONDS),
  }
}

async function getRateLimitKey(request: Request) {
  const prefix = process.env.UPSTASH_REDIS_KEY_PREFIX || 'navsphere'
  const identifier = getClientIdentifier(request)
  const encoder = new TextEncoder()
  const signingKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getAuthSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const digestBuffer = await crypto.subtle.sign('HMAC', signingKey, encoder.encode(identifier))
  const digest = Array.from(new Uint8Array(digestBuffer), byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
  return `${prefix}:auth:login-attempts:${digest}`
}

function getClientIdentifier(request: Request) {
  const vercelForwardedFor = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const address = (
    vercelForwardedFor
    || request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || forwardedFor
    || 'unknown'
  )
  return address.slice(0, 128)
}

function reserveLocalAttempt(
  key: string,
  maxAttempts: number,
  windowSeconds: number
): AdminLoginAttemptReservation {
  const now = Date.now()
  const current = localAttempts.get(key)
  const entry = !current || current.resetAt <= now
    ? { count: 1, resetAt: now + windowSeconds * 1_000 }
    : { ...current, count: current.count + 1 }
  localAttempts.set(key, entry)

  return {
    allowed: entry.count <= maxAttempts,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
  }
}

function hasRedisConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

async function redisCommand<T>(command: unknown[]): Promise<T | null> {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) throw new Error('Redis login rate limit is not configured')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REDIS_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Redis login rate limit failed with HTTP ${response.status}`)
    const data = await response.json() as RedisResponse<T>
    if (data.error) throw new Error(`Redis login rate limit failed: ${data.error}`)
    return data.result ?? null
  } finally {
    clearTimeout(timeoutId)
  }
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function warnLocalFallback(error: unknown) {
  if (globalRateLimit.__navsphereAdminLoginFallbackWarned) return
  globalRateLimit.__navsphereAdminLoginFallbackWarned = true
  console.warn('Admin login rate limiting is using the development-only local fallback:', error)
}
