import Link from 'next/link'
import Image from 'next/image'
import { Card, CardHeader, CardTitle, CardDescription } from '@/registry/new-york/ui/card'
import type { NavigationSubItem } from '@/types/navigation'
import type { SiteConfig } from '@/types/site'
import { getNavigationItemElementId } from '@/lib/navigation-anchor'
import { getNavigationHostname } from '@/lib/navigation-search'

type NavigationCardItem = Pick<
  NavigationSubItem,
  'id' | 'title' | 'href' | 'description' | 'icon'
>

interface NavigationCardProps {
  item: NavigationCardItem
  siteConfig?: SiteConfig
  isSearchAnchor?: boolean
}

export function NavigationCard({
  item,
  siteConfig,
  isSearchAnchor = true,
}: NavigationCardProps) {
  const linkTarget = siteConfig?.navigation?.linkTarget || '_blank'
  const hostname = getNavigationHostname(item.href).replace(/^www\./, '')

  return (
    <Card
      id={isSearchAnchor ? getNavigationItemElementId(item.id) : undefined}
      className="h-full scroll-m-24 overflow-hidden transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-lg"
    >
      <Link
        href={item.href}
        target={linkTarget}
        rel="noopener noreferrer"
        data-navigation-site-id={item.id}
        className="block h-full"
        title={item.description || item.title}
      >
        <CardHeader className="p-3 sm:p-4">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            {item.icon && (
              <div className="h-8 w-8 flex-shrink-0 sm:h-10 sm:w-10">
                <Image
                  src={item.icon}
                  alt={`${item.title} icon`}
                  width={40}
                  height={40}
                  unoptimized
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
              <CardTitle className="line-clamp-1 break-words text-sm leading-snug sm:text-base">
                {item.title}
              </CardTitle>
              {hostname && (
                <div className="truncate text-[11px] leading-4 text-muted-foreground/80 sm:text-xs">
                  {hostname}
                </div>
              )}
              {item.description && (
                <CardDescription className="line-clamp-2 text-xs leading-snug sm:line-clamp-1 sm:text-sm">
                  {item.description}
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
      </Link>
    </Card>
  )
}
