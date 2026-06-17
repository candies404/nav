import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { restoreNavigationHistoryVersion } from '@/lib/navigation-storage'
import { getStorageErrorMessage } from '@/lib/storage'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { id } = await request.json()
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          error: 'Missing navigation history version id',
          details: '请提供要恢复的历史版本 ID',
        },
        { status: 400 }
      )
    }

    const data = await restoreNavigationHistoryVersion(id)
    if (!data) {
      return NextResponse.json(
        {
          error: 'Navigation history version not found',
          details: '指定的历史版本不存在或已被清理',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Failed to restore navigation history version:', error)
    return NextResponse.json(
      {
        error: getStorageErrorMessage(error, 'Failed to restore navigation history version'),
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
