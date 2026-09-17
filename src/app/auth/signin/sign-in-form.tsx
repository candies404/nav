'use client'

import { FormEvent, useEffect, useState } from 'react'
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardContent } from '@/components/ui/card'
import { authenticateAdmin } from './actions'

const ADMIN_CALLBACK_STORAGE_KEY = 'navsphereAdminCallbackUrl'

type SignInFormProps = {
  initialCallbackUrl: string
  restoreStoredCallbackUrl: boolean
  configurationMessage?: string
  configurationBlocked?: boolean
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

export function SignInForm({
  initialCallbackUrl,
  restoreStoredCallbackUrl,
  configurationMessage,
  configurationBlocked = false,
}: SignInFormProps) {
  const [callbackUrl, setCallbackUrl] = useState(initialCallbackUrl)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const nextCallbackUrl = restoreStoredCallbackUrl
      ? getStoredCallbackUrl() || initialCallbackUrl
      : initialCallbackUrl

    setCallbackUrl(nextCallbackUrl)
    persistCallbackUrl(nextCallbackUrl)
  }, [initialCallbackUrl, restoreStoredCallbackUrl])

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)
    formData.set('callbackUrl', callbackUrl)

    try {
      const result = await authenticateAdmin(formData)

      if (!result.ok) {
        setError(result.error)
        setIsLoading(false)
        return
      }

      clearStoredCallbackUrl()
      window.location.replace(result.callbackUrl)
    } catch (signInError) {
      console.error('登录失败:', signInError)
      setError('登录失败，请稍后重试')
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSignIn}>
      <CardContent className="grid min-w-0 gap-5 px-6 pb-7 pt-1 sm:px-8 sm:pb-8">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        {configurationMessage && (
          <div
            id="signin-configuration"
            role={configurationBlocked ? 'alert' : 'status'}
            className={configurationBlocked
              ? 'flex items-start gap-2 rounded-xl border border-red-200/80 bg-red-50 px-3.5 py-3 text-sm leading-6 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
              : 'flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-3 text-sm leading-6 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'}
          >
            <ShieldAlert className="mt-1 h-4 w-4 shrink-0" />
            <span>{configurationMessage}</span>
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="admin-password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
            管理密码
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="admin-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="请输入管理密码"
              maxLength={256}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoading || configurationBlocked}
              className="h-12 min-w-0 rounded-xl border-slate-200 bg-slate-50/70 pl-10 pr-11 text-[15px] shadow-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-slate-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-slate-200 focus-visible:ring-offset-0 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:focus-visible:border-white/30 dark:focus-visible:bg-white/[0.06] dark:focus-visible:ring-white/10"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'signin-error' : configurationMessage ? 'signin-configuration' : 'password-hint'}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(visible => !visible)}
              disabled={isLoading || configurationBlocked}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:pointer-events-none dark:hover:bg-white/10 dark:hover:text-slate-200 dark:focus-visible:ring-white/20"
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p id="password-hint" className="text-xs text-slate-400 dark:text-slate-500">
            密码区分大小写
          </p>
        </div>
        {error && (
          <div
            id="signin-error"
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200/80 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Button
          type="submit"
          className="group h-12 w-full rounded-xl bg-slate-950 text-sm font-medium text-white shadow-lg shadow-slate-900/10 transition-all hover:bg-slate-800 hover:shadow-xl focus-visible:ring-slate-400 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          disabled={isLoading || !password || configurationBlocked}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              登录中...
            </>
          ) : (
            <>
              登录管理后台
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </CardContent>
    </form>
  )
}
