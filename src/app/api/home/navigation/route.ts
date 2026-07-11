import { NextResponse } from 'next/server'
import { getFileContent } from '@/lib/storage'
import { isAuthenticatedRequest } from '@/lib/auth-token'
import { filterNavigationData, processNavigationData } from '@/lib/data-loader'
import type { NavigationDataRaw } from '@/types/navigation'

export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    const searchScope = new URL(request.url).searchParams.get('scope')
    const wantsPrivateData = searchScope === 'private'
    const [navigationData, isAuthenticated] = await Promise.all([
      getFileContent(
        'src/navsphere/content/navigation.json',
        { bypassCache: true }
      ) as Promise<NavigationDataRaw>,
      isAuthenticatedRequest(request),
    ])

    if (wantsPrivateData && !isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'private, no-store' } }
      )
    }

    const filteredNavigationData = filterNavigationData(
      processNavigationData(navigationData),
      wantsPrivateData
    )

    return NextResponse.json(filteredNavigationData, {
      headers: {
        'Cache-Control': wantsPrivateData
          ? 'private, no-store'
          : 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Content-Type': 'application/json',
        ...(wantsPrivateData ? { 'Vary': 'Cookie' } : {}),
      },
    })
  } catch (error) {
    console.error('Error in navigation API:', error)
    return NextResponse.json(
      { error: '获取导航数据失败' },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}
