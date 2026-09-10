'use server'

import { AuthError } from 'next-auth'
import { signIn } from '@/lib/auth'

export type AdminSignInResult =
  | { ok: true; callbackUrl: string }
  | { ok: false; error: string }

function getSafeCallbackUrl(value: FormDataEntryValue | null) {
  if (
    typeof value !== 'string'
    || !value.startsWith('/admin')
    || value.startsWith('//')
  ) {
    return '/admin'
  }

  return value
}

export async function authenticateAdmin(formData: FormData): Promise<AdminSignInResult> {
  const password = formData.get('password')
  const callbackUrl = getSafeCallbackUrl(formData.get('callbackUrl'))

  if (typeof password !== 'string' || !password) {
    return { ok: false, error: '请输入管理密码' }
  }

  try {
    await signIn('credentials', {
      password,
      redirect: false,
      redirectTo: callbackUrl,
    })

    return { ok: true, callbackUrl }
  } catch (error) {
    if (error instanceof AuthError && error.type === 'CredentialsSignin') {
      return { ok: false, error: '管理密码不正确' }
    }

    console.error('Admin sign-in failed:', error)
    return { ok: false, error: '登录服务暂时不可用，请稍后重试' }
  }
}
