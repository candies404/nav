import { ADMIN_USER_ID, SESSION_MAX_AGE_SECONDS, getAdminPassword, getAuthSecret } from '@/lib/auth-config'
import { clearAdminLoginAttempts, reserveAdminLoginAttempt } from '@/lib/admin-login-rate-limit'
import NextAuth from 'next-auth'
import { CredentialsSignin } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { NextAuthConfig } from 'next-auth'

async function comparePassword(input: string, expected: string) {
  const encoder = new TextEncoder()
  const [inputDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(input)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const inputBytes = new Uint8Array(inputDigest)
  const expectedBytes = new Uint8Array(expectedDigest)
  let difference = 0
  for (let index = 0; index < inputBytes.length; index += 1) {
    difference |= inputBytes[index] ^ expectedBytes[index]
  }
  return difference === 0
}

class AdminRateLimitError extends CredentialsSignin {
  code = 'rate_limited'
}

class AdminConfigurationError extends CredentialsSignin {
  code = 'configuration'
}

class AdminProtectionUnavailableError extends CredentialsSignin {
  code = 'protection_unavailable'
}

const config = {
  providers: [
    CredentialsProvider({
      name: 'Admin Password',
      credentials: {
        password: {
          label: 'Admin Password',
          type: 'password',
        },
      },
      async authorize(credentials, request) {
        let adminPassword: string
        try {
          adminPassword = getAdminPassword()
        } catch (error) {
          console.error('Admin authentication configuration is invalid:', error)
          throw new AdminConfigurationError()
        }

        let reservation
        try {
          reservation = await reserveAdminLoginAttempt(request)
        } catch (error) {
          console.error('Admin login protection is unavailable:', error)
          throw new AdminProtectionUnavailableError()
        }

        if (!reservation.allowed) {
          console.warn(`Admin login rate limit reached; retry after ${reservation.retryAfterSeconds}s`)
          throw new AdminRateLimitError()
        }

        const password = typeof credentials?.password === 'string'
          ? credentials.password
          : ''

        if (password.length > 256 || !await comparePassword(password, adminPassword)) {
          return null
        }

        try {
          await clearAdminLoginAttempts(request)
        } catch (error) {
          console.error('Failed to clear admin login protection state:', error)
          throw new AdminProtectionUnavailableError()
        }

        return {
          id: ADMIN_USER_ID,
          name: 'Admin',
          email: 'admin@navsphere.local',
        }
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  secret: getAuthSecret(),
  trustHost: true,
} satisfies NextAuthConfig

const handler = NextAuth(config)

export const auth = handler.auth
export const signIn = handler.signIn
export const { handlers: { GET, POST } } = handler
