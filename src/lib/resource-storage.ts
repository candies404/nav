import {
  deleteBlobAssets,
  getFileContent,
  isBlobStorageConfigured,
  listBlobAssets,
  saveAsset,
} from '@/lib/storage'
import type { NavigationData } from '@/types/navigation'
import type { SiteConfig } from '@/types/site'

export const MISSING_BLOB_CONFIG_MESSAGE =
  '图片资源库未配置写入能力。请在系统状态中检查图片资源配置。'

export type ManagedResource = {
  commit: string
  hash: string
  path: string
  pathname: string
  url: string
  downloadUrl: string
  size: number
  uploadedAt: string
}

export type ResourceReference = {
  type: string
  location: string
  title?: string
}

export type ResourceReferenceMap = Record<string, ResourceReference[]>

type ManagedResourceList = {
  commit: string
  generated: string
  source: 'blob'
  storage: 'blob'
  metadata: ManagedResource[]
}

export type ManagedResourceKind = 'all' | 'manual' | 'cached'

export type ManagedResourcePage = ManagedResourceList & {
  page: number
  pageSize: number
  total: number
  filteredTotal: number
  totalPages: number
  manualCount: number
  cachedCount: number
  query: string
  kind: ManagedResourceKind
}

const RESOURCE_LIST_CACHE_TTL_MS = getPositiveInteger(
  process.env.NAVSPHERE_ADMIN_RESOURCE_CACHE_TTL_MS,
  60_000
)
const globalResourceCache = globalThis as typeof globalThis & {
  __navsphereManagedResourceCache?: {
    value: ManagedResourceList
    expiresAt: number
  }
}

export function hasResourceStorage() {
  return isBlobStorageConfigured()
}

export function assertResourceStorageConfigured() {
  if (!hasResourceStorage()) {
    throw new Error(MISSING_BLOB_CONFIG_MESSAGE)
  }
}

