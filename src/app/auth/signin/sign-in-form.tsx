'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardContent } from '@/components/ui/card'
import { authenticateAdmin } from './actions'

const ADMIN_CALLBACK_STORAGE_KEY = 'navsphereAdminCallbackUrl'

type SignInFormProps = {
  initialCallbackUrl: string
  restoreStoredCallbackUrl: boolean
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
}: SignInFormProps) {
  const [callbackUrl, setCallbackUrl] = useState(initialCallbackUrl)
  const [password, setPassword] = useState('')
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
      <CardContent className="grid gap-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="输入管理密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isLoading}
          required
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || !password}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              登录中...
            </>
          ) : (
            '登录'
          )}
        </Button>
      </CardContent>
    </form>
  )
}
