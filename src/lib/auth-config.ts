export const DEFAULT_ADMIN_PASSWORD = '123456'

const LOCAL_AUTH_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

function isLocalAuthUrl(value?: string) {
  if (!value) return false

  try {
    const { hostname } = new URL(value)
    return LOCAL_AUTH_HOSTS.has(hostname)
  } catch {
    return false
  }
}

function clearLocalProductionAuthUrl(name: 'AUTH_URL' | 'NEXTAUTH_URL') {
  if (process.env.NODE_ENV !== 'production') return

  if (isLocalAuthUrl(process.env[name])) {
    // trustHost lets Auth.js infer the current public host from the request.
    delete process.env[name]
  }
}

export function sanitizeAuthUrlEnv() {
  clearLocalProductionAuthUrl('AUTH_URL')
  clearLocalProductionAuthUrl('NEXTAUTH_URL')
}

// Run before Auth.js initializes so copied local URLs do not leak into production callbacks.
sanitizeAuthUrlEnv()

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD
}

export function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || getAdminPassword()
}
