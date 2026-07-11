import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { commitFile, getFileContent, getStorageErrorMessage } from '@/lib/storage'
import type { SiteInfo } from '@/types/site'
import { revalidateSiteContent } from '@/lib/cache-invalidation'

export const runtime = 'edge'

export async function GET() {
  try {
    const data = await getFileContent(
      'src/navsphere/content/site.json',
      { bypassCache: true }
    ) as SiteInfo
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to read site data:', error)
    return NextResponse.json({
      basic: {
        title: '',
        description: '',
        keywords: ''
      },
      appearance: {
        logo: '',
        favicon: '',
        theme: 'system'
      },
      navigation: {
        linkTarget: '_blank'
      }
    })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const data: SiteInfo = await request.json()

    // 保存到 Redis
    await commitFile(
      'src/navsphere/content/site.json',
      JSON.stringify(data, null, 2),
      'Update site configuration'
    )
    revalidateSiteContent()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save site data:', error)
    return NextResponse.json(
      { error: getStorageErrorMessage(error, 'Failed to save site data') },
      { status: 500 }
    )
  }
} 
