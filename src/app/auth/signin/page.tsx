import Image from 'next/image'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SignInForm } from './sign-in-form'

type SignInPageProps = {
  searchParams: Promise<{
    callbackUrl?: string | string[]
  }>
}

function getSafeCallbackUrl(value: string | string[] | undefined) {
  const callbackUrl = Array.isArray(value) ? value[0] : value

  if (!callbackUrl || !callbackUrl.startsWith('/admin') || callbackUrl.startsWith('//')) {
    return null
  }

  return callbackUrl
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams
  const queryCallbackUrl = getSafeCallbackUrl(params.callbackUrl)

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-8 overflow-hidden rounded-md">
              <Image
                src="/assets/images/alogo.webp"
                alt="Logo"
                fill
                sizes="32px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold leading-none tracking-tight text-white">
                NavSphere
              </span>
            </div>
          </div>
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;这是一个专注于网站收藏、分类和管理的导航平台。&rdquo;
            </p>
            <footer className="text-sm">NavSphere Team</footer>
          </blockquote>
        </div>
      </div>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto flex h-full w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-center text-2xl">
                登录管理后台
              </CardTitle>
              <CardDescription className="text-center">
                使用 ADMIN_PASSWORD 配置的管理密码访问后台
              </CardDescription>
            </CardHeader>
            <SignInForm
              initialCallbackUrl={queryCallbackUrl || '/admin'}
              restoreStoredCallbackUrl={!queryCallbackUrl}
            />
            <CardFooter className="flex flex-wrap items-center justify-center gap-2">
              <div className="text-sm text-muted-foreground">
                管理密码来自服务端环境变量，不会暴露给浏览器。
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
