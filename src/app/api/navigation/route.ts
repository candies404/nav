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
    const { searchParams } = new URL(request.url)
    const [data, isAuthenticated] = await Promise.all([
      getFileContent(
        'src/navsphere/content/navigation.json',
        { bypassCache: true }
      ) as Promise<NavigationDataRaw>,
      isAuthenticatedRequest(request),
    ])
    const isSummaryView = searchParams.get('view') === 'summary'
    const responseData = isSummaryView
      ? { navigationItems: summarizeNavigationItems(data.navigationItems || []) }
      : data

    if (isAuthenticated) {
      return NextResponse.json(responseData, {
        headers: {
          'Cache-Control': 'private, no-store',
          'Vary': 'Cookie',
        },
      })
    }

    const publicData = filterNavigationData(processNavigationData(data))
    return NextResponse.json(
      isSummaryView
        ? { navigationItems: summarizeNavigationItems(publicData.navigationItems || []) }
        : publicData,
      {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Vary': 'Cookie',
      },
      }
    )
  } catch (error) {
    console.error('Failed to fetch navigation data:', error)
    // 返回默认数据结构
    return NextResponse.json({
      navigationItems: []
    })
  }
}

function summarizeNavigationItems(items: NavigationItem[]) {
  return items.map(item => ({
    id: item.id,
    title: item.title,
    description: item.description,
    icon: item.icon,
    enabled: item.enabled,
  }))
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

  return saveNavigationData(data, 'Update navigation data')
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const input = await request.json()
    if (input?.item && typeof input.item === 'object') {
      const item = input.item as NavigationItem
      if (!item.id || !item.title) {
        return NextResponse.json(
          { error: 'Invalid navigation item' },
          { status: 400 }
        )
      }

      const currentData = await getFileContent(
        'src/navsphere/content/navigation.json',
        { bypassCache: true }
      ) as NavigationData
      const nextItem: NavigationItem = {
        id: item.id,
        title: item.title,
        description: item.description || '',
        icon: item.icon,
        enabled: item.enabled ?? true,
        items: [],
        subCategories: [],
      }
      const result = await saveNavigationData(
        { navigationItems: [...(currentData.navigationItems || []), nextItem] },
        'Add navigation item'
      )

      return NextResponse.json({ success: true, item: nextItem, ...result })
    }

    const result = await validateAndSaveNavigationData(input)

    return NextResponse.json({ success: true, ...result })
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
    const result = await validateAndSaveNavigationData(data)

    return NextResponse.json({ success: true, ...result })
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
