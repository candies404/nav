import { NextResponse } from 'next/server'
import { getFileContent } from '@/lib/storage'
import { isAuthenticatedRequest } from '@/lib/auth-token'
import { filterNavigationData, processNavigationData } from '@/lib/data-loader'
import type {
  NavigationData,
  NavigationDataRaw,
  NavigationSearchIndex,
  NavigationSearchIndexItem,
  NavigationSubItem,
} from '@/types/navigation'

export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    const [navigationData, includePrivate] = await Promise.all([
      getFileContent(
        'src/navsphere/content/navigation.json',
        { bypassCache: true }
      ) as Promise<NavigationDataRaw>,
      isAuthenticatedRequest(request),
    ])

    const filteredNavigationData = filterNavigationData(
      processNavigationData(navigationData),
      includePrivate
    )

    return NextResponse.json(buildSearchIndex(filteredNavigationData), {
      headers: {
        'Cache-Control': includePrivate
          ? 'private, no-store'
          : 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Content-Type': 'application/json',
        ...(includePrivate ? { 'Vary': 'Cookie' } : {}),
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

function buildSearchIndex(navigationData: NavigationData): NavigationSearchIndex {
  const items: NavigationSearchIndexItem[] = []

  for (const category of navigationData.navigationItems) {
    const categoryPath = [category.title]

    for (const item of category.items || []) {
      items.push(toSearchIndexItem(item, categoryPath))
    }

    for (const subCategory of category.subCategories || []) {
      const subCategoryPath = [...categoryPath, subCategory.title]
      for (const item of subCategory.items || []) {
        items.push(toSearchIndexItem(item, subCategoryPath))
      }
    }
  }

  return { items }
}

function toSearchIndexItem(
  item: NavigationSubItem,
  categoryPath: string[]
): NavigationSearchIndexItem {
  return {
    id: item.id,
    title: item.title,
    href: item.href,
    description: item.description,
    icon: item.icon,
    categoryPath,
  }
}
