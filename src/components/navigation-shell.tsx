'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Github, Menu } from 'lucide-react'
import type { NavigationData, NavigationSearchIndex } from '@/types/navigation'
import type { SiteConfig } from '@/types/site'
import { Sidebar } from '@/components/sidebar'
import { SearchBar } from '@/components/search-bar'
import { RecentVisits } from '@/components/recent-visits'
import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/registry/new-york/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from '@/registry/new-york/ui/sheet'
import { useNavigationSidebar } from '@/components/use-navigation-sidebar'
import { searchNavigationItems } from '@/lib/navigation-search'
import {
  clearRecentVisits,
  readRecentVisitIds,
  recordRecentVisit,
  RECENT_VISITS_STORAGE_KEY,
  RECENT_VISITS_UPDATED_EVENT,
} from '@/lib/recent-visits'

interface NavigationShellProps {
  navigationOutline: NavigationData
  siteData: SiteConfig
  searchRevision: string
  children: ReactNode
}

export function NavigationShell({
  navigationOutline,
  siteData,
  searchRevision,
  children,
}: NavigationShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchData, setSearchData] = useState<NavigationSearchIndex | null>(null)
  const [isSearchLoading, setIsSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [recentVisitIds, setRecentVisitIds] = useState<string[]>([])
  const searchRequestRef = useRef<Promise<void> | null>(null)
  const { activeId, expandedCategories, toggleCategory } = useNavigationSidebar(navigationOutline)

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => { if (desktop.matches) setIsSidebarOpen(false) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  useEffect(() => {
    const syncRecentVisits = () => setRecentVisitIds(readRecentVisitIds())
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === RECENT_VISITS_STORAGE_KEY) syncRecentVisits()
    }
    const recordVisitFromLink = (event: MouseEvent) => {
      if (event.type === 'auxclick' && event.button !== 1) return
      const target = event.target instanceof Element ? event.target : null
      const link = target?.closest<HTMLAnchorElement>('a[data-navigation-site-id]')
      const itemId = link?.dataset.navigationSiteId
      if (itemId) recordRecentVisit(itemId)
    }

    syncRecentVisits()
    window.addEventListener(RECENT_VISITS_UPDATED_EVENT, syncRecentVisits)
    window.addEventListener('storage', handleStorage)
    document.addEventListener('click', recordVisitFromLink, true)
    document.addEventListener('auxclick', recordVisitFromLink, true)

    return () => {
      window.removeEventListener(RECENT_VISITS_UPDATED_EVENT, syncRecentVisits)
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('click', recordVisitFromLink, true)
      document.removeEventListener('auxclick', recordVisitFromLink, true)
    }
  }, [])

  const loadSearchData = useCallback(() => {
    if (searchData || searchRequestRef.current) return

    setIsSearchLoading(true)
    setSearchError(false)

    const searchParams = new URLSearchParams({ v: searchRevision })
    const request = fetch(`/api/home/navigation?${searchParams}`)
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Failed to load navigation search data: ${response.status}`)
        }

        setSearchData(await response.json() as NavigationSearchIndex)
      })
      .catch(error => {
        console.error('Failed to load navigation search data:', error)
        setSearchError(true)
      })
      .finally(() => {
        setIsSearchLoading(false)
        searchRequestRef.current = null
      })

    searchRequestRef.current = request
  }, [searchData, searchRevision])

  useEffect(() => {
    if (recentVisitIds.length > 0) loadSearchData()
  }, [loadSearchData, recentVisitIds.length])

  const searchResults = useMemo(() => {
    if (!searchData) return []
    return searchNavigationItems(searchData.items, searchQuery)
  }, [searchData, searchQuery])

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="hidden lg:block">
        <Sidebar
          navigationData={navigationOutline}
          siteInfo={siteData}
          className="sticky top-0 h-screen"
          activeId={activeId}
          expandedCategories={expandedCategories}
          onToggleCategory={toggleCategory}
        />
      </div>

      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 bg-background/90 px-2 py-2 backdrop-blur-sm sm:px-4 lg:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <SearchBar
                onSearch={setSearchQuery}
                searchResults={searchResults}
                searchQuery={searchQuery}
                siteConfig={siteData}
                isLoading={isSearchLoading}
                hasError={searchError}
                onActivate={loadSearchData}
              />
            </div>
            <div className="flex items-center gap-1">
              <ModeToggle />
              <Link
                href="https://github.com/tianyaxiang/NavSphere"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden min-[420px]:block"
                aria-label="访问 GitHub 仓库"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:bg-accent hover:text-accent-foreground sm:h-10 sm:w-10"
                >
                  <Github className="h-5 w-5" />
                </Button>
              </Link>
              <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 lg:hidden" aria-label="打开分类导航">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="max-w-xs p-0 sm:p-0">
                  <SheetTitle className="sr-only">分类导航</SheetTitle>
                  <SheetDescription className="sr-only">选择分类跳转，按 Escape 关闭导航。</SheetDescription>
                  <Sidebar navigationData={navigationOutline} siteInfo={siteData}
                    activeId={activeId} expandedCategories={expandedCategories} onToggleCategory={toggleCategory}
                    onClose={() => setIsSidebarOpen(false)} />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        <RecentVisits
          itemIds={recentVisitIds}
          items={searchData?.items || []}
          siteConfig={siteData}
          onClear={clearRecentVisits}
        />
        {children}
      </main>
    </div>
  )
}
