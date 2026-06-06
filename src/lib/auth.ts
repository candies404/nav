import { getAdminPassword, getAuthSecret } from '@/lib/auth-config'
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { NextAuthConfig } from 'next-auth'

const SESSION_MAX_AGE_SECONDS = 15 * 60

// Keep the comparison work predictable for equal-length inputs; the password
// comes from ADMIN_PASSWORD, falling back to the local setup default.
function comparePassword(input: string, expected: string) {
  if (input.length !== expected.length) return false

  let diff = 0
  for (let index = 0; index < input.length; index += 1) {
    diff |= input.charCodeAt(index) ^ expected.charCodeAt(index)
  }

  return diff === 0
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
      async authorize(credentials) {
        const adminPassword = getAdminPassword()
        const password = typeof credentials?.password === 'string'
          ? credentials.password
          : ''

        if (!comparePassword(password, adminPassword)) {
          return null
        }

        return {
          id: 'admin',
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
export const { handlers: { GET, POST } } = handler
