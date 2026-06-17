import {
  commitFile,
  deleteBlobAssets,
  deleteCachedFavicon,
  deleteStoredAssets,
  getFileContent,
} from '@/lib/storage'
import type { NavigationData, NavigationSubItem } from '@/types/navigation'

const NAVIGATION_PATH = 'src/navsphere/content/navigation.json'

type SiteRecord = {
  id: string
  href: string
  icon?: string
}

export async function saveNavigationData(data: NavigationData, message = 'Update navigation data') {
  const previousData = await getFileContent(NAVIGATION_PATH) as NavigationData

  await commitFile(
    NAVIGATION_PATH,
    JSON.stringify(data, null, 2),
    message
  )

  try {
    await cleanupRemovedSiteFavicons(previousData, data)
  } catch (error) {
    console.warn('Failed to cleanup removed site favicons:', error)
  }
}

async function cleanupRemovedSiteFavicons(previousData: NavigationData, nextData: NavigationData) {
  const nextSiteIds = new Set(collectSites(nextData).map(site => site.id))
  const retainedIcons = collectReferencedIcons(nextData)
  const removedSites = collectSites(previousData).filter(site => !nextSiteIds.has(site.id))
  const blobTargets = new Set<string>()
  const storedAssetIds = new Set<string>()
  const faviconCacheDeletes = new Map<string, string | undefined>()

  for (const site of removedSites) {
    const icon = site.icon?.trim()
    if (!icon || retainedIcons.has(icon)) continue

    const blobTarget = getCachedFaviconBlobTarget(icon)
    if (blobTarget) {
      blobTargets.add(blobTarget)
    }

    const storedAssetId = getCachedFaviconStoredAssetId(icon)
    if (storedAssetId) {
      storedAssetIds.add(storedAssetId)
    }

    if (blobTarget || storedAssetId) {
      const domain = getDomainFromUrl(site.href)
      if (domain) {
        faviconCacheDeletes.set(domain, icon)
      }
    }
  }

  await Promise.all([
    deleteBlobAssets([...blobTargets]),
    deleteStoredAssets([...storedAssetIds]),
    ...[...faviconCacheDeletes].map(([domain, expectedIcon]) =>
      deleteCachedFavicon(domain, expectedIcon)
    ),
  ])
}

function collectSites(data: NavigationData) {
  const sites: SiteRecord[] = []

  for (const navigationItem of data.navigationItems || []) {
    for (const item of navigationItem.items || []) {
      sites.push(toSiteRecord(item))
    }

    for (const subCategory of navigationItem.subCategories || []) {
      for (const item of subCategory.items || []) {
        sites.push(toSiteRecord(item))
      }
    }
  }

  return sites
}

function collectReferencedIcons(data: NavigationData) {
  const icons = new Set<string>()

  for (const navigationItem of data.navigationItems || []) {
    addIcon(icons, navigationItem.icon)

    for (const item of navigationItem.items || []) {
      addIcon(icons, item.icon)
    }

    for (const subCategory of navigationItem.subCategories || []) {
      addIcon(icons, subCategory.icon)

      for (const item of subCategory.items || []) {
        addIcon(icons, item.icon)
      }
    }
  }

  return icons
}

function toSiteRecord(item: NavigationSubItem): SiteRecord {
  return {
    id: item.id,
    href: item.href,
    icon: item.icon,
  }
}

function addIcon(icons: Set<string>, icon?: string) {
  const normalizedIcon = icon?.trim()
  if (normalizedIcon) icons.add(normalizedIcon)
}

function getCachedFaviconBlobTarget(icon: string) {
  if (icon.startsWith('favicons/')) return icon

  try {
    const parsed = new URL(icon)
    const pathname = parsed.pathname.replace(/^\/+/, '')

    return pathname.startsWith('favicons/') ? icon : ''
  } catch {
    return ''
  }
}

function getCachedFaviconStoredAssetId(icon: string) {
  if (!icon.startsWith('/api/assets/')) return ''

  try {
    const id = decodeURIComponent(icon.slice('/api/assets/'.length))
    return id.startsWith('favicons_') ? id : ''
  } catch {
    return ''
  }
}

function getDomainFromUrl(url: string) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}
