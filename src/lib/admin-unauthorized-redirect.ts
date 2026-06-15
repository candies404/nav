'use client'

let isRedirecting = false

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function shouldRedirectForUnauthorized(input: RequestInfo | URL, response: Response) {
  if (response.status !== 401 || typeof window === 'undefined') return false
  if (!window.location.pathname.startsWith('/admin')) return false

  try {
    const requestUrl = new URL(getRequestUrl(input), window.location.origin)
    return requestUrl.origin === window.location.origin
      && requestUrl.pathname.startsWith('/api/')
      && !requestUrl.pathname.startsWith('/api/auth/')
  } catch {
    return false
  }
}

function redirectToSignIn() {
  if (isRedirecting || typeof window === 'undefined') return

  isRedirecting = true
  const callbackUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const signInUrl = new URL('/auth/signin', window.location.origin)
  signInUrl.searchParams.set('callbackUrl', callbackUrl || '/admin')
  window.location.assign(signInUrl.toString())
}

export function installAdminUnauthorizedRedirect() {
  if (typeof window === 'undefined') return

  const marker = '__navsphereAdminFetchPatched'
  const originalMarker = '__navsphereOriginalFetch'
  const win = window as typeof window & {
    [marker]?: boolean
    [originalMarker]?: typeof window.fetch
  }

  if (win[marker]) return

  win[marker] = true
  win[originalMarker] = win.fetch.bind(window)

  win.fetch = async (input, init) => {
    const response = await win[originalMarker]!(input, init)

    if (shouldRedirectForUnauthorized(input, response)) {
      redirectToSignIn()
    }

    return response
  }
}
