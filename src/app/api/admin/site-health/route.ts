import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { readQualityNavigation } from '@/lib/content-quality'
import { flattenSites } from '@/lib/site-quality'
import { checkSiteLink } from '@/lib/site-health'
import { saveLinkHealth } from '@/lib/storage'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!(await auth())?.user) return new Response('Unauthorized', { status: 401 })
  let input: { siteIds?: unknown }
  try { input = await request.json() } catch { return NextResponse.json({ error: '请求格式无效' }, { status: 400 }) }
  const ids = input?.siteIds
  if (!Array.isArray(ids) || !ids.length || ids.length > 3 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: '每批请选择 1–3 个不同的站点' }, { status: 400 })
  }
  try {
    const sites = flattenSites(await readQualityNavigation())
    const selected = ids.map(id => sites.find(site => site.id === id))
    if (selected.some(site => !site)) return NextResponse.json({ error: '部分站点已不存在，请刷新清单' }, { status: 409 })
    const results = await Promise.all(selected.map(async site => {
      // Only check URLs already stored in the navigation, never arbitrary request URLs.
      const health = await checkSiteLink(site!.href)
      await saveLinkHealth(site!.id, health)
      return { id: site!.id, health }
    }))
    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: '检测或保存结果失败，请检查系统状态后重试；已保存的结果仍然保留' }, { status: 503 })
  }
}
