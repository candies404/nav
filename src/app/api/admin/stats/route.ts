import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAdminStats, type AdminStats } from '@/lib/admin-read'

export const runtime = 'nodejs'

const STATS_CACHE_TTL_MS = Number(process.env.NAVSPHERE_ADMIN_STATS_CACHE_TTL_MS || 10_000)
const globalStatsCache = globalThis as typeof globalThis & {
  __navsphereAdminStatsCache?: {
    value: AdminStats
    expiresAt: number
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const forceFresh = searchParams.get('fresh') === '1'
    const cachedStats = globalStatsCache.__navsphereAdminStatsCache
    if (!forceFresh && cachedStats && cachedStats.expiresAt > Date.now()) {
      return statsResponse(cachedStats.value)
    }

    const result = await getAdminStats({ fresh: forceFresh })
    globalStatsCache.__navsphereAdminStatsCache = {
      value: result,
      expiresAt: Date.now() + STATS_CACHE_TTL_MS,
    }

    return statsResponse(result)
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}

function statsResponse(stats: AdminStats) {
  return NextResponse.json(stats, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Vary': 'Cookie',
    },
  })
}