export async function listManagedResources(options: { fresh?: boolean } = {}) {
  assertResourceStorageConfigured()

  const cached = globalResourceCache.__navsphereManagedResourceCache
  if (!options.fresh && cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const blobs = await listBlobAssets()
  const result: ManagedResourceList = {
    commit: '',
    generated: new Date().toISOString(),
    source: 'blob',
    storage: 'blob',
    metadata: blobs.map<ManagedResource>(blob => ({
      commit: blob.pathname,
      hash: blob.pathname,
      path: blob.url,
      pathname: blob.pathname,
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
    })),
  }

  globalResourceCache.__navsphereManagedResourceCache = {
    value: result,
    expiresAt: Date.now() + RESOURCE_LIST_CACHE_TTL_MS,
  }

  return result
}

export async function getManagedResourcePage(options: {
  fresh?: boolean
  page?: number
  pageSize?: number
  query?: string | null
  kind?: string | null
} = {}): Promise<ManagedResourcePage> {
  const resources = await listManagedResources({ fresh: options.fresh })
  const query = options.query?.trim().toLocaleLowerCase() || ''
  const kind: ManagedResourceKind = options.kind === 'manual' || options.kind === 'cached'
    ? options.kind
    : 'all'
  const manualCount = resources.metadata.filter(resource => !isAutoCachedResource(resource)).length
  const cachedCount = resources.metadata.length - manualCount
  const filtered = resources.metadata.filter(resource => {
    const matchesQuery = !query || [resource.pathname, resource.path, resource.url]
      .some(value => value.toLocaleLowerCase().includes(query))
    const isCached = isAutoCachedResource(resource)
    const matchesKind = kind === 'all'
      || (kind === 'cached' && isCached)
      || (kind === 'manual' && !isCached)
    return matchesQuery && matchesKind
  })
  const pageSize = clampInteger(options.pageSize, 40, 10, 100)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = clampInteger(options.page, 1, 1, totalPages)
  const startIndex = (page - 1) * pageSize

  return {
    ...resources,
    metadata: filtered.slice(startIndex, startIndex + pageSize),
    page,
    pageSize,
    total: resources.metadata.length,
    filteredTotal: filtered.length,
    totalPages,
    manualCount,
    cachedCount,
    query,
    kind,
  }
}

export async function uploadManagedResource(input: {
  image: string
  folder?: string
  prefix?: string
}) {
  assertResourceStorageConfigured()

  if (typeof input.image !== 'string' || !input.image.includes(',')) {
    throw new Error('图片内容无效')
  }

  const [header, base64Data] = input.image.split(',', 2)
  const binaryData = Uint8Array.from(atob(base64Data), char => char.charCodeAt(0))
  const uploadResult = await saveAsset(
    binaryData,
    getExtensionFromDataUrlHeader(header),
    input.prefix || 'img',
    input.folder || 'assets'
  )
  invalidateManagedResourceCache()

  return {
    success: true,
    imageUrl: uploadResult.path,
    hash: uploadResult.hash,
  }
}

export async function deleteManagedResources(resourceHashes: string[]) {
  assertResourceStorageConfigured()

  const deletedBlobCount = await deleteBlobAssets(resourceHashes)
  invalidateManagedResourceCache()
  return {
    success: true,
    deletedCount: deletedBlobCount,
    deletedBlobCount,
    message: `成功删除 ${deletedBlobCount} 个图片资源`,
  }
}

function invalidateManagedResourceCache() {
  delete globalResourceCache.__navsphereManagedResourceCache
}

function isAutoCachedResource(resource: ManagedResource) {
  return resource.pathname.startsWith('favicons/') || resource.pathname.startsWith('favicons_')
}

function clampInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const normalized = Number.isFinite(value) ? Math.floor(value as number) : fallback
  return Math.min(maximum, Math.max(minimum, normalized))
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

export async function checkManagedResourceReferences(resourcePaths: string[]) {
  const [navigationData, siteData] = await Promise.all([
    getFileContent('src/navsphere/content/navigation.json') as Promise<NavigationData>,
    getFileContent('src/navsphere/content/site.json') as Promise<SiteConfig>,
  ])
  const requestedPaths = new Set(resourcePaths)
  const references: ResourceReferenceMap = Object.fromEntries(
    [...requestedPaths].map(resourcePath => [resourcePath, []])
  )

  const addReference = (resourcePath: string | undefined, reference: ResourceReference) => {
    if (!resourcePath || !requestedPaths.has(resourcePath)) return
    references[resourcePath].push(reference)
  }

  for (const navItem of navigationData?.navigationItems || []) {
    addReference(navItem.icon, {
      type: 'navigation',
      location: `导航项: ${navItem.title}`,
      title: navItem.title,
    })

    for (const subItem of navItem.items || []) {
      addReference(subItem.icon, {
        type: 'navigation',
        location: `导航子项: ${navItem.title} > ${subItem.title}`,
        title: subItem.title,
      })
    }

    for (const subCategory of navItem.subCategories || []) {
      addReference(subCategory.icon, {
        type: 'navigation',
        location: `导航分类: ${navItem.title} > ${subCategory.title}`,
        title: subCategory.title,
      })

      for (const item of subCategory.items || []) {
        addReference(item.icon, {
          type: 'navigation',
          location: `导航项: ${navItem.title} > ${subCategory.title} > ${item.title}`,
          title: item.title,
        })
      }
    }
  }

  if (siteData?.appearance) {
    addReference(siteData.appearance.logo, {
      type: 'site',
      location: '站点Logo',
      title: '站点Logo',
    })
    addReference(siteData.appearance.favicon, {
      type: 'site',
      location: '站点图标',
      title: '站点图标',
    })
  }

  return references
}

function getExtensionFromDataUrlHeader(header: string) {
  const contentType = header.match(/^data:([^;]+);base64$/)?.[1]?.toLowerCase()

  if (contentType === 'image/jpeg') return 'jpg'
  if (contentType === 'image/webp') return 'webp'
  if (contentType === 'image/gif') return 'gif'
  if (contentType === 'image/svg+xml') return 'svg'
  if (contentType === 'image/x-icon' || contentType === 'image/vnd.microsoft.icon') return 'ico'

  return 'png'
}
