import { NextResponse } from 'next/server'
import { getSiteContent } from '@/lib/content-cache'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const siteData = await getSiteContent()
    return NextResponse.json(siteData, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Error in site API:', error)
    return NextResponse.json(
      { error: '获取站点数据失败' },
      { status: 500 }
    )
  }
}
