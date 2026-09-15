'use client'

import { useId } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Button } from '@/registry/new-york/ui/button'
import { ScrollArea } from '@/registry/new-york/ui/scroll-area'
import type { NavigationData } from '@/types/navigation'
import type { SiteConfig } from '@/types/site'
import {
  Book,
  BookOpen,
  Box,
  Brain,
  Building,
  ChevronDown,
  ChevronRight,
  Code,
  Coffee,
  Database,
  Edit,
  FileText,
  Files,
  Folder,
  Globe,
  Laptop,
  Star,
  Video,
  type LucideIcon,
} from 'lucide-react'

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  navigationData: NavigationData
  siteInfo: SiteConfig
  onClose?: () => void
  activeId: string
  expandedCategories: Record<string, boolean>
  onToggleCategory: (id: string) => void
}

const SIDEBAR_ICONS: Record<string, LucideIcon> = {
  Book,
  BookOpen,
  Box,
  Brain,
  Building,
  Code,
  Coffee,
  Database,
  Edit,
  FileText,
  Files,
  Folder,
  Laptop,
  Star,
  Video,
}

export function Sidebar({ className, navigationData, siteInfo, onClose, activeId, expandedCategories, onToggleCategory }: SidebarProps) {
  const sidebarId = useId()
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
      onClose?.()
    }
  }

  const handleCategoryClick = (categoryId: string) => {
    scrollToSection(categoryId)
  }

  const renderIcon = (iconName?: string) => {
    if (!iconName) return <Folder className="h-4 w-4" />;

    if (iconName.startsWith('/') || iconName.startsWith('http')) {
      return (
        <Image
          src={iconName}
          alt="icon"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
    }

    const IconComponent = SIDEBAR_ICONS[iconName] || Folder;
    return <IconComponent className="h-4 w-4" />;
  }

  return (
    <div className={cn("w-full bg-background lg:w-64", className)}>
      <div className={cn('flex h-14 items-center px-4', onClose && 'pr-12')}>
        <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold">
          {siteInfo.appearance.logo ? (
            <Image
              src={siteInfo.appearance.logo}
              alt={siteInfo.basic.title}
              width={24}
              height={24}
              className="h-6 w-6"
            />
          ) : (
            <Globe className="h-6 w-6" />
          )}
          <span className="truncate">{siteInfo.basic.title}</span>
        </Link>

      </div>

      <ScrollArea className="h-[calc(100svh-3.5rem)] px-3 py-2">
        <nav className="space-y-1" aria-label="网站分类">
          {navigationData.navigationItems.map((category) => (
            <div key={category.id} className="py-2">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  className={cn(
                    'min-w-0 flex-1 justify-start gap-2 font-medium text-muted-foreground hover:text-foreground cursor-pointer',
                    (activeId === category.id || category.subCategories?.some(sub => sub.id === activeId)) && 'bg-accent text-accent-foreground'
                  )}
                  aria-current={activeId === category.id ? 'location' : undefined}
                  onClick={() => handleCategoryClick(category.id)}
                >
                  {renderIcon(category.icon)}
                  <span className="truncate">{category.title}</span>
                </Button>

                {category.subCategories && category.subCategories.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 hover:bg-transparent cursor-pointer"
                    onClick={() => onToggleCategory(category.id)}
                    aria-label={`${expandedCategories[category.id] ? '收起' : '展开'}${category.title}`}
                    aria-expanded={Boolean(expandedCategories[category.id])}
                    aria-controls={`${sidebarId}-${category.id}`}
                  >
                    {expandedCategories[category.id] ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                )}
              </div>

              {category.subCategories && category.subCategories.length > 0 && (
                <div
                  id={`${sidebarId}-${category.id}`}
                  hidden={!expandedCategories[category.id]}
                  className="mt-1 ml-4 space-y-1"
                >
                  {category.subCategories.map((subCategory) => (
                    <Button
                      key={subCategory.id}
                      variant="ghost"
                      className={cn('w-full justify-start pl-6 text-sm text-muted-foreground/80 hover:text-foreground cursor-pointer', activeId === subCategory.id && 'bg-accent text-accent-foreground font-medium')}
                      aria-current={activeId === subCategory.id ? 'location' : undefined}
                      onClick={() => scrollToSection(subCategory.id)}
                    >
                      <span className="truncate">{subCategory.title}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </ScrollArea>
    </div>
  )
}
