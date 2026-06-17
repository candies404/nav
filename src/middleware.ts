import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`

  requestHeaders.set('x-navsphere-pathname', callbackUrl || '/admin')

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: ['/admin/:path*'],
}
