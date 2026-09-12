import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAdminSystemStatus } from '@/lib/admin-system-status'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  return NextResponse.json(await getAdminSystemStatus({
    fresh: searchParams.get('fresh') === '1',
  }))
}
