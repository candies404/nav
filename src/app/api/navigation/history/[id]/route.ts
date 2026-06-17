import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  deleteNavigationHistoryVersion,
  getNavigationHistoryDetail,
} from '@/lib/navigation-storage'
import { getStorageErrorMessage } from '@/lib/storage'

export const runtime = 'edge'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { id } = await params
    const version = await getNavigationHistoryDetail(id)
    if (!version) {
      return NextResponse.json(
        {
          error: 'Navigation history version not found',
          details: '指定的历史版本不存在或已被清理',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ version })
  } catch (error) {
    console.error('Failed to read navigation history version:', error)
    return NextResponse.json(
      {
        error: getStorageErrorMessage(error, 'Failed to read navigation history version'),
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { id } = await params
    const deleted = await deleteNavigationHistoryVersion(id)
    if (!deleted) {
      return NextResponse.json(
        {
          error: 'Navigation history version not found',
          details: '指定的历史版本不存在或已被清理',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete navigation history version:', error)
    return NextResponse.json(
      {
        error: getStorageErrorMessage(error, 'Failed to delete navigation history version'),
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
