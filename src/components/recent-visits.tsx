'use client'

import { useMemo } from 'react'
import { History, Trash2 } from 'lucide-react'
import { NavigationCard } from '@/components/navigation-card'
import { Button } from '@/registry/new-york/ui/button'
import type { NavigationSearchIndexItem } from '@/types/navigation'
import type { SiteConfig } from '@/types/site'

interface RecentVisitsProps {
  itemIds: string[]
  items: NavigationSearchIndexItem[]
  siteConfig: SiteConfig
  onClear: () => void
}

export function RecentVisits({ itemIds, items, siteConfig, onClear }: RecentVisitsProps) {
  const recentItems = useMemo(() => {
    const itemsById = new Map(items.map(item => [item.id, item]))
    return itemIds
      .map(id => itemsById.get(id))
      .filter((item): item is NavigationSearchIndexItem => Boolean(item))
  }, [itemIds, items])

  if (recentItems.length === 0) return null

  return (
    <div className="px-2 pt-3 sm:px-4 sm:pt-5 lg:px-6 lg:pt-6">
      <section aria-labelledby="recent-visits-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <History className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <h2 id="recent-visits-heading" className="text-base font-medium tracking-tight">
              最近访问
            </h2>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              仅保存在当前浏览器
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-8 shrink-0 px-2 text-xs text-muted-foreground"
            aria-label="清空最近访问"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            清空
          </Button>
        </div>
        <div
          role="list"
          aria-label="最近访问的站点"
          className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 sm:gap-3 xl:grid-cols-3"
        >
          {recentItems.map(item => (
            <div key={item.id} role="listitem">
              <NavigationCard item={item} siteConfig={siteConfig} isSearchAnchor={false} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
