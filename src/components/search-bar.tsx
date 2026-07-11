'use client'

import Image from 'next/image'
import { useState, useRef, useEffect, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Input } from '@/registry/new-york/ui/input'
import { ExternalLink, Search, X } from 'lucide-react'
import { Button } from '@/registry/new-york/ui/button'
import type { NavigationItem, NavigationSubItem } from '@/types/navigation'
import type { SiteConfig } from '@/types/site'
import { getNavigationItemElementId } from '@/lib/navigation-anchor'

interface SearchBarProps {
  onSearch: (query: string) => void
  searchResults: Array<{
    category: NavigationItem
    items: (NavigationItem | NavigationSubItem)[]
    subCategories: Array<{
      title: string
      items: (NavigationItem | NavigationSubItem)[]
    }>
  }>
  searchQuery: string
  siteConfig?: SiteConfig
  isLoading?: boolean
  hasError?: boolean
  onActivate?: () => void
}

interface SearchResultItemProps {
  item: NavigationItem | NavigationSubItem
  searchQuery: string
  onSelect: (item: NavigationItem | NavigationSubItem) => void
  onOpen: (item: NavigationItem | NavigationSubItem) => void
}

function SearchResultItem({ item, searchQuery, onSelect, onOpen }: SearchResultItemProps) {
  const highlightText = (text: string) => {
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'))

    return parts.map((part, index) =>
      part.toLowerCase() === searchQuery.toLowerCase()
        ? <mark key={index} className="bg-yellow-200 text-inherit dark:bg-yellow-800">{part}</mark>
        : part
    )
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    onSelect(item)
  }

  return (
    <div
      role="option"
      aria-selected="false"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={handleKeyDown}
      className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2.5 outline-none hover:bg-accent/50 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring sm:gap-3 sm:px-3 sm:py-3"
    >
      <div className="h-7 w-7 flex-shrink-0 sm:h-8 sm:w-8">
        {item.icon && (
          <Image
            src={item.icon}
            alt={`${item.title} icon`}
            width={32}
            height={32}
            unoptimized
            className="h-full w-full rounded object-contain"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-medium">{highlightText(item.title)}</span>
        {item.description && (
          <span className="line-clamp-1 text-xs text-muted-foreground">
            {highlightText(item.description)}
          </span>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        title="打开站点"
        aria-label={`打开 ${item.title}`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onOpen(item)
        }}
      >
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
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
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFocused(false)
        inputRef.current?.blur()
      }
      
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        onActivate?.()
        inputRef.current?.focus()
        setIsFocused(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onActivate])

  const handleInputChange = (value: string) => {
    onSearch(value)
    setIsFocused(true)
  }

  const handleItemSelect = (item: NavigationItem | NavigationSubItem) => {
    const element = document.getElementById(getNavigationItemElementId(item.id))
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    onSearch('')
    setIsFocused(false)
  }

  const openItemLink = (item: NavigationItem | NavigationSubItem) => {
    const itemWithHref = item as NavigationSubItem
    if (itemWithHref.href) {
      const linkTarget = siteConfig?.navigation?.linkTarget || '_blank'
      if (linkTarget === '_self') {
        window.location.href = itemWithHref.href
      } else {
        window.open(itemWithHref.href, linkTarget)
      }
    }
  }

  const clearSearch = () => {
    onSearch('')
    setIsFocused(false)
    inputRef.current?.focus()
  }

  const showResults = isFocused && searchQuery.trim().length > 0

  return (
    <div
      ref={searchRef}
      className="relative mx-auto w-full max-w-lg min-w-0"
      onPointerEnter={onActivate}
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="搜索导航..."
          value={searchQuery}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            onActivate?.()
            setIsFocused(true)
          }}
          className="h-9 rounded-lg border pl-9 pr-9 text-sm shadow-sm sm:h-10 sm:pl-10 sm:pr-20"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="h-6 w-6 p-0 hover:bg-muted"
              aria-label="Clear search"
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
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70svh,28rem)] overflow-hidden rounded-lg border bg-background shadow-xl">
          <div
            role="listbox"
            aria-label="导航搜索结果"
            className="max-h-[min(70svh,28rem)] overflow-y-auto p-1"
          >
              {isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  正在加载搜索数据...
                </div>
              ) : hasError ? (
                <div className="py-8 text-center text-sm text-destructive">
                  搜索数据加载失败，请重新聚焦搜索框后重试
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-muted-foreground text-sm">
                    未找到与 &ldquo;<span className="font-medium">{searchQuery}</span>&rdquo; 相关的导航
                  </div>
                  <div className="text-xs text-muted-foreground/70 mt-1">
                    尝试使用不同的关键词搜索
                  </div>
                </div>
              ) : (
                searchResults.map((result) => (
                  <div key={result.category.id} role="group" aria-label={result.category.title}>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      {result.category.title}
                    </div>
                    {result.items.map((item) => (
                      <SearchResultItem
                        key={item.id}
                        item={item}
                        searchQuery={searchQuery}
                        onSelect={handleItemSelect}
                        onOpen={openItemLink}
                      />
                    ))}
                    {result.subCategories.map((sub) => (
                      <div key={sub.title}>
                        <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30 border-b">
                          {result.category.title} / {sub.title}
                        </div>
                        {sub.items.map((item) => (
                          <SearchResultItem
                            key={item.id}
                            item={item}
                            searchQuery={searchQuery}
                            onSelect={handleItemSelect}
                            onOpen={openItemLink}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                ))
              )}
          </div>
        </div>
      )}
    </div>
  )
}
