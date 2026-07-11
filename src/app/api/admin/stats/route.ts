import { NextResponse } from 'next/server'
import { getFileContent } from '@/lib/storage'
import { auth } from '@/lib/auth'
import type { NavigationData } from '@/types/navigation'

export const runtime = 'edge'

type AdminStats = {
  parentCategories: number
  subCategories: number
  totalCategories: number
  totalSites: number
}

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

    const navigationData = await getFileContent(
      'src/navsphere/content/navigation.json',
      { bypassCache: forceFresh }
    ) as NavigationData
    const result = getAdminStats(navigationData)
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

function getAdminStats(data: NavigationData): AdminStats {
  let subCategories = 0
  let totalSites = 0
  const parentCategories = data.navigationItems?.length || 0

  for (const category of data.navigationItems || []) {
    totalSites += category.items?.length || 0

    for (const subCategory of category.subCategories || []) {
      subCategories += 1
      totalSites += subCategory.items?.length || 0
    }
  }

  return {
    parentCategories,
    subCategories,
    totalCategories: parentCategories + subCategories,
    totalSites,
  }
}
