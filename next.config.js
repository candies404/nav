/** @type {import('next').NextConfig} */
const DEFAULT_SERVER_ACTION_ALLOWED_ORIGINS = ['localhost', '127.0.0.1']

function normalizeAllowedOrigin(value) {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    return new URL(trimmed).host
  } catch {
    return trimmed
  }
}

const serverActionAllowedOrigins = Array.from(new Set([
  ...DEFAULT_SERVER_ACTION_ALLOWED_ORIGINS,
  process.env.AUTH_URL,
  process.env.NEXTAUTH_URL,
  ...(process.env.SERVER_ACTION_ALLOWED_ORIGINS || '').split(','),
].map(normalizeAllowedOrigin).filter(Boolean)))

const nextConfig = {
  // Standalone output works well for containers and self-hosted Node runtimes.
  output: 'standalone',

  // Don't fail build on ESLint warnings
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    domains: [
      'dash.cloudflare.com',
      'www.google.com',
      'ph-static.imgix.net',
      'app.leonardo.ai'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*'
      },
      {
        source: '/auth/:path*',
        destination: '/auth/:path*'
      }
    ]
  },
  experimental: {
    serverActions: {
      allowedOrigins: serverActionAllowedOrigins
    },
    optimizePackageImports: ['lucide-react', 'date-fns', 'lodash']
  }
}

module.exports = nextConfig
