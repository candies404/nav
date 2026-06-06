import { NextResponse } from 'next/server'
export const runtime = 'edge'

const startedAt = Date.now()

export async function GET() {
  return NextResponse.json({
    app: 'NavSphere',
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round((Date.now() - startedAt) / 1000),
  })
}
