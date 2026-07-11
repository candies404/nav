import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getFileContent, getStorageErrorMessage } from '@/lib/storage'
import { saveNavigationData } from '@/lib/navigation-storage'
import type { NavigationCategory, NavigationData } from '@/types/navigation'

export const runtime = 'edge'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await loadNavigationData()
    const navigation = data.navigationItems.find(nav => nav.id === id)

    if (!navigation) {
      return NextResponse.json({ error: 'Navigation not found' }, { status: 404 })
    }

    return NextResponse.json(toCategorySummary(navigation))
  } catch (error) {
    console.error('Fetch categories error:', error)
    return NextResponse.json(
      { error: getStorageErrorMessage(error, 'Failed to fetch categories') },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const input = await request.json() as Partial<NavigationCategory>
    if (typeof input.title !== 'string' || !input.title.trim()) {
      return NextResponse.json({ error: 'Category title is required' }, { status: 400 })
    }

    const data = await loadNavigationData()
    const navigation = data.navigationItems.find(nav => nav.id === id)
    if (!navigation) {
      return NextResponse.json({ error: 'Navigation not found' }, { status: 404 })
    }

    const category: NavigationCategory = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      icon: typeof input.icon === 'string' ? input.icon : undefined,
      description: typeof input.description === 'string' ? input.description : undefined,
      enabled: input.enabled ?? true,
      items: [],
    }

    navigation.subCategories = [...(navigation.subCategories || []), category]
    await saveNavigationData(data, `Add category: ${category.id}`)

    return NextResponse.json({
      success: true,
      category: toCategorySummaryItem(category),
      navigation: toCategorySummary(navigation),
    })
  } catch (error) {
    console.error('Add category error:', error)
    return NextResponse.json({ error: getStorageErrorMessage(error, 'Failed to add category') }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const input = await request.json() as Partial<NavigationCategory> & { categoryId?: string }
    if (!input.categoryId) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    const data = await loadNavigationData()
    const navigation = data.navigationItems.find(nav => nav.id === id)
    if (!navigation) {
      return NextResponse.json({ error: 'Navigation not found' }, { status: 404 })
    }

    const category = navigation.subCategories?.find(cat => cat.id === input.categoryId)
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    if (input.title !== undefined) {
      if (typeof input.title !== 'string' || !input.title.trim()) {
        return NextResponse.json({ error: 'Category title is required' }, { status: 400 })
      }
      category.title = input.title.trim()
    }
    if (input.icon !== undefined) category.icon = input.icon
    if (input.description !== undefined) category.description = input.description
    if (input.enabled !== undefined) category.enabled = input.enabled

    await saveNavigationData(data, `Update category: ${category.id}`)

    return NextResponse.json({
      success: true,
      category: toCategorySummaryItem(category),
      navigation: toCategorySummary(navigation),
    })
  } catch (error) {
    console.error('Update category error:', error)
    return NextResponse.json({ error: getStorageErrorMessage(error, 'Failed to update category') }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { orderedCategoryIds } = await request.json() as { orderedCategoryIds?: string[] }
    if (!Array.isArray(orderedCategoryIds) || orderedCategoryIds.length === 0) {
      return NextResponse.json({ error: 'Category order is required' }, { status: 400 })
    }

    const data = await loadNavigationData()
    const navigation = data.navigationItems.find(nav => nav.id === id)
    if (!navigation) {
      return NextResponse.json({ error: 'Navigation not found' }, { status: 404 })
    }

    const currentCategories = navigation.subCategories || []
    const currentIds = currentCategories.map(category => category.id)
    const orderedSet = new Set(orderedCategoryIds)
    if (
      orderedCategoryIds.length !== currentIds.length ||
      orderedSet.size !== orderedCategoryIds.length ||
      currentIds.some(categoryId => !orderedSet.has(categoryId))
    ) {
      return NextResponse.json(
        { error: 'Category order must contain every category exactly once' },
        { status: 400 }
      )
    }

    const categoryById = new Map(currentCategories.map(category => [category.id, category]))
    navigation.subCategories = orderedCategoryIds.map(categoryId => categoryById.get(categoryId)!)
    await saveNavigationData(data, `Reorder categories: ${id}`)

    return NextResponse.json({
      success: true,
      navigation: toCategorySummary(navigation),
    })
  } catch (error) {
    console.error('Reorder categories error:', error)
    return NextResponse.json({ error: getStorageErrorMessage(error, 'Failed to reorder categories') }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { categoryId } = await request.json()
    if (!categoryId) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    const data = await loadNavigationData()

    const navigation = data.navigationItems.find(nav => nav.id === id)
    if (!navigation) {
      return NextResponse.json({ error: 'Navigation not found' }, { status: 404 })
    }

    // 检查分类是否存在
    const categoryExists = navigation.subCategories?.some(cat => cat.id === categoryId)
    if (!categoryExists) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // 删除指定的分类
    const updatedSubCategories = navigation.subCategories?.filter(cat => cat.id !== categoryId) || []

    const updatedNavigations = data.navigationItems.map(nav => {
      if (nav.id === id) {
        return {
          ...nav,
          subCategories: updatedSubCategories
        }
      }
      return nav
    })

    await saveNavigationData({ navigationItems: updatedNavigations }, `Delete category: ${categoryId}`)

    const updatedNavigation = updatedNavigations.find(nav => nav.id === id)
    return NextResponse.json({
      success: true,
      navigation: updatedNavigation ? toCategorySummary(updatedNavigation) : null,
    })
  } catch (error) {
    console.error('Delete category error:', error)
    return NextResponse.json({ error: getStorageErrorMessage(error, 'Failed to delete category') }, { status: 500 })
  }
}

async function loadNavigationData() {
  return getFileContent(
    'src/navsphere/content/navigation.json',
    { bypassCache: true }
  ) as Promise<NavigationData>
}

function toCategorySummary(navigation: NavigationData['navigationItems'][number]) {
  return {
    id: navigation.id,
    title: navigation.title,
    icon: navigation.icon,
    description: navigation.description,
    enabled: navigation.enabled,
    subCategories: (navigation.subCategories || []).map(toCategorySummaryItem),
  }
}

function toCategorySummaryItem(category: NavigationCategory) {
  return {
    id: category.id,
    title: category.title,
    icon: category.icon,
    description: category.description,
    enabled: category.enabled,
    siteCount: category.items?.length || 0,
  }
}
