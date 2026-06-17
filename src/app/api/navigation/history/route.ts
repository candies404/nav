import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getNavigationHistoryLimit,
  listNavigationHistory,
} from '@/lib/navigation-storage'
import { getStorageErrorMessage } from '@/lib/storage'

export const runtime = 'edge'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const versions = await listNavigationHistory()

    return NextResponse.json({
      versions,
      limit: getNavigationHistoryLimit(),
    })
  } catch (error) {
    console.error('Failed to list navigation history:', error)
    return NextResponse.json(
      {
        error: getStorageErrorMessage(error, 'Failed to list navigation history'),
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
