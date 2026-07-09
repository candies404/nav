import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkManagedResourceReferences } from '@/lib/resource-storage'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { resourcePaths } = await request.json()

    if (!Array.isArray(resourcePaths)) {
      return NextResponse.json({ error: '图片资源地址无效' }, { status: 400 })
    }

    const references = await checkManagedResourceReferences(resourcePaths)

    return NextResponse.json({ references })
  } catch (error) {
    console.error('Failed to check resource references:', error)
    return NextResponse.json({ error: '检查图片资源引用失败' }, { status: 500 })
  }
}
