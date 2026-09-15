'use client'

import { useEffect, useState } from 'react'
import { readAdminResponse, errorMessage } from '@/lib/admin-api-response'
import { isHttpUrl } from '@/lib/site-form-state'
import { siteEditHref, type QualitySite } from '@/lib/site-quality'

export function DuplicateSiteNotice({ url, excludeId, enabled }: { url: string; excludeId?: string; enabled: boolean }) {
  const [result, setResult] = useState<{ url: string; matches: QualitySite[]; error?: string } | null>(null)
  useEffect(() => {
    if (!enabled || !isHttpUrl(url)) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ url })
        if (excludeId) params.set('excludeId', excludeId)
        const response = await fetch(`/api/navigation/sites/duplicates?${params}`, { signal: controller.signal })
        const data = await readAdminResponse<{ matches: QualitySite[] }>(response, '检查重复网址失败')
        if (!controller.signal.aborted) setResult({ url, matches: data.matches })
      } catch (cause) {
        if (!controller.signal.aborted) setResult({ url, matches: [], error: errorMessage(cause, '检查重复网址失败') })
      }
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [url, excludeId, enabled])

  if (!enabled || result?.url !== url) return null
  if (result.error) return <p role="status" className="text-xs text-muted-foreground">{result.error}；仍可手动添加。</p>
  if (!result.matches.length) return null
  return <div role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
    <p className="font-medium">此网址已收录 {result.matches.length} 次</p>
    <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto">
      {result.matches.map(site => <li key={site.id}>
        <a className="underline" href={siteEditHref(site)} target="_blank" rel="noopener noreferrer">{site.title} · {site.categoryPath}</a>
      </li>)}
    </ul>
    <p className="mt-2 text-xs">可以继续添加到其他分类；原有站点会保留。</p>
  </div>
}
