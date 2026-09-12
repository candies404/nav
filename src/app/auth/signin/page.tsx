import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react'
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
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-zinc-950">
      <div className="pointer-events-none absolute inset-0 lg:hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-200/35 blur-3xl dark:bg-blue-950/30" />
        <div className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-slate-200/70 blur-3xl dark:bg-slate-900/60" />
      </div>

      <div className="relative grid min-h-screen w-full grid-cols-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
        <aside className="hidden min-h-screen border-r border-slate-800 bg-[#0c1424] px-12 py-10 text-white lg:flex lg:flex-col xl:px-16 xl:py-12">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-white">
              <Image
                src="/assets/images/alogo.webp"
                alt="NavSphere"
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold leading-tight tracking-tight text-white">
                NavSphere
              </span>
              <span className="text-xs text-slate-500">管理后台</span>
            </div>
          </div>

          <div className="my-auto max-w-md py-16">
            <p className="mb-4 text-xs font-medium tracking-[0.18em] text-slate-500">
              NAVSPHERE ADMIN
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 xl:text-4xl">
              管理控制台
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-400">
              管理导航内容、站点配置与图片资源。
            </p>
            <div className="mt-10 border-l border-slate-700 pl-4 text-sm leading-6 text-slate-500">
              仅限授权管理员使用
            </div>
          </div>

          <p className="text-xs text-slate-600">
            © 2026 NavSphere
          </p>
        </aside>

        <main className="relative flex min-h-screen min-w-0 items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
          <Link
            href="/"
            className="absolute left-4 top-5 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white sm:left-8 sm:top-7 lg:left-auto lg:right-10"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>

          <div className="min-w-0 w-full max-w-[440px]">
            <div className="mb-7 flex items-center justify-center gap-3 lg:hidden">
              <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10">
                <Image
                  src="/assets/images/alogo.webp"
                  alt="NavSphere"
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </div>
              <div>
                <p className="font-semibold leading-tight tracking-tight">NavSphere</p>
                <p className="text-xs text-muted-foreground">管理控制台</p>
              </div>
            </div>

            <Card className="min-w-0 overflow-hidden rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/85 dark:shadow-black/30">
              <CardHeader className="space-y-4 px-6 pb-5 pt-7 sm:px-8 sm:pt-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/15 dark:bg-white dark:text-slate-950">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
                    欢迎回来
                  </CardTitle>
                  <CardDescription className="leading-6">
                    输入管理密码，继续访问 NavSphere 管理后台。
                  </CardDescription>
                </div>
              </CardHeader>
              <SignInForm
                initialCallbackUrl={queryCallbackUrl || '/admin'}
                restoreStoredCallbackUrl={!queryCallbackUrl}
              />
              <CardFooter className="border-t border-slate-100 px-6 py-4 sm:px-8 dark:border-white/[0.06]">
                <div className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  密码仅在服务端校验，不会写入浏览器存储。
                </div>
              </CardFooter>
            </Card>

            <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-600">
              仅限授权管理员访问
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
