import { getFileContent } from '@/lib/storage'
import type {
  NavigationCategory,
  NavigationData,
  NavigationItem,
} from '@/types/navigation'
import type { SiteConfig } from '@/types/site'

const NAVIGATION_PATH = 'src/navsphere/content/navigation.json'
const SITE_PATH = 'src/navsphere/content/site.json'

export const ADMIN_READ_CACHE_TTL_MS = getPositiveInteger(
  process.env.NAVSPHERE_ADMIN_READ_CACHE_TTL_MS,
  10_000
)

type AdminReadOptions = {
  fresh?: boolean
}

export type AdminStats = {
  parentCategories: number
  subCategories: number
  totalCategories: number
  totalSites: number
}

export type AdminCategorySummary = Omit<NavigationCategory, 'items'> & {
  siteCount: number
}

export type AdminNavigationCategories = {
  id: string
  title: string
  icon?: string
  description?: string
  enabled?: boolean
  subCategories: AdminCategorySummary[]
}

type AdminSiteListInput = AdminReadOptions & {
  categoryId?: string | null
  subCategoryId?: string | null
}

export async function getAdminNavigationData(options: AdminReadOptions = {}) {
  return getFileContent(NAVIGATION_PATH, {
    bypassCache: options.fresh,
    maxAgeMs: ADMIN_READ_CACHE_TTL_MS,
  }) as Promise<NavigationData>
}

export async function getAdminNavigationSummary(options: AdminReadOptions = {}) {
  const data = await getAdminNavigationData(options)
  return summarizeNavigationItems(data.navigationItems || [])
}

export async function getAdminStats(options: AdminReadOptions = {}): Promise<AdminStats> {
  const data = await getAdminNavigationData(options)
  let subCategories = 0
  let totalSites = 0
  const parentCategories = data.navigationItems?.length || 0

  for (const category of data.navigationItems || []) {
    totalSites += category.items?.length || 0

    for (const subCategory of category.subCategories || []) {
      subCategories += 1
      totalSites += subCategory.items?.length || 0
    }
  }

  return {
    parentCategories,
    subCategories,
    totalCategories: parentCategories + subCategories,
    totalSites,
  }
}

export async function getAdminNavigationCategories(
  navigationId: string,
  options: AdminReadOptions = {}
): Promise<AdminNavigationCategories | null> {
  const data = await getAdminNavigationData(options)
  const navigation = data.navigationItems.find(item => item.id === navigationId)
  return navigation ? toCategorySummary(navigation) : null
}

export async function getAdminNavigationSites(input: AdminSiteListInput = {}) {
  const data = await getAdminNavigationData(input)
  const categoryId = normalizeOptionalId(input.categoryId)
  const subCategoryId = normalizeSubCategoryId(input.subCategoryId)
  const filterMainItemsOnly = input.subCategoryId === 'none'
  const totalSiteCount = countSites(data)
  let siteCount = 0

  const navigationItems = data.navigationItems.map(category => {
    const matchesCategory = !categoryId || category.id === categoryId
    const items = matchesCategory && !subCategoryId
      ? [...(category.items || [])]
      : matchesCategory && filterMainItemsOnly
        ? [...(category.items || [])]
        : []

    siteCount += items.length

    return {
      id: category.id,
      title: category.title,
      icon: category.icon,
      items,
      subCategories: category.subCategories?.map(subCategory => {
        const matchesSubCategory = matchesCategory
          && !filterMainItemsOnly
          && (!subCategoryId || subCategory.id === subCategoryId)
        const subItems = matchesSubCategory ? [...(subCategory.items || [])] : []
        siteCount += subItems.length

        return {
          id: subCategory.id,
          title: subCategory.title,
          icon: subCategory.icon,
          items: subItems,
        }
      }) || [],
    }
  })

  return {
    navigationItems,
    totalSiteCount,
    siteCount,
    categoryId,
    subCategoryId: filterMainItemsOnly ? 'none' : subCategoryId,
  }
}

export async function getAdminSiteConfig(options: AdminReadOptions = {}) {
  return getFileContent(SITE_PATH, {
    bypassCache: options.fresh,
    maxAgeMs: ADMIN_READ_CACHE_TTL_MS,
  }) as Promise<SiteConfig>
}

export function summarizeNavigationItems(items: NavigationItem[]) {
  return items.map(item => ({
    id: item.id,
    title: item.title,
    description: item.description,
    icon: item.icon,
    enabled: item.enabled,
  }))
}

export function toCategorySummary(
  navigation: NavigationData['navigationItems'][number]
): AdminNavigationCategories {
  return {
    id: navigation.id,
    title: navigation.title,
    icon: navigation.icon,
    description: navigation.description,
    enabled: navigation.enabled,
    subCategories: (navigation.subCategories || []).map(toCategorySummaryItem),
  }
}

export function toCategorySummaryItem(category: NavigationCategory): AdminCategorySummary {
  return {
    id: category.id,
    title: category.title,
    icon: category.icon,
    description: category.description,
    enabled: category.enabled,
    siteCount: category.items?.length || 0,
  }
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function normalizeOptionalId(value?: string | null) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized && normalized !== 'all' ? normalized : undefined
}

function normalizeSubCategoryId(value?: string | null) {
  const normalized = normalizeOptionalId(value)
  return normalized === 'none' ? undefined : normalized
}

function countSites(data: NavigationData) {
  let count = 0
  for (const category of data.navigationItems || []) {
    count += category.items?.length || 0
    for (const subCategory of category.subCategories || []) {
      count += subCategory.items?.length || 0
    }
  }
  return count
}
