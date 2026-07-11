import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  addNavigationSite,
  batchUpdateNavigationSites,
  NavigationSiteMutationError,
  reorderNavigationSites,
  type AddSiteInput,
  type BatchSiteOperation,
} from '@/lib/navigation-site-mutations'
import { getStorageErrorMessage } from '@/lib/storage'

export const runtime = 'edge'

export async function POST(request: Request) {
  return withAuthenticatedMutation(async () => {
    const input = await readJsonObject(request) as AddSiteInput
    return addNavigationSite(input)
  })
}

export async function PATCH(request: Request) {
  return withAuthenticatedMutation(async () => {
    const input = await readJsonObject(request) as {
      siteIds: string[]
      operation: BatchSiteOperation
      targetCategoryId?: string
      targetSubCategoryId?: string | null
    }
    const allowedOperations: BatchSiteOperation[] = [
      'delete', 'enable', 'disable', 'private', 'public', 'move',
    ]
    if (!allowedOperations.includes(input.operation)) {
      throw new NavigationSiteMutationError('Invalid batch operation')
    }
    return batchUpdateNavigationSites(input)
  })
}

export async function PUT(request: Request) {
  return withAuthenticatedMutation(async () => {
    const input = await readJsonObject(request) as {
      categoryId: string
      subCategoryId?: string | null
      orderedSiteIds: string[]
    }
    return reorderNavigationSites(input)
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
