import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  deleteNavigationSites,
  NavigationSiteMutationError,
  updateNavigationSite,
  type SitePatch,
  type SiteTarget,
} from '@/lib/navigation-site-mutations'
import { getStorageErrorMessage } from '@/lib/storage'

export const runtime = 'edge'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  return withAuthenticatedMutation(async () => {
    const { siteId } = await params
    const update = await readJsonObject(request) as SitePatch & Partial<SiteTarget>
    return updateNavigationSite(siteId, update)
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  return withAuthenticatedMutation(async () => {
    const { siteId } = await params
    return deleteNavigationSites([siteId])
  })
}

async function withAuthenticatedMutation(
  operation: () => Promise<Record<string, unknown>>
) {
  try {
    const session = await auth()
    if (!session?.user) return new Response('Unauthorized', { status: 401 })
    return NextResponse.json({ success: true, ...await operation() })
  } catch (error) {
    const status = error instanceof NavigationSiteMutationError ? error.status : 500
    const message = error instanceof Error
      ? error.message
      : getStorageErrorMessage(error, 'Site operation failed')
    if (status >= 500) console.error('Site operation failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}

async function readJsonObject(request: Request) {
  try {
    const input = await request.json()
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new NavigationSiteMutationError('Invalid JSON body')
    }
    return input
  } catch (error) {
    if (error instanceof NavigationSiteMutationError) throw error
    throw new NavigationSiteMutationError('Invalid JSON body')
  }
}
