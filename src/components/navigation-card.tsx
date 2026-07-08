import Link from 'next/link'
import Image from 'next/image'
import { Card, CardHeader, CardTitle, CardDescription } from '@/registry/new-york/ui/card'
import type { NavigationSubItem } from '@/types/navigation'
import type { SiteConfig } from '@/types/site'
import { getNavigationItemElementId } from '@/lib/navigation-anchor'

interface NavigationCardProps {
  item: NavigationSubItem
  siteConfig?: SiteConfig
}

export function NavigationCard({ item, siteConfig }: NavigationCardProps) {
  const linkTarget = siteConfig?.navigation?.linkTarget || '_blank'

  return (
    <Card
      id={getNavigationItemElementId(item.id)}
      className="h-full scroll-m-24 overflow-hidden transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-lg"
    >
      <Link
        href={item.href}
        target={linkTarget}
        rel="noopener noreferrer"
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
            <div className="min-w-0 space-y-0.5 sm:space-y-1">
              <CardTitle className="line-clamp-1 break-words text-sm leading-snug sm:text-base">
                {item.title}
              </CardTitle>
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
