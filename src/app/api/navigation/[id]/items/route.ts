import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getFileContent, getStorageErrorMessage } from '@/lib/storage'
import { saveNavigationData } from '@/lib/navigation-storage'
import type { NavigationData, NavigationSubItem } from '@/types/navigation'

export const runtime = 'edge'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await getFileContent(
      'src/navsphere/content/navigation.json',
      { bypassCache: true }
    ) as NavigationData
    const item = data.navigationItems.find(item => item.id === id)

    if (!item) {
      return NextResponse.json({ error: 'Navigation not found' }, { status: 404 })
    }

    return NextResponse.json(item.items)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
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

    const newItem: NavigationSubItem = await request.json()
    const data = await getFileContent(
      'src/navsphere/content/navigation.json',
      { bypassCache: true }
    ) as NavigationData

    const updatedItems = data.navigationItems.map(item => {
      if (item.id === id) {
        return {
          ...item,
          items: [...(item.items || []), newItem]
        }
      }
      return item
    })

    await saveNavigationData({ navigationItems: updatedItems }, 'Add navigation item')

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: getStorageErrorMessage(error, 'Failed to add item') }, { status: 500 })
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

    const { index, item }: { index: number, item: NavigationSubItem } = await request.json()
    const data = await getFileContent(
      'src/navsphere/content/navigation.json',
      { bypassCache: true }
    ) as NavigationData

    const navigation = data.navigationItems.find(nav => nav.id === id)
    if (!navigation) {
      return NextResponse.json({ error: 'Navigation not found' }, { status: 404 })
    }

    const updatedItems = [...(navigation.items || [])]
    updatedItems[index] = item

    const updatedNavigations = data.navigationItems.map(nav => {
      if (nav.id === id) {
        return {
          ...nav,
          items: updatedItems
        }
      }
      return nav
    })

    await saveNavigationData({ navigationItems: updatedNavigations }, 'Update navigation item')

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: getStorageErrorMessage(error, 'Failed to update item') }, { status: 500 })
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

    const { index } = await request.json()
    const data = await getFileContent(
      'src/navsphere/content/navigation.json',
      { bypassCache: true }
    ) as NavigationData

    const navigation = data.navigationItems.find(nav => nav.id === id)
    if (!navigation) {
      return NextResponse.json({ error: 'Navigation not found' }, { status: 404 })
    }

    const updatedItems = (navigation.items || []).filter((_, i) => i !== index)
    const updatedNavigations = data.navigationItems.map(nav => {
      if (nav.id === id) {
        return {
          ...nav,
          items: updatedItems
        }
      }
      return nav
    })

    await saveNavigationData({ navigationItems: updatedNavigations }, 'Delete navigation item')

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: getStorageErrorMessage(error, 'Failed to delete item') }, { status: 500 })
  }
} 
