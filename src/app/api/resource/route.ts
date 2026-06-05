import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { commitFile, getFileContent, saveAsset } from '@/lib/storage'
import type { ResourceMetadata } from '@/types/resource-metadata'

export const runtime = 'edge'

const RESOURCE_METADATA_PATH = 'src/navsphere/content/resource-metadata.json'

function ensureResourceMetadata(data: ResourceMetadata | Record<string, never>): ResourceMetadata {
    if ('metadata' in data && Array.isArray(data.metadata)) {
        return data as ResourceMetadata
    }

    return {
        commit: '',
        generated: new Date().toISOString(),
        metadata: []
    }
}

export async function GET() {
    try {
        const data = ensureResourceMetadata(await getFileContent(RESOURCE_METADATA_PATH) as ResourceMetadata)
        return NextResponse.json(data)
    } catch (error) {
        console.error('Failed to fetch resource metadata:', error)
        return NextResponse.json({ error: 'Failed to fetch resource metadata' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) {
            return new Response('Unauthorized', { status: 401 })
        }

        const { image, folder = 'assets', prefix = 'img' } = await request.json()
        if (typeof image !== 'string' || !image.includes(',')) {
            return NextResponse.json({ error: 'Invalid image payload' }, { status: 400 })
        }

        const base64Data = image.split(',')[1]
        const binaryData = Uint8Array.from(atob(base64Data), char => char.charCodeAt(0))
        const uploadResult = await saveAsset(binaryData, 'png', prefix, folder)

        const metadata = ensureResourceMetadata(await getFileContent(RESOURCE_METADATA_PATH) as ResourceMetadata)
        metadata.generated = new Date().toISOString()
        metadata.metadata.unshift({
            commit: uploadResult.hash,
            hash: uploadResult.hash,
            path: uploadResult.path
        })

        await commitFile(
            RESOURCE_METADATA_PATH,
            JSON.stringify(metadata, null, 2),
            'Update resource metadata'
        )

        return NextResponse.json({ success: true, imageUrl: uploadResult.path })
    } catch (error) {
        console.error('Failed to save resource metadata:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to save resource metadata' },
            { status: 500 }
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

        const metadata = ensureResourceMetadata(await getFileContent(RESOURCE_METADATA_PATH) as ResourceMetadata)
        const originalCount = metadata.metadata.length
        metadata.metadata = metadata.metadata.filter(item => !resourceHashes.includes(item.hash))
        metadata.generated = new Date().toISOString()
        const deletedCount = originalCount - metadata.metadata.length

        await commitFile(
            RESOURCE_METADATA_PATH,
            JSON.stringify(metadata, null, 2),
            `Delete ${deletedCount} resource(s)`
        )

        return NextResponse.json({
            success: true,
            deletedCount,
            message: `成功删除 ${deletedCount} 个资源`
        })
    } catch (error) {
        console.error('Failed to delete resources:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete resources' },
            { status: 500 }
        )
    }
}
