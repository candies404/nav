import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { readQualityNavigation } from '@/lib/content-quality'
import { findDuplicateSites } from '@/lib/site-quality'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!(await auth())?.user) return new Response('Unauthorized', { status: 401 })
  const params = new URL(request.url).searchParams
  const url = params.get('url') || ''
  if (url.length > 4096) return NextResponse.json({ error: '网址过长' }, { status: 400 })
  try {
    const data = await readQualityNavigation()
    const matches = findDuplicateSites(data, url, params.get('excludeId') || undefined)
    return NextResponse.json({ matches }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: '暂时无法检查重复网址，请稍后重试' }, { status: 503 })
  }
}
