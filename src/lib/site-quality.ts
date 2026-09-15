import type { NavigationData, NavigationSubItem } from '@/types/navigation'

export type QualitySite = NavigationSubItem & {
  categoryId: string
  subCategoryId?: string
  categoryPath: string
}
export type LinkHealth = {
  href: string
  state: 'ok' | 'broken' | 'review'
  reason: string
  statusCode?: number
  checkedAt: string
}
export type QualityIssue = 'broken-link' | 'review-link' | 'missing-icon' | 'missing-description' | 'duplicate' | 'unchecked'
export type QualityItem = QualitySite & { issues: QualityIssue[]; health?: LinkHealth }
export type QualityReport = { items: QualityItem[]; healthWarning?: string }

export const qualityLabels: Record<QualityIssue, string> = {
  'broken-link': '失效链接', 'review-link': '链接待复核',
  'missing-icon': '缺失图标', 'missing-description': '待补充描述',
  duplicate: '重复网址', unchecked: '待检测',
}

// Preserve protocol, port and query parameters: these may identify different resources.
export function normalizeSiteUrl(value: string) {
  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol)) return null
    url.hash = ''
    url.pathname = url.pathname.replace(/\/+$/, '') || '/'
    url.searchParams.sort()
    return url.href
  } catch { return null }
}

export function flattenSites(data: NavigationData): QualitySite[] {
  return (data.navigationItems || []).flatMap(category => [
    ...(category.items || []).map(item => ({ ...item, categoryId: category.id, categoryPath: category.title })),
    ...(category.subCategories || []).flatMap(sub => (sub.items || []).map(item => ({
      ...item, categoryId: category.id, subCategoryId: sub.id,
      categoryPath: `${category.title} / ${sub.title}`,
    }))),
  ])
}

export function findDuplicateSites(data: NavigationData, href: string, excludeId?: string) {
  const key = normalizeSiteUrl(href)
  if (!key) return []
  return flattenSites(data).filter(site => site.id !== excludeId && normalizeSiteUrl(site.href) === key)
}

export function buildQualityItems(data: NavigationData, health: Record<string, LinkHealth> = {}, now = Date.now()): QualityItem[] {
  const sites = flattenSites(data)
  const counts = new Map<string, number>()
  for (const site of sites) {
    const key = normalizeSiteUrl(site.href)
    if (key) counts.set(key, (counts.get(key) || 0) + 1)
  }
  return sites.map(site => {
    const key = normalizeSiteUrl(site.href)
    const record = health[site.id]?.href === site.href ? health[site.id] : undefined
    const issues: QualityIssue[] = []
    if (!key || record?.state === 'broken') issues.push('broken-link')
    if (record?.state === 'review') issues.push('review-link')
    if (!site.icon?.trim()) issues.push('missing-icon')
    if (!site.description?.trim() || /^Visit\s+\S+\s*$/i.test(site.description) || site.description === 'Unable to fetch website metadata') issues.push('missing-description')
    if (key && (counts.get(key) || 0) > 1) issues.push('duplicate')
    if (!record || !Number.isFinite(Date.parse(record.checkedAt)) || now - Date.parse(record.checkedAt) > 7 * 86400_000) issues.push('unchecked')
    return { ...site, issues, health: record }
  })
}

export function siteEditHref(site: QualitySite) {
  const params = new URLSearchParams({ categoryId: site.categoryId, editId: site.id })
  if (site.subCategoryId) params.set('subCategoryId', site.subCategoryId)
  return `/admin/sitelist?${params}`
}
