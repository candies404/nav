export const DEFAULT_ADMIN_PASSWORD = '123456'
export const ADMIN_USER_ID = 'admin'
export const SESSION_MAX_AGE_SECONDS = 15 * 60

const MIN_AUTH_SECRET_LENGTH = 32
const PLACEHOLDER_AUTH_SECRETS = new Set([
  'your-random-auth-secret',
  'your-secret-key',
  'generate-a-32-byte-random-secret-before-deploy',
  'changeme',
  'change-me',
])

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
  const configuredSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET

  if (configuredSecret) {
    if (process.env.NODE_ENV === 'production') {
      if (
        configuredSecret.length < MIN_AUTH_SECRET_LENGTH ||
        PLACEHOLDER_AUTH_SECRETS.has(configuredSecret)
      ) {
        throw new Error(
          `AUTH_SECRET must be a random value with at least ${MIN_AUTH_SECRET_LENGTH} characters in production`
        )
      }
    }

    return configuredSecret
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET or NEXTAUTH_SECRET is required in production')
  }

  return getAdminPassword()
}
