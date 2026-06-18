'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Icons } from '@/components/icons'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

async function fetchCsrfToken() {
  const response = await fetch('/api/auth/csrf', {
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error('Failed to fetch auth csrf token')
  }

  const data = await response.json() as { csrfToken?: string }
  if (!data.csrfToken) {
    throw new Error('Auth csrf token is missing')
  }

  return data.csrfToken
}

const ADMIN_CALLBACK_STORAGE_KEY = 'navsphereAdminCallbackUrl'

function isAuthErrorUrl(value?: string | null) {
  if (!value) return true

  try {
    const url = new URL(value, window.location.origin)
    return url.searchParams.has('error') || url.searchParams.has('csrf')
  } catch {
    return true
  }
}

function getSafeCallbackUrl(value: string | null) {
  if (!value || !value.startsWith('/admin') || value.startsWith('//')) {
    return null
  }

  return value
}

function getStoredCallbackUrl() {
  try {
    return getSafeCallbackUrl(window.sessionStorage.getItem(ADMIN_CALLBACK_STORAGE_KEY))
  } catch {
    return null
  }
}

function persistCallbackUrl(value: string) {
  try {
    window.sessionStorage.setItem(ADMIN_CALLBACK_STORAGE_KEY, value)
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

function clearStoredCallbackUrl() {
  try {
    window.sessionStorage.removeItem(ADMIN_CALLBACK_STORAGE_KEY)
  } catch {
    // Ignore storage cleanup failures; navigation can still proceed.
  }
}

function SignInContent() {
  const searchParams = useSearchParams()
  const queryCallbackUrl = getSafeCallbackUrl(searchParams?.get('callbackUrl') || null)
  const [callbackUrl, setCallbackUrl] = useState(queryCallbackUrl || '/admin')
  const [password, setPassword] = useState('')
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const nextCallbackUrl = queryCallbackUrl || getStoredCallbackUrl() || '/admin'

    setCallbackUrl(nextCallbackUrl)
    persistCallbackUrl(nextCallbackUrl)
  }, [queryCallbackUrl])

  useEffect(() => {
    let isActive = true

    fetchCsrfToken()
      .then((token) => {
        if (isActive) setCsrfToken(token)
      })
      .catch((tokenError) => {
        console.error('预加载登录令牌失败:', tokenError)
      })

    return () => {
      isActive = false
    }
  }, [])

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const token = csrfToken || await fetchCsrfToken()
      setCsrfToken(token)

      const response = await fetch(`/api/auth/callback/credentials?${new URLSearchParams({ callbackUrl })}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Auth-Return-Redirect': '1',
        },
        body: new URLSearchParams({
          csrfToken: token,
          password,
          callbackUrl,
        }),
      })

      const result = await response.json() as { url?: string | null }

      if (!response.ok || isAuthErrorUrl(result.url)) {
        setError('管理密码不正确')
        setCsrfToken(null)
        setIsLoading(false)
        return
      }

      clearStoredCallbackUrl()
      window.location.replace(callbackUrl)
    } catch (error) {
      console.error('登录失败:', error)
      setError('登录失败，请稍后重试')
      setIsLoading(false)
    }
  }

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
            <form onSubmit={handleSignIn}>
              <CardContent className="grid gap-4">
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="输入管理密码"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isLoading}
                  required
                />
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !password}
                >
                  {isLoading ? (
                    <>
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                      登录中...
                    </>
                  ) : (
                    '登录'
                  )}
                </Button>
              </CardContent>
            </form>
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

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInContent />
    </Suspense>
  )
}
