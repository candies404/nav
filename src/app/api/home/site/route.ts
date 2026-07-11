import { NextResponse } from 'next/server'
import { getFileContent } from '@/lib/storage'

export const runtime = 'edge'

export async function GET() {
  try {
    const siteData = await getFileContent(
      'src/navsphere/content/site.json',
      { bypassCache: true }
    )
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
