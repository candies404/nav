import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getAuthSecret } from '@/lib/auth-config'

export async function middleware(request: NextRequest) {
  const callbackUrl = getAdminCallbackUrl(request)
  const secureCookie = request.cookies.getAll().some(cookie =>
    cookie.name === '__Secure-authjs.session-token'
    || cookie.name.startsWith('__Secure-authjs.session-token.')
  )
  const sessionToken = await getToken({
    req: request,
    secret: getAuthSecret(),
    secureCookie,
  })

  if (!sessionToken) {
    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('callbackUrl', callbackUrl)
    return NextResponse.redirect(signInUrl)
  }

  const requestHeaders = new Headers(request.headers)

  requestHeaders.set('x-navsphere-pathname', callbackUrl || '/admin')

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

function getAdminCallbackUrl(request: NextRequest) {
  const searchParams = new URLSearchParams(request.nextUrl.searchParams)
  searchParams.delete('_rsc')
  const queryString = searchParams.toString()
  return `${request.nextUrl.pathname}${queryString ? `?${queryString}` : ''}`
}

export const config = {
  matcher: ['/admin/:path*'],
}
