declare namespace NodeJS {
  interface ProcessEnv {
    NEXTAUTH_URL: string
    AUTH_SECRET?: string
    NEXTAUTH_SECRET?: string
    ADMIN_PASSWORD?: string
    KV_REST_API_URL?: string
    KV_REST_API_TOKEN?: string
    UPSTASH_REDIS_KEY_PREFIX?: string
  }
} 
