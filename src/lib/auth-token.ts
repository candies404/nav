import { getToken } from 'next-auth/jwt'
import { getAuthSecret } from '@/lib/auth-config'

type RequestLike = Request | {
  headers: Headers | Record<string, string>
}

const AUTH_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
]

function getHeaderValue(headers: RequestLike['headers'], name: string) {
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name)
  }

  const record = headers as Record<string, string>
  return record[name] || record[name.toLowerCase()] || null
}

function hasAuthSessionCookie(request: RequestLike) {
  const cookie = getHeaderValue(request.headers, 'cookie')
  if (!cookie) return false

  // Skip the relatively expensive JWT parser for normal anonymous traffic.
  return AUTH_COOKIE_NAMES.some((name) => cookie.includes(`${name}=`) || cookie.includes(`${name}.`))
}

export async function getSessionToken(request: RequestLike) {
  const secret = getAuthSecret()
  if (!secret) return null
  if (!hasAuthSessionCookie(request)) return null

  try {
    return await getToken({
      req: request,
      secret,
    })
  } catch (error) {
    console.error('Failed to read auth token:', error)
    return null
  }
}

export async function isAuthenticatedRequest(request: RequestLike) {
  const token = await getSessionToken(request)
  return Boolean(token?.sub)
}
