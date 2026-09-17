'use client'

import Image from 'next/image'
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ExternalLink, LocateFixed, Search, X } from 'lucide-react'
import { Button } from '@/registry/new-york/ui/button'
import { Input } from '@/registry/new-york/ui/input'
import type { NavigationSearchIndexItem } from '@/types/navigation'
import type { SiteConfig } from '@/types/site'
import { getNavigationItemElementId } from '@/lib/navigation-anchor'
import { getNavigationHostname } from '@/lib/navigation-search'

interface SearchBarProps {
  onSearch: (query: string) => void
  searchResults: NavigationSearchIndexItem[]
  searchQuery: string
  siteConfig?: SiteConfig
  isLoading?: boolean
  hasError?: boolean
  onActivate?: () => void
}

interface SearchResultItemProps {
  item: NavigationSearchIndexItem
  optionId: string
  searchQuery: string
  active: boolean
  onOpen: (item: NavigationSearchIndexItem) => void
  onLocate: (item: NavigationSearchIndexItem) => void
  onActivate: () => void
}

function SearchResultItem({
  item,
  optionId,
  searchQuery,
  active,
  onOpen,
  onLocate,
  onActivate,
}: SearchResultItemProps) {
  const hostname = getNavigationHostname(item.href)
  const highlightText = (text: string) => {
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'))

    return parts.map((part, index) =>
      part.toLowerCase() === searchQuery.toLowerCase()
        ? <mark key={index} className="bg-yellow-200 text-inherit dark:bg-yellow-800">{part}</mark>
        : part
    )
  }

  return (
    <div
      id={optionId}
      role="option"
      aria-selected={active}
      aria-label={`${item.title}，打开站点`}
      onPointerMove={onActivate}
      onClick={() => onOpen(item)}
      className={`flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2.5 outline-none sm:gap-3 sm:px-3 sm:py-3 ${
        active ? 'bg-accent ring-1 ring-inset ring-border' : 'hover:bg-accent/50'
      }`}
    >
      <div className="h-7 w-7 flex-shrink-0 sm:h-8 sm:w-8">
        {item.icon && (
          <Image
            src={item.icon}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="h-full w-full rounded object-contain"
            onError={(event) => { event.currentTarget.style.display = 'none' }}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-medium">{highlightText(item.title)}</span>
        {item.categoryPath.length > 0 && (
          <span className="line-clamp-1 text-[11px] text-muted-foreground/80">
            {highlightText(item.categoryPath.join(' / '))}
          </span>
        )}
        {hostname && (
          <span className="line-clamp-1 text-[11px] text-muted-foreground/80">
            {highlightText(hostname)}
          </span>
        )}
        {item.aliases && item.aliases.length > 0 && (
          <span className="line-clamp-1 text-[11px] text-muted-foreground/80">
            别名：{highlightText(item.aliases.join('、'))}
          </span>
        )}
        {item.description && (
          <span className="line-clamp-1 text-xs text-muted-foreground">
            {highlightText(item.description)}
          </span>
        )}
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        title="在首页定位"
        aria-label={`在首页定位 ${item.title}`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onLocate(item)
        }}
      >
        <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  )
}

export function SearchBar({
  onSearch,
  searchResults,
  searchQuery,
  siteConfig,
  isLoading = false,
  hasError = false,
  onActivate,
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const highlightedElementRef = useRef<HTMLElement | null>(null)
  const highlightTimeoutRef = useRef<number | null>(null)
  const searchId = useId().replace(/:/g, '')
  const listboxId = `navigation-search-results-${searchId}`
  const optionId = (index: number) => `${listboxId}-option-${index}`
  const showResults = isFocused && searchQuery.trim().length > 0
  const hasSelectableResults = showResults && !isLoading && !hasError && searchResults.length > 0

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false)
        setActiveIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => () => {
    if (highlightTimeoutRef.current !== null) window.clearTimeout(highlightTimeoutRef.current)
    highlightedElementRef.current?.removeAttribute('data-navigation-search-highlight')
  }, [])

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFocused(false)
        setActiveIndex(-1)
        inputRef.current?.blur()
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onActivate?.()
        inputRef.current?.focus()
        setIsFocused(true)
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [onActivate])

  useEffect(() => {
    setActiveIndex(hasSelectableResults ? 0 : -1)
  }, [hasSelectableResults, searchQuery, searchResults.length])

  useEffect(() => {
    if (!hasSelectableResults || activeIndex < 0) return
    document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, hasSelectableResults, listboxId])

  const closeResults = (blur = true) => {
    setIsFocused(false)
    setActiveIndex(-1)
    if (blur) inputRef.current?.blur()
  }

  const handleInputChange = (value: string) => {
    onSearch(value)
    setIsFocused(true)
  }

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return

    if (event.key === 'Escape') {
      event.preventDefault()
      closeResults()
      return
    }
    if (!hasSelectableResults) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(current => current < 0 ? 0 : (current + 1) % searchResults.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(current => current <= 0 ? searchResults.length - 1 : current - 1)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(searchResults.length - 1)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const item = searchResults[activeIndex >= 0 ? activeIndex : 0]
      if (item) openItem(item)
    }
  }

  const locateItem = (item: NavigationSearchIndexItem) => {
    const element = document.getElementById(getNavigationItemElementId(item.id))
    if (element) {
      highlightNavigationItem(element)
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    onSearch('')
    closeResults()
  }

  const highlightNavigationItem = (element: HTMLElement) => {
    if (highlightTimeoutRef.current !== null) window.clearTimeout(highlightTimeoutRef.current)

    highlightedElementRef.current?.removeAttribute('data-navigation-search-highlight')
    element.removeAttribute('data-navigation-search-highlight')
    void element.offsetWidth
    element.setAttribute('data-navigation-search-highlight', 'true')
    highlightedElementRef.current = element
    highlightTimeoutRef.current = window.setTimeout(() => {
      element.removeAttribute('data-navigation-search-highlight')
      if (highlightedElementRef.current === element) highlightedElementRef.current = null
      highlightTimeoutRef.current = null
    }, 2_400)
  }

  const openItem = (item: NavigationSearchIndexItem) => {
    if (!item.href) return
    const linkTarget = siteConfig?.navigation?.linkTarget || '_blank'
    onSearch('')
    closeResults()
    if (linkTarget === '_self') {
      window.location.assign(item.href)
    } else {
      window.open(item.href, linkTarget, 'noopener,noreferrer')
    }
  }

  const clearSearch = () => {
    onSearch('')
    setActiveIndex(-1)
    inputRef.current?.focus()
  }

  return (
    <div
      ref={searchRef}
      className="relative mx-auto w-full max-w-lg min-w-0"
      onPointerEnter={onActivate}
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls={listboxId}
          aria-activedescendant={hasSelectableResults && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          placeholder="搜索导航..."
          value={searchQuery}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleInputKeyDown}
          onFocus={() => {
            onActivate?.()
            setIsFocused(true)
          }}
          className="h-9 rounded-lg border pl-9 pr-9 text-sm shadow-sm sm:h-10 sm:pl-10 sm:pr-20"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="h-6 w-6 p-0 hover:bg-muted"
              aria-label="清空搜索"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          <kbd className="hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs text-muted-foreground opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      {showResults && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border bg-background shadow-xl">
          <div
            id={listboxId}
            role="listbox"
            aria-label="导航搜索结果"
            className="max-h-[min(64svh,25rem)] overflow-y-auto p-1"
          >
            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">正在加载搜索数据...</div>
            ) : hasError ? (
              <div className="py-8 text-center text-sm text-destructive">搜索数据加载失败，请重新聚焦搜索框后重试</div>
            ) : searchResults.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-sm text-muted-foreground">
                  未找到与 &ldquo;<span className="font-medium">{searchQuery}</span>&rdquo; 相关的导航
                </div>
                <div className="mt-1 text-xs text-muted-foreground/70">尝试使用不同的关键词搜索</div>
              </div>
            ) : (
              searchResults.map((item, index) => (
                <SearchResultItem
                  key={item.id}
                  item={item}
                  optionId={optionId(index)}
                  searchQuery={searchQuery}
                  active={activeIndex === index}
                  onActivate={() => setActiveIndex(index)}
                  onOpen={openItem}
                  onLocate={locateItem}
                />
              ))
            )}
          </div>
          {searchResults.length > 0 && !isLoading && !hasError && (
            <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              <span>↑↓ 选择 · Enter 打开 · Esc 关闭</span>
              <span>右侧按钮定位卡片</span>
            </div>
          )}
          <div className="sr-only" aria-live="polite">
            {hasSelectableResults ? `找到 ${searchResults.length} 个结果，使用上下方向键选择，按 Enter 打开` : ''}
          </div>
        </div>
      )}
    </div>
  )
}
