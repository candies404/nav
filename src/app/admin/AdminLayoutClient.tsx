'use client'

import { installAdminUnauthorizedRedirect } from '@/lib/admin-unauthorized-redirect'
import { useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Home,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu as MenuIcon,
  Monitor,
  Moon,
  Settings,
  Sun,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/registry/new-york/ui/button'
import { Separator } from '@/registry/new-york/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/registry/new-york/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/registry/new-york/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/registry/new-york/ui/sheet'
import { ScrollArea } from '@/registry/new-york/ui/scroll-area'

interface AdminLayoutClientProps {
  children: ReactNode
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

const menuItems = [
  {
    title: '仪表盘',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    title: '导航管理',
    href: '/admin/navigation',
    icon: ListTodo,
    subItems: [
      {
        title: '分类管理',
        href: '/admin/navigation',
      },
      {
        title: '站点管理',
        href: '/admin/sitelist',
      },
    ],
  },
  {
    title: '图片资源',
    href: '/admin/resources',
    icon: Settings,
    subItems: [
      {
        title: '图片资源',
        href: '/admin/resources',
      },
      {
        title: '网站图标下载',
        href: '/admin/resources/download',
      },
    ],
  },
  {
    title: '数据管理',
    href: '/admin/data',
    icon: Database,
  },
  {
    title: '系统状态',
    href: '/admin/system',
    icon: Activity,
  },
  {
    title: '站点设置',
    href: '/admin/site',
    icon: Settings,
  },
]

installAdminUnauthorizedRedirect()

export function AdminLayoutClient({ children, user }: AdminLayoutClientProps) {
  const pathname = usePathname()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const { setTheme } = useTheme()

  const toggleMenuItem = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href)
        ? prev.filter((item) => item !== href)
        : [...prev, href]
    )
  }

  const renderLogo = (collapsed = false) => (
    <Link
      href="/admin"
      className={cn(
        'flex min-w-0 items-center',
        collapsed ? 'justify-center' : 'px-2'
      )}
      onClick={() => setIsMobileNavOpen(false)}
    >
      <div className={cn('flex min-w-0 items-center gap-2', collapsed && 'flex-col')}>
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md">
          <Image
            src="/assets/images/alogo.webp"
            alt="Logo"
            fill
            sizes="32px"
            className="object-cover"
          />
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-lg font-semibold leading-none tracking-tight">
              NavSphere
            </span>
            <span className="mt-1 truncate text-xs text-muted-foreground">
              管理控制台
            </span>
          </div>
        )}
      </div>
    </Link>
  )

  const renderMenuItems = (mobile = false) => (
    <nav className="grid gap-[2px]">
      {menuItems.map((item) => {
        const isGroupActive = item.subItems?.some((subItem) => pathname === subItem.href)
        const isActive = pathname === item.href || isGroupActive
        const isExpanded = expandedItems.includes(item.href) || Boolean(isGroupActive)
        const showLabel = !isSidebarCollapsed || mobile

        return (
          <div key={item.href}>
            <Button
              variant="ghost"
              className={cn(
                'w-full min-w-0 justify-start',
                isActive && 'bg-muted',
                !showLabel && 'justify-center px-0'
              )}
              onClick={() => item.subItems && toggleMenuItem(item.href)}
              asChild={!item.subItems}
            >
              {!item.subItems ? (
                <Link href={item.href} onClick={() => mobile && setIsMobileNavOpen(false)}>
                  <item.icon className={cn('h-4 w-4 shrink-0', showLabel && 'mr-2')} />
                  {showLabel && <span className="truncate">{item.title}</span>}
                </Link>
              ) : (
                <>
                  <item.icon className={cn('h-4 w-4 shrink-0', showLabel && 'mr-2')} />
                  {showLabel && (
                    <>
                      <span className="truncate">{item.title}</span>
                      <ChevronDown
                        className={cn(
                          'ml-auto h-4 w-4 shrink-0 transition-transform',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </>
                  )}
                </>
              )}
            </Button>

            {item.subItems && isExpanded && showLabel && (
              <div className="ml-4 mt-1 space-y-1">
                {item.subItems.map((subItem) => (
                  <Button
                    key={subItem.href}
                    variant="ghost"
                    className={cn(
                      'w-full min-w-0 justify-start pl-6',
                      pathname === subItem.href && 'bg-muted'
                    )}
                    asChild
                  >
                    <Link href={subItem.href} onClick={() => mobile && setIsMobileNavOpen(false)}>
                      <span className="truncate">{subItem.title}</span>
                    </Link>
                  </Button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )

  const renderUserMenu = ({
    align = 'start',
    side = 'top',
    compact = false,
  }: {
    align?: 'start' | 'center' | 'end'
    side?: 'top' | 'bottom'
    compact?: boolean
  } = {}) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'h-auto p-2 transition-colors hover:bg-muted',
            compact
              ? 'w-10 justify-center'
              : isSidebarCollapsed
                ? 'w-full justify-center'
                : 'w-full justify-start'
          )}
        >
          <div className={cn('flex items-center gap-3', !compact && 'w-full')}>
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={user.image || ''} alt={user.name || ''} />
              <AvatarFallback>
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            {!compact && !isSidebarCollapsed && (
              <div className="flex min-w-0 flex-1 items-center">
                <span className="truncate text-sm font-medium leading-none">
                  {user.name}
                </span>
                <div className="ml-auto flex flex-col gap-[3px] pl-4">
                  <div className="h-[3px] w-[2px] rounded-full bg-muted-foreground/40" />
                  <div className="h-[3px] w-[2px] rounded-full bg-muted-foreground/40" />
                  <div className="h-[3px] w-[2px] rounded-full bg-muted-foreground/40" />
                </div>
              </div>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align={align} side={side}>
        <DropdownMenuLabel className="font-normal">
          <div className="flex min-w-0 flex-col space-y-1">
            <p className="truncate text-sm font-medium leading-none">
              {user.name}
            </p>
            <p className="truncate text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/"
            className="cursor-pointer"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Home className="mr-2 h-4 w-4" />
            前台首页
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="ml-2">主题</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun className="mr-2 h-4 w-4" />
              浅色
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon className="mr-2 h-4 w-4" />
              深色
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Monitor className="mr-2 h-4 w-4" />
              跟随系统
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex cursor-pointer items-center text-red-600 focus:bg-red-100 focus:text-red-600"
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur lg:hidden">
        <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0" aria-label="打开导航菜单">
              <MenuIcon className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-[85vw] max-w-[320px] flex-col p-0 sm:p-0">
            <SheetHeader className="border-b px-4 py-4 text-left">
              <SheetTitle className="flex items-center gap-2">
                <span className="relative h-8 w-8 overflow-hidden rounded-md">
                  <Image
                    src="/assets/images/alogo.webp"
                    alt="Logo"
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </span>
                NavSphere
              </SheetTitle>
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1 px-3 py-3">
              {renderMenuItems(true)}
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <Link href="/admin" className="flex min-w-0 flex-1 items-center gap-2">
          <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md">
            <Image
              src="/assets/images/alogo.webp"
              alt="Logo"
              fill
              sizes="28px"
              className="object-cover"
            />
          </span>
          <span className="truncate font-semibold">NavSphere</span>
        </Link>
        {renderUserMenu({ align: 'end', side: 'bottom', compact: true })}
      </div>

      <div className="lg:h-screen lg:border-t">
        <div className="h-full bg-background">
          <div
            className={cn(
              'h-full transition-all duration-300 lg:grid',
              isSidebarCollapsed
                ? 'lg:grid-cols-[80px_minmax(0,1fr)]'
                : 'lg:grid-cols-[240px_minmax(0,1fr)]'
            )}
          >
            <div className="relative hidden lg:block">
              <div
                className={cn(
                  'fixed bottom-0 top-0 z-20 flex flex-col border-r bg-background shadow-sm',
                  isSidebarCollapsed ? 'w-[80px]' : 'w-[240px]'
                )}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -right-3 top-[60px] z-50 h-6 w-6 rounded-full border bg-background shadow-sm hover:bg-muted"
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  aria-label={isSidebarCollapsed ? '展开侧栏' : '收起侧栏'}
                >
                  {isSidebarCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronLeft className="h-3.5 w-3.5" />
                  )}
                </Button>

                <div className="flex min-h-0 flex-1 flex-col px-3 py-4">
                  <div className="mb-4">
                    {renderLogo(isSidebarCollapsed)}
                  </div>
                  <Separator className="mb-4" />
                  <ScrollArea className="min-h-0 flex-1">
                    <div className="px-3">
                      {!isSidebarCollapsed && (
                        <h2 className="mb-3 px-2 text-lg font-semibold tracking-tight">
                          管理菜单
                        </h2>
                      )}
                      {renderMenuItems(false)}
                    </div>
                  </ScrollArea>
                </div>

                <div className="p-3">
                  {renderUserMenu({
                    align: isSidebarCollapsed ? 'center' : 'start',
                    side: 'top',
                  })}
                </div>
              </div>
            </div>

            <main className="relative min-w-0 lg:h-full">
              <div className="min-h-[calc(100svh-3.5rem)] overflow-auto lg:h-full">
                <div className="p-3 sm:p-4 lg:p-6">
                  {children}
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
