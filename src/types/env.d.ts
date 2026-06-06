declare namespace NodeJS {
  interface ProcessEnv {
    AUTH_URL?: string
    NEXTAUTH_URL?: string
    AUTH_SECRET?: string
    NEXTAUTH_SECRET?: string
    ADMIN_PASSWORD?: string
    KV_REST_API_URL?: string
    KV_REST_API_TOKEN?: string
    UPSTASH_REDIS_KEY_PREFIX?: string
    SERVER_ACTION_ALLOWED_ORIGINS?: string
  }
} 
