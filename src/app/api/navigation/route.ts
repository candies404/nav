import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAuthenticatedRequest } from '@/lib/auth-token'
import { getFileContent, getStorageErrorMessage } from '@/lib/storage'
import { filterNavigationData, processNavigationData } from '@/lib/data-loader'
import { saveNavigationData } from '@/lib/navigation-storage'
import type { NavigationData, NavigationDataRaw, NavigationItem } from '@/types/navigation'

export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    const data = await getFileContent('src/navsphere/content/navigation.json') as NavigationDataRaw
    const isAuthenticated = await isAuthenticatedRequest(request)

    if (isAuthenticated) {
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'private, no-store',
          'Vary': 'Cookie',
        },
      })
    }

    return NextResponse.json(filterNavigationData(processNavigationData(data)), {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Vary': 'Cookie',
      },
    })
  } catch (error) {
    console.error('Failed to fetch navigation data:', error)
    // 返回默认数据结构
    return NextResponse.json({
      navigationItems: []
    })
  }
}

async function validateAndSaveNavigationData(data: NavigationData) {
  // 严格验证数据结构
  if (!data || typeof data !== 'object') {
    console.error('Invalid data: not an object')
    throw new Error('Invalid navigation data: not an object')
  }

  if (!('navigationItems' in data)) {
    console.error('Missing navigationItems key')
    throw new Error('Invalid navigation data: missing navigationItems')
  }

  if (!Array.isArray(data.navigationItems)) {
    console.error('navigationItems is not an array', typeof data.navigationItems)
    throw new Error('Invalid navigation data: navigationItems must be an array')
  }

  // 额外的数据验证
  const invalidItems = data.navigationItems.filter((item: NavigationItem) =>
    !item.id ||
    !item.title ||
    (item.items && !Array.isArray(item.items)) ||
    (item.subCategories && !Array.isArray(item.subCategories))
  )

  if (invalidItems.length > 0) {
    console.error('Invalid navigation items:', invalidItems)
    throw new Error('Invalid navigation data: some items are malformed')
  }

  await saveNavigationData(data, 'Update navigation data')
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const data = await request.json()
    await validateAndSaveNavigationData(data)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save navigation data:', error)
    return NextResponse.json(
      {
        error: getStorageErrorMessage(error, 'Failed to save navigation data'),
        details: (error as Error).message
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const data = await request.json()
    await validateAndSaveNavigationData(data)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update navigation data:', error)
    return NextResponse.json(
      {
        error: getStorageErrorMessage(error, 'Failed to update navigation data'),
        details: (error as Error).message
      },
      { status: 500 }
    )
  }
} 
