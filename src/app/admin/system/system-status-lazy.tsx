'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const LazySystemStatus = dynamic(
  () => import('./system-status-client').then(module => module.SystemStatusClient),
  {
    ssr: false,
    loading: SystemStatusLoading,
  }
)

export function SystemStatusLazy() {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(() => setIsReady(true), { timeout: 800 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = setTimeout(() => setIsReady(true), 150)
    return () => clearTimeout(timeoutId)
  }, [])

  return isReady ? <LazySystemStatus /> : <SystemStatusLoading />
}

function SystemStatusLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="系统状态加载中">
      <div className="space-y-2">
        <div className="h-8 w-36 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg border bg-muted/60" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-44 animate-pulse rounded-lg border bg-muted/40" />
        <div className="h-44 animate-pulse rounded-lg border bg-muted/40" />
      </div>
    </div>
  )
}
