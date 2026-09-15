import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getContentQualityReport } from '@/lib/content-quality'

export const runtime = 'nodejs'

export async function GET() {
  if (!(await auth())?.user) return new Response('Unauthorized', { status: 401 })
  try {
    return NextResponse.json(await getContentQualityReport(), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: '读取待处理清单失败，请检查数据存储后重试' }, { status: 503 })
  }
}
