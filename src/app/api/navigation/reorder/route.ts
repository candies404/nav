import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getFileContent, getStorageErrorMessage } from '@/lib/storage'
import { saveNavigationData } from '@/lib/navigation-storage'
import type { NavigationData } from '@/types/navigation'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const body = await request.json() as {
      sourceIndex?: unknown
      destinationIndex?: unknown
      itemId?: unknown
    }
    const sourceIndex = Number(body.sourceIndex)
    const destinationIndex = Number(body.destinationIndex)
    const itemId = typeof body.itemId === 'string' ? body.itemId : null

    // 获取当前导航数据
    const data = await getFileContent(
      'src/navsphere/content/navigation.json',
      { bypassCache: true }
    ) as NavigationData

    // 确保导航项存在
    if (!data.navigationItems || !Array.isArray(data.navigationItems)) {
      throw new Error('无效的导航数据')
    }

    if (
      !Number.isInteger(sourceIndex) ||
      !Number.isInteger(destinationIndex) ||
      sourceIndex < 0 ||
      destinationIndex < 0 ||
      sourceIndex >= data.navigationItems.length ||
      destinationIndex >= data.navigationItems.length
    ) {
      return NextResponse.json({ error: '无效的排序位置' }, { status: 400 })
    }

    // 创建新的导航项数组副本
    const updatedItems = [...data.navigationItems]
    const actualSourceIndex = itemId
      ? updatedItems.findIndex((item) => item.id === itemId)
      : sourceIndex

    if (actualSourceIndex === -1) {
      return NextResponse.json({ error: '未找到要排序的导航项' }, { status: 404 })
    }

    // 找到要移动的项目
    const [movedItem] = updatedItems.splice(actualSourceIndex, 1)

    // 将项目插入到新位置
    updatedItems.splice(destinationIndex, 0, movedItem)

    // 更新数据
    data.navigationItems = updatedItems

    // 保存更改到 Redis
    await saveNavigationData(data, `重新排序导航项 - ${new Date().toISOString()}`)

    return NextResponse.json(data.navigationItems, { status: 200 })
  } catch (error) {
    console.error('重新排序导航项错误:', error)
    return NextResponse.json({
      error: getStorageErrorMessage(error, '重新排序导航项失败'),
      details: (error as Error).message
    }, { status: 500 })
  }
}
