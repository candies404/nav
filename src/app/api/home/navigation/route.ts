import { NextResponse } from 'next/server'
import { getFileContent } from '@/lib/storage'
import { isAuthenticatedRequest } from '@/lib/auth-token'
import { filterNavigationData, processNavigationData } from '@/lib/data-loader'
import type { NavigationDataRaw } from '@/types/navigation'

export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    const navigationData = await getFileContent('src/navsphere/content/navigation.json') as NavigationDataRaw
    const filteredNavigationData = filterNavigationData(
      processNavigationData(navigationData),
      await isAuthenticatedRequest(request)
    )

    return NextResponse.json(filteredNavigationData, {
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate',
        'Content-Type': 'application/json',
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
