'use client'
export const runtime = 'edge'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  History,
  ImageIcon,
  RefreshCw,
  ServerCog,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type StatusLevel = 'available' | 'degraded' | 'unconfigured' | 'error'

type StatusItem = {
  id: string
  title: string
  status: StatusLevel
  configured: boolean
  target?: string
  latencyMs?: number
  details: string
  action: string
}

type SystemStatus = {
  checkedAt: string
  environment: {
    redisKeyPrefix: string
    redisRestHost: string
    blobStoreIdConfigured: boolean
    dataHistoryLimit: string
  }
  services: StatusItem[]
  capabilities: StatusItem[]
}

const statusLabels: Record<StatusLevel, string> = {
  available: '可用',
  degraded: '降级',
  unconfigured: '未配置',
  error: '异常',
}

const statusBadgeVariants: Record<StatusLevel, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  available: 'default',
  degraded: 'secondary',
  unconfigured: 'outline',
  error: 'destructive',
}

const statusIconClasses: Record<StatusLevel, string> = {
  available: 'text-green-600',
  degraded: 'text-amber-600',
  unconfigured: 'text-muted-foreground',
  error: 'text-destructive',
}

const statusIcons = {
  available: CheckCircle2,
  degraded: AlertTriangle,
  unconfigured: ShieldAlert,
  error: XCircle,
}

const serviceIcons: Record<string, typeof Database> = {
  redis: Database,
  blob: HardDrive,
  'navigation-data': Database,
  history: History,
  resources: ImageIcon,
  'favicon-cache': ImageIcon,
}

export default function AdminSystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadStatus = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/system-status', {
        cache: 'no-store',
      })
      const contentType = response.headers.get('content-type') || ''
      const result = contentType.includes('application/json')
        ? await response.json()
        : { error: await response.text() }

      if (!response.ok) {
        throw new Error(result.error || result.details || '系统状态加载失败')
      }

      setStatus(result)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '系统状态加载失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const summary = useMemo(() => {
    const items = [...(status?.services || []), ...(status?.capabilities || [])]
    return {
      available: items.filter(item => item.status === 'available').length,
      warning: items.filter(item => item.status === 'degraded' || item.status === 'unconfigured').length,
      error: items.filter(item => item.status === 'error').length,
      total: items.length,
    }
  }, [status])

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">系统状态</h1>
          <p className="text-muted-foreground">
            Redis/KV、Vercel Blob、历史版本和图标缓存能力状态。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={loadStatus}
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          刷新状态
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusSummaryCard title="检查项" value={summary.total} icon={Activity} />
        <StatusSummaryCard title="可用" value={summary.available} icon={CheckCircle2} />
        <StatusSummaryCard title="待配置" value={summary.warning} icon={AlertTriangle} />
        <StatusSummaryCard title="异常" value={summary.error} icon={XCircle} />
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ServerCog className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">基础服务</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {(status?.services || []).map(item => (
            <StatusCard key={item.id} item={item} />
          ))}
          {isLoading && !status && (
            <>
              <StatusSkeleton />
              <StatusSkeleton />
            </>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">后台能力</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {(status?.capabilities || []).map(item => (
            <StatusCard key={item.id} item={item} />
          ))}
          {isLoading && !status && (
            <>
              <StatusSkeleton />
              <StatusSkeleton />
            </>
          )}
        </div>
      </section>

      {status && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">运行配置</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ConfigItem label="Redis REST Host" value={status.environment.redisRestHost || '未配置'} />
            <ConfigItem label="Redis Key Prefix" value={status.environment.redisKeyPrefix} />
            <ConfigItem label="Blob Store ID" value={status.environment.blobStoreIdConfigured ? '已配置' : '未配置'} />
            <ConfigItem label="历史版本保留" value={`${status.environment.dataHistoryLimit} 个版本`} />
          </div>
          <div className="text-xs text-muted-foreground">
            最近检查：{formatTime(status.checkedAt)}
          </div>
        </section>
      )}
    </div>
  )
}

function StatusSummaryCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: number
  icon: typeof Activity
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{title}</CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

function StatusCard({ item }: { item: StatusItem }) {
  const StatusIcon = statusIcons[item.status]
  const ItemIcon = serviceIcons[item.id] || Activity

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted/30">
              <ItemIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{item.title}</CardTitle>
              {item.target && (
                <CardDescription className="truncate">{item.target}</CardDescription>
              )}
            </div>
          </div>
          <Badge variant={statusBadgeVariants[item.status]} className="shrink-0">
            {statusLabels[item.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 text-sm">
          <StatusIcon className={`mt-0.5 h-4 w-4 shrink-0 ${statusIconClasses[item.status]}`} />
          <span>{item.details}</span>
        </div>
        <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
          {item.action}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            {item.configured ? '配置存在' : '配置缺失'}
          </Badge>
          {typeof item.latencyMs === 'number' && (
            <Badge variant="outline">{item.latencyMs} ms</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StatusSkeleton() {
  return (
    <div className="min-h-[180px] rounded-lg border bg-card p-6">
      <div className="mb-4 h-5 w-32 rounded bg-muted" />
      <div className="mb-2 h-4 w-full rounded bg-muted" />
      <div className="h-4 w-2/3 rounded bg-muted" />
    </div>
  )
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-sm">{value}</div>
    </div>
  )
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}
