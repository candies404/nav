import { getNavigationContent, getSiteContent } from '@/lib/content-cache'
import type {
  NavigationCategory,
  NavigationData,
  NavigationItem,
} from '@/types/navigation'
import type { SiteConfig } from '@/types/site'

export const ADMIN_READ_TIMEOUT_MS = getPositiveInteger(
  process.env.NAVSPHERE_ADMIN_READ_TIMEOUT_MS,
  5_000
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
  siteId?: string
  categoryId?: string | null
  subCategoryId?: string | null
  query?: string | null
  status?: 'all' | 'enabled' | 'disabled' | string | null
  page?: number
  pageSize?: number
  all?: boolean
  idsOnly?: boolean
}

export async function getAdminNavigationData(options: AdminReadOptions = {}) {
  return getNavigationContent({
    fresh: options.fresh,
    requestTimeoutMs: ADMIN_READ_TIMEOUT_MS,
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
  const query = input.query?.trim().toLocaleLowerCase() || ''
  const status = input.status === 'enabled' || input.status === 'disabled'
    ? input.status
    : 'all'
  const totalSiteCount = countSites(data)
  let siteCount = 0

  const filterItems = (items: NavigationCategory['items'] = []) => {
    const filteredItems = items.filter(item => {
      const matchesQuery = !query || [item.title, item.href, item.description, ...(item.aliases || [])]
        .some(value => value?.toLocaleLowerCase().includes(query))
      const matchesStatus = status === 'all'
        || (status === 'enabled' && item.enabled !== false)
        || (status === 'disabled' && item.enabled === false)
      return matchesQuery && matchesStatus && (!input.siteId || item.id === input.siteId)
    })
    siteCount += filteredItems.length
    return filteredItems
  }

  const filteredNavigationItems = data.navigationItems.map(category => {
    const matchesCategory = !categoryId || category.id === categoryId
    const items = matchesCategory && !subCategoryId
      ? filterItems(category.items)
      : matchesCategory && filterMainItemsOnly
        ? filterItems(category.items)
        : []

    return {
      id: category.id,
      title: category.title,
      icon: category.icon,
      items,
      subCategories: category.subCategories?.map(subCategory => {
        const matchesSubCategory = matchesCategory
          && !filterMainItemsOnly
          && (!subCategoryId || subCategory.id === subCategoryId)
        const subItems = matchesSubCategory ? filterItems(subCategory.items) : []

        return {
          id: subCategory.id,
          title: subCategory.title,
          icon: subCategory.icon,
          items: subItems,
        }
      }) || [],
    }
  })

  const pageSize = input.all ? Math.max(siteCount, 1) : clampInteger(input.pageSize, 25, 10, 100)
  const totalPages = input.all ? 1 : Math.max(1, Math.ceil(siteCount / pageSize))
  const page = input.all ? 1 : clampInteger(input.page, 1, 1, totalPages)
  const startIndex = input.all ? 0 : (page - 1) * pageSize
  const endIndex = input.all ? siteCount : startIndex + pageSize
  const siteIds = input.idsOnly
    ? filteredNavigationItems.flatMap(category => [
      ...(category.items || []).map(item => item.id),
      ...category.subCategories.flatMap(subCategory => (subCategory.items || []).map(item => item.id)),
    ])
    : undefined
  let itemIndex = 0

  const takePageItems = (items: NavigationCategory['items'] = []) => items.filter(() => {
    const currentIndex = itemIndex
    itemIndex += 1
    return currentIndex >= startIndex && currentIndex < endIndex
  })

  const navigationItems = filteredNavigationItems.map(category => ({
    ...category,
    items: takePageItems(category.items),
    subCategories: category.subCategories.map(subCategory => ({
      ...subCategory,
      items: takePageItems(subCategory.items),
    })),
  }))

  return {
    navigationItems: input.idsOnly ? [] : navigationItems,
    totalSiteCount,
    siteCount,
    categoryId,
    subCategoryId: filterMainItemsOnly ? 'none' : subCategoryId,
    query,
    status,
    page,
    pageSize,
    totalPages,
    ...(siteIds ? { siteIds } : {}),
  }
}

export async function getAdminSiteConfig(options: AdminReadOptions = {}) {
  return getSiteContent({
    fresh: options.fresh,
    requestTimeoutMs: ADMIN_READ_TIMEOUT_MS,
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

function clampInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const normalized = Number.isFinite(value) ? Math.floor(value as number) : fallback
  return Math.min(maximum, Math.max(minimum, normalized))
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
