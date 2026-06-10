import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/registry/new-york/ui/card'
import { Icons } from '@/components/icons'
import type { NavigationSubItem } from '@/types/navigation'
import type { SiteConfig } from '@/types/site'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface NavigationCardProps {
  item: NavigationSubItem
  siteConfig?: SiteConfig
}

export function NavigationCard({ item, siteConfig }: NavigationCardProps) {
  const isExternalIcon = item.icon?.startsWith('http')
  const isLocalIcon = item.icon && !isExternalIcon

  const iconPath = isLocalIcon && item.icon
    ? item.icon.startsWith('/') 
      ? item.icon 
      : `/${item.icon}`
    : item.icon || '/placeholder-icon.png'

  // 获取链接打开方式，默认为新窗口
  const linkTarget = siteConfig?.navigation?.linkTarget || '_blank'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="h-full overflow-hidden transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-lg">
            <Link
              href={item.href}
              target={linkTarget}
              rel="noopener noreferrer"
              className="block h-full"
            >
              <CardHeader className="p-3 sm:p-4">
                <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                  {item.icon && (
                    <div className="h-8 w-8 flex-shrink-0 sm:h-10 sm:w-10">
                      <img
                        src={item.icon}
                        alt={`${item.title} icon`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="min-w-0 space-y-0.5 sm:space-y-1">
                    <CardTitle className="break-words text-sm leading-snug sm:text-base">{item.title}</CardTitle>
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
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          align="center"
          sideOffset={8}
          className="max-w-[280px] text-xs sm:text-sm"
        >
          <p>{item.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
