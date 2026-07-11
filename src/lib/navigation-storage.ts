import {
  commitFile,
  DataHistoryVersion,
  deleteDataHistoryVersion,
  deleteBlobAssets,
  deleteCachedFavicon,
  deleteStoredAssets,
  getDataHistoryLimit,
  getDataHistoryVersion,
  getFileContent,
  listDataHistoryVersions,
  pushDataHistoryVersion,
} from '@/lib/storage'
import type { NavigationData, NavigationSubItem } from '@/types/navigation'
import { revalidateNavigationContent } from '@/lib/cache-invalidation'

const NAVIGATION_PATH = 'src/navsphere/content/navigation.json'

export type NavigationHistorySummary = {
  id: string
  createdAt: string
  message: string
  categoryCount: number
  siteCount: number
  size: number
}

export type NavigationHistoryDetail = NavigationHistorySummary & {
  data: NavigationData
}

type SiteRecord = {
  id: string
  href: string
  icon?: string
}

type SaveNavigationDataOptions = {
  recordHistory?: boolean
}

type SaveNavigationDataResult = {
  saved: boolean
  historyRecorded: boolean
}

export async function saveNavigationData(
  data: NavigationData,
  message = 'Update navigation data',
  options: SaveNavigationDataOptions = {}
): Promise<SaveNavigationDataResult> {
  const previousData = await getFileContent(
    NAVIGATION_PATH,
    { bypassCache: true }
  ) as NavigationData
  const previousContent = stringifyNavigationData(previousData)
  const nextContent = stringifyNavigationData(data)
  let historyRecorded = false

  if (previousContent === nextContent) {
    return {
      saved: false,
      historyRecorded: false,
    }
  }

  if (options.recordHistory ?? true) {
    historyRecorded = await recordNavigationHistory(previousData, message)
  }

  await commitFile(
    NAVIGATION_PATH,
    nextContent,
    message
  )
  revalidateNavigationContent()

  try {
    await cleanupRemovedSiteFavicons(previousData, data)
  } catch (error) {
    console.warn('Failed to cleanup removed site favicons:', error)
  }

  return {
    saved: true,
    historyRecorded,
  }
}

export function getNavigationHistoryLimit() {
  return getDataHistoryLimit()
}

export async function listNavigationHistory() {
  const versions = await listDataHistoryVersions<NavigationData>(NAVIGATION_PATH)
  return versions.map(toNavigationHistorySummary)
}

export async function getNavigationHistoryDetail(id: string): Promise<NavigationHistoryDetail | null> {
  const version = await getDataHistoryVersion<NavigationData>(NAVIGATION_PATH, id)
  if (!version) return null

  return {
    ...toNavigationHistorySummary(version),
    data: version.data,
  }
}

export async function deleteNavigationHistoryVersion(id: string) {
  return deleteDataHistoryVersion<NavigationData>(NAVIGATION_PATH, id)
}

export async function restoreNavigationHistoryVersion(id: string) {
  const version = await getDataHistoryVersion<NavigationData>(NAVIGATION_PATH, id)
  if (!version) return null

  await saveNavigationData(version.data, `Restore navigation history: ${id}`)
  return version.data
}

async function recordNavigationHistory(data: NavigationData, message: string) {
  const content = stringifyNavigationData(data)
  const versions = await listDataHistoryVersions<NavigationData>(NAVIGATION_PATH)
  const alreadyExists = versions.some(version =>
    stringifyNavigationData(version.data) === content
  )

  if (alreadyExists) return false

  await pushDataHistoryVersion(NAVIGATION_PATH, createNavigationHistoryVersion(data, message))
  return true
}

function createNavigationHistoryVersion(
  data: NavigationData,
  message: string
): DataHistoryVersion<NavigationData> {
  const content = stringifyNavigationData(data)
  const { categoryCount, siteCount } = getNavigationStats(data)

  return {
    id: `navigation_${Date.now()}_${crypto.randomUUID()}`,
    path: NAVIGATION_PATH,
    createdAt: new Date().toISOString(),
    message,
    data,
    metadata: {
      categoryCount,
      siteCount,
      size: new Blob([content]).size,
    },
  }
}

function toNavigationHistorySummary(
  version: DataHistoryVersion<NavigationData>
): NavigationHistorySummary {
  const { categoryCount, siteCount } = getNavigationStats(version.data)
  const content = stringifyNavigationData(version.data)

  return {
    id: version.id,
    createdAt: version.createdAt,
    message: version.message,
    categoryCount: getNumberMetadata(version, 'categoryCount', categoryCount),
    siteCount: getNumberMetadata(version, 'siteCount', siteCount),
    size: getNumberMetadata(version, 'size', new Blob([content]).size),
  }
}

function stringifyNavigationData(data: NavigationData) {
  return JSON.stringify(data, null, 2)
}

async function cleanupRemovedSiteFavicons(previousData: NavigationData, nextData: NavigationData) {
  const nextSiteIds = new Set(collectSites(nextData).map(site => site.id))
  const retainedIcons = collectReferencedIcons(nextData)
  const historyIcons = await collectHistoryReferencedIcons()
  const removedSites = collectSites(previousData).filter(site => !nextSiteIds.has(site.id))
  const blobTargets = new Set<string>()
  const storedAssetIds = new Set<string>()
  const faviconCacheDeletes = new Map<string, string | undefined>()

  for (const icon of historyIcons) {
    retainedIcons.add(icon)
  }

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

async function collectHistoryReferencedIcons() {
  const icons = new Set<string>()
  const historyVersions = await listDataHistoryVersions<NavigationData>(NAVIGATION_PATH)

  for (const version of historyVersions) {
    for (const icon of collectReferencedIcons(version.data)) {
      icons.add(icon)
    }
  }

  return icons
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

function getNavigationStats(data: NavigationData) {
  let categoryCount = 0
  let siteCount = 0

  for (const navigationItem of data.navigationItems || []) {
    categoryCount += 1
    siteCount += navigationItem.items?.length || 0

    for (const subCategory of navigationItem.subCategories || []) {
      categoryCount += 1
      siteCount += subCategory.items?.length || 0
    }
  }

  return {
    categoryCount,
    siteCount,
  }
}

function getNumberMetadata(
  version: DataHistoryVersion<NavigationData>,
  key: string,
  fallback: number
) {
  const value = version.metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
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
