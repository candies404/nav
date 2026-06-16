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
      return NextResponse.json({ error: 'Invalid resource paths' }, { status: 400 })
    }

    const references = await checkManagedResourceReferences(resourcePaths)

    return NextResponse.json({ references })
  } catch (error) {
    console.error('Failed to check resource references:', error)
    return NextResponse.json({ error: 'Failed to check resource references' }, { status: 500 })
  }
}
