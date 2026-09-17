export const DEFAULT_ADMIN_PASSWORD = '123456'
export const ADMIN_USER_ID = 'admin'
export const SESSION_MAX_AGE_SECONDS = 15 * 60

const MIN_AUTH_SECRET_LENGTH = 32
const MIN_ADMIN_PASSWORD_LENGTH = 12
const MAX_ADMIN_PASSWORD_LENGTH = 256
const PLACEHOLDER_AUTH_SECRETS = new Set([
  'your-random-auth-secret',
  'your-secret-key',
  'generate-a-32-byte-random-secret-before-deploy',
  'changeme',
  'change-me',
])
const INSECURE_ADMIN_PASSWORDS = new Set([
  DEFAULT_ADMIN_PASSWORD,
  'password',
  'admin',
  'admin123',
  'changeme',
  'change-me',
  'change-this-admin-password',
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

export type AdminPasswordStatus = {
  configured: boolean
  secure: boolean
  blocked: boolean
  message?: string
}

export function getAdminPasswordStatus(): AdminPasswordStatus {
  const configuredPassword = process.env.ADMIN_PASSWORD
  const configured = Boolean(configuredPassword)
  const candidate = configuredPassword || DEFAULT_ADMIN_PASSWORD
  const weak = (
    candidate.trim().length < MIN_ADMIN_PASSWORD_LENGTH
    || candidate.length > MAX_ADMIN_PASSWORD_LENGTH
    || INSECURE_ADMIN_PASSWORDS.has(candidate.trim().toLocaleLowerCase())
  )
  const production = process.env.NODE_ENV === 'production'

  if (production && (!configured || weak)) {
    return {
      configured,
      secure: false,
      blocked: true,
      message: `管理员登录尚未安全配置。请设置 ${MIN_ADMIN_PASSWORD_LENGTH}–${MAX_ADMIN_PASSWORD_LENGTH} 位且非默认值的 ADMIN_PASSWORD 后重新部署。`,
    }
  }

  if (!configured || weak) {
    return {
      configured,
      secure: false,
      blocked: false,
      message: `当前使用仅供本地开发的弱管理密码；部署前必须设置 ${MIN_ADMIN_PASSWORD_LENGTH}–${MAX_ADMIN_PASSWORD_LENGTH} 位的非默认 ADMIN_PASSWORD。`,
    }
  }

  return { configured: true, secure: true, blocked: false }
}

export function getAdminPassword() {
  const status = getAdminPasswordStatus()
  if (status.blocked) throw new Error(status.message)
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
