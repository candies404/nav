'use client'

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Github, Menu } from 'lucide-react'
import type { NavigationData, NavigationItem, NavigationSubItem } from '@/types/navigation'
import type { SiteConfig } from '@/types/site'
import { Sidebar } from '@/components/sidebar'
import { SearchBar } from '@/components/search-bar'
import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/registry/new-york/ui/button'
import { cn } from '@/lib/utils'

interface NavigationShellProps {
  navigationOutline: NavigationData
  siteData: SiteConfig
  searchRevision: string
  searchScope: 'public' | 'private'
  children: ReactNode
}

export function NavigationShell({
  navigationOutline,
  siteData,
  searchRevision,
  searchScope,
  children,
}: NavigationShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchData, setSearchData] = useState<NavigationData | null>(null)
  const [isSearchLoading, setIsSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const searchRequestRef = useRef<Promise<void> | null>(null)

  const loadSearchData = useCallback(() => {
    if (searchData || searchRequestRef.current) return

    setIsSearchLoading(true)
    setSearchError(false)

    const searchParams = new URLSearchParams({
      scope: searchScope,
      v: searchRevision,
    })
    const request = fetch(`/api/home/navigation?${searchParams}`)
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Failed to load navigation search data: ${response.status}`)
        }

        setSearchData(await response.json() as NavigationData)
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
  }, [searchData, searchRevision, searchScope])

  const searchResults = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    if (!query || !searchData) return []

    const results: Array<{
      category: NavigationItem
      items: (NavigationItem | NavigationSubItem)[]
      subCategories: Array<{
        title: string
        items: (NavigationItem | NavigationSubItem)[]
      }>
    }> = []

    searchData.navigationItems.forEach(category => {
      const items = (category.items || []).filter(item => {
        if (item.enabled === false) return false
        return item.title.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query)
      })

      const subCategories: Array<{
        title: string
        items: (NavigationItem | NavigationSubItem)[]
      }> = []

      category.subCategories?.forEach(subCategory => {
        if (subCategory.enabled === false) return

        const subItems = (subCategory.items || []).filter(item => {
          if (item.enabled === false) return false
          return item.title.toLowerCase().includes(query) ||
            item.description?.toLowerCase().includes(query)
        })

        if (subItems.length > 0) {
          subCategories.push({
            title: subCategory.title,
            items: subItems,
          })
        }
      })

      if (items.length > 0 || subCategories.length > 0) {
        results.push({
          category,
          items,
          subCategories,
        })
      }
    })

    return results
  }, [searchData, searchQuery])

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="hidden lg:block">
        <Sidebar
          navigationData={navigationOutline}
          siteInfo={siteData}
          className="sticky top-0 h-screen"
        />
      </div>

      <div
        className={cn(
          'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-all lg:hidden',
          isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        aria-hidden={!isSidebarOpen}
      >
        <div
          className={cn(
            'fixed inset-y-0 right-0 w-[85vw] max-w-xs bg-background shadow-lg transition-transform duration-200 ease-in-out',
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          <Sidebar
            navigationData={navigationOutline}
            siteInfo={siteData}
            onClose={() => setIsSidebarOpen(false)}
          />
        </div>
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
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-10 sm:w-10 lg:hidden"
                onClick={() => setIsSidebarOpen(open => !open)}
                aria-label={isSidebarOpen ? '关闭侧边栏' : '打开侧边栏'}
                aria-expanded={isSidebarOpen}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {children}
      </main>
    </div>
  )
}
