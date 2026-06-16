import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
    deleteManagedResources,
    listManagedResources,
    MISSING_BLOB_CONFIG_MESSAGE,
    uploadManagedResource,
} from '@/lib/resource-storage'

export const runtime = 'edge'

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user) {
            return new Response('Unauthorized', { status: 401 })
        }

        return NextResponse.json(await listManagedResources())
    } catch (error) {
        console.error('Failed to fetch resources:', error)
        return handleResourceError(error, 'Failed to fetch resources')
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) {
            return new Response('Unauthorized', { status: 401 })
        }

        const { image, folder = 'assets', prefix = 'img' } = await request.json()
        return NextResponse.json(await uploadManagedResource({ image, folder, prefix }))
    } catch (error) {
        console.error('Failed to upload resource:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to upload resource' },
            { status: isBadResourceRequest(error) ? 400 : 500 }
        )
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) {
            return new Response('Unauthorized', { status: 401 })
        }

        const { resourceHashes } = await request.json()

        if (!Array.isArray(resourceHashes) || resourceHashes.length === 0) {
            return NextResponse.json({ error: 'Invalid resource hashes' }, { status: 400 })
        }

        return NextResponse.json(await deleteManagedResources(resourceHashes))
    } catch (error) {
        console.error('Failed to delete resources:', error)
        return handleResourceError(error, 'Failed to delete resources')
    }
}

function handleResourceError(error: unknown, fallbackMessage: string) {
    const message = error instanceof Error ? error.message : fallbackMessage
    const status = message === MISSING_BLOB_CONFIG_MESSAGE ? 400 : 500

    return NextResponse.json({ error: message }, { status })
}

function isBadResourceRequest(error: unknown) {
    return error instanceof Error &&
        (error.message === MISSING_BLOB_CONFIG_MESSAGE || error.message === 'Invalid image payload')
}
