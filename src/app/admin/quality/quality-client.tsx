'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/registry/new-york/ui/button'
import { Input } from '@/registry/new-york/ui/input'
import { readAdminResponse, errorMessage } from '@/lib/admin-api-response'
import { qualityLabels, siteEditHref, type LinkHealth, type QualityIssue, type QualityReport } from '@/lib/site-quality'

export function ContentQualityClient({ initialReport }: { initialReport: QualityReport }) {
  const [report, setReport] = useState(initialReport)
  const [filter, setFilter] = useState<QualityIssue | 'all'>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [scan, setScan] = useState<{ completed: number; total: number } | null>(null)
  const stopped = useRef(false)
  const mounted = useRef(true)
  const scanning = useRef(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; stopped.current = true; request.current?.abort() }
  }, [])

  const filtered = useMemo(() => report.items.filter(item =>
    (filter === 'all' ? item.issues.length > 0 : item.issues.includes(filter)) &&
    [item.title, item.href, item.categoryPath].some(value => value.toLowerCase().includes(query.trim().toLowerCase()))
  ), [report, filter, query])
  const pages = Math.max(1, Math.ceil(filtered.length / 25))
  const currentPage = Math.min(page, pages)
  const displayed = filtered.slice((currentPage - 1) * 25, currentPage * 25)

  const refresh = async () => {
    setRefreshing(true)
    setError('')
    try {
      const response = await fetch('/api/admin/content-quality')
      setReport(await readAdminResponse<QualityReport>(response, '刷新清单失败'))
    } catch (cause) { setError(errorMessage(cause, '刷新清单失败')) }
    finally { setRefreshing(false) }
  }

  const checkLinks = async (ids: string[]) => {
    if (scanning.current || !ids.length) return
    scanning.current = true
    stopped.current = false
    setError('')
    setMessage('')
    setScan({ completed: 0, total: ids.length })
    let completed = 0
    try {
      for (let index = 0; index < ids.length && !stopped.current; index += 3) {
        request.current = new AbortController()
        const response = await fetch('/api/admin/site-health', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteIds: ids.slice(index, index + 3) }), signal: request.current.signal,
        })
        const { results } = await readAdminResponse<{ results: { id: string; health: LinkHealth }[] }>(response, '检测失败')
        if (!mounted.current) return
        const updates = new Map(results.map(result => [result.id, result.health]))
        setReport(previous => ({ ...previous, items: previous.items.map(item => {
          const health = updates.get(item.id)
          if (!health || item.href !== health.href) return item
          const issues = item.issues.filter(issue => !['broken-link', 'review-link', 'unchecked'].includes(issue))
          if (health.state === 'broken') issues.push('broken-link')
          if (health.state === 'review') issues.push('review-link')
          return { ...item, health, issues }
        }) }))
        completed += results.length
        setScan({ completed, total: ids.length })
      }
      if (mounted.current) setMessage(`${stopped.current ? '已停止后续检测' : '检测完成'}，已保存 ${completed} 个站点的结果。`)
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause, '检测失败'))
    } finally {
      scanning.current = false
      if (mounted.current) setScan(null)
    }
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="text-2xl font-bold">待处理清单</h1>
        <p className="mt-2 text-sm text-muted-foreground">修复缺失信息、复核异常链接。重复网址可按需保留在不同分类中。</p>
      </div>
      <Button variant="outline" onClick={refresh} disabled={refreshing || Boolean(scan)}>{refreshing ? '刷新中…' : '刷新清单'}</Button>
    </div>
    {(error || report.healthWarning) && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error || report.healthWarning}</p>}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7" aria-label="按待处理类型筛选">
      {(['all', ...Object.keys(qualityLabels)] as const).map(key => {
        const issue = key as QualityIssue | 'all'
        const count = report.items.filter(item => issue === 'all' ? item.issues.length > 0 : item.issues.includes(issue)).length
        return <button key={key} type="button" aria-pressed={filter === issue}
          onClick={() => { setFilter(issue); setPage(1) }}
          className={`rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${filter === issue ? 'border-primary bg-primary/10' : 'bg-card hover:bg-accent'}`}>
          <span className="block text-xs text-muted-foreground">{issue === 'all' ? '全部待处理' : qualityLabels[issue]}</span>
          <span className="mt-1 block text-2xl font-semibold">{count}</span>
        </button>
      })}
    </div>
    <div className="flex flex-col gap-3 sm:flex-row">
      <Input aria-label="搜索待处理站点" placeholder="搜索站点、网址或分类…" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} />
      <Button className="shrink-0" disabled={Boolean(scan) || refreshing || !filtered.length} onClick={() => checkLinks(filtered.map(item => item.id))}>
        检测当前筛选（{filtered.length}）
      </Button>
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">链接检测从服务器发起；404 / 410 标记为失效，超时、访问限制和内网链接归为待复核。缺失图标指未配置图标；空描述或自动生成的占位描述会进入待补充清单。超过 7 天的检测结果可重新检查。</p>
    {scan && <div className="space-y-2 rounded-md border p-3" role="status">
      <div className="flex items-center justify-between gap-3"><span className="text-sm">正在检测 {scan.completed} / {scan.total}</span>
        <Button variant="outline" size="sm" onClick={() => { stopped.current = true; setMessage('正在完成当前批次，随后停止。') }}>停止后续检测</Button>
      </div>
      <progress className="h-2 w-full" value={scan.completed} max={scan.total} aria-label="链接检测进度" />
    </div>}
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-muted/60"><tr><th className="p-3">站点 / 分类</th><th className="p-3">待处理事项</th><th className="p-3">最近检测</th><th className="p-3">操作</th></tr></thead>
        <tbody>{displayed.map(item => <tr key={item.id} className="border-t align-top">
          <td className="max-w-xs p-3"><p className="font-medium">{item.title}</p><p className="break-all text-xs text-muted-foreground">{item.href}</p><p className="mt-1 text-xs text-muted-foreground">{item.categoryPath}{item.isPrivate ? ' · 私有' : ''}{item.enabled === false ? ' · 已停用' : ''}</p></td>
          <td className="p-3"><div className="flex max-w-xs flex-wrap gap-1">{item.issues.map(issue => <span key={issue} className="rounded bg-muted px-2 py-1 text-xs">{qualityLabels[issue]}</span>)}</div><p className="mt-1 max-w-xs text-xs text-muted-foreground">{item.health?.reason}</p></td>
          <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{item.health ? <time dateTime={item.health.checkedAt}>{item.health.checkedAt.slice(0, 19).replace('T', ' ')} UTC</time> : '尚未检测'}</td>
          <td className="p-3"><div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><a href={siteEditHref(item)}>编辑</a></Button>
            <Button variant="ghost" size="sm" disabled={Boolean(scan)} onClick={() => checkLinks([item.id])}>检测</Button>
          </div></td>
        </tr>)}</tbody>
      </table>
      {!displayed.length && <p className="p-8 text-center text-sm text-muted-foreground">当前筛选下没有待处理站点。</p>}
    </div>
    <div className="flex items-center justify-between gap-2 text-sm"><span>共 {filtered.length} 条 · 第 {currentPage} / {pages} 页</span><div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>上一页</Button>
      <Button variant="outline" size="sm" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>下一页</Button>
    </div></div>
  </div>
}
