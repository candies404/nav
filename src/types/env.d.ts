declare namespace NodeJS {
  interface ProcessEnv {
    NEXTAUTH_URL: string
    AUTH_SECRET: string
    NEXTAUTH_SECRET?: string
    ADMIN_PASSWORD: string
    UPSTASH_REDIS_REST_URL: string
    UPSTASH_REDIS_REST_TOKEN: string
    UPSTASH_REDIS_KEY_PREFIX?: string
  }
} 
