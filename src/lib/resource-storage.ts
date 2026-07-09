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

export function hasResourceStorage() {
  return isBlobStorageConfigured()
}

export function assertResourceStorageConfigured() {
  if (!hasResourceStorage()) {
    throw new Error(MISSING_BLOB_CONFIG_MESSAGE)
  }
}

export async function listManagedResources() {
  assertResourceStorageConfigured()

  const blobs = await listBlobAssets()
  return {
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

  return {
    success: true,
    imageUrl: uploadResult.path,
    hash: uploadResult.hash,
  }
}

export async function deleteManagedResources(resourceHashes: string[]) {
  assertResourceStorageConfigured()

  const deletedBlobCount = await deleteBlobAssets(resourceHashes)
  return {
    success: true,
    deletedCount: deletedBlobCount,
    deletedBlobCount,
    message: `成功删除 ${deletedBlobCount} 个图片资源`,
  }
}

export async function checkManagedResourceReferences(resourcePaths: string[]) {
  const navigationData = await getFileContent('src/navsphere/content/navigation.json') as NavigationData
  const siteData = await getFileContent('src/navsphere/content/site.json') as SiteConfig
  const references: ResourceReferenceMap = {}

  for (const resourcePath of resourcePaths) {
    references[resourcePath] = []

    if (navigationData?.navigationItems) {
      for (const navItem of navigationData.navigationItems) {
        if (navItem.icon === resourcePath) {
          references[resourcePath].push({
            type: 'navigation',
            location: `导航项: ${navItem.title}`,
            title: navItem.title,
          })
        }

        if (navItem.items) {
          for (const subItem of navItem.items) {
            if (subItem.icon === resourcePath) {
              references[resourcePath].push({
                type: 'navigation',
                location: `导航子项: ${navItem.title} > ${subItem.title}`,
                title: subItem.title,
              })
            }
          }
        }

        if (navItem.subCategories) {
          for (const subCategory of navItem.subCategories) {
            if (subCategory.icon === resourcePath) {
              references[resourcePath].push({
                type: 'navigation',
                location: `导航分类: ${navItem.title} > ${subCategory.title}`,
                title: subCategory.title,
              })
            }

            if (subCategory.items) {
              for (const item of subCategory.items) {
                if (item.icon === resourcePath) {
                  references[resourcePath].push({
                    type: 'navigation',
                    location: `导航项: ${navItem.title} > ${subCategory.title} > ${item.title}`,
                    title: item.title,
                  })
                }
              }
            }
          }
        }
      }
    }

    if (siteData?.appearance) {
      if (siteData.appearance.logo === resourcePath) {
        references[resourcePath].push({
          type: 'site',
          location: '站点Logo',
          title: '站点Logo',
        })
      }

      if (siteData.appearance.favicon === resourcePath) {
        references[resourcePath].push({
          type: 'site',
          location: '站点图标',
          title: '站点图标',
        })
      }
    }
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
