import { readAdminResponse } from '@/lib/admin-api-response'
import { isHttpUrl } from '@/lib/site-form-state'
import { parseSiteAliases, type SiteFormValues } from '@/lib/site-draft'
import type { NavigationSubItem } from '@/types/navigation'

export function getSiteFormValidationError(values: SiteFormValues) {
  if (!values.name.trim()) return '请填写站点名称'
  if (!values.url.trim()) return '请填写站点链接'
  if (!isHttpUrl(values.url)) return '请填写有效的 HTTP 或 HTTPS 站点链接'
  if (!values.categoryId) return '请选择所属分类'
  return ''
}

export async function updateSiteFromForm(siteId: string, values: SiteFormValues) {
  const response = await fetch(`/api/navigation/sites/${encodeURIComponent(siteId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: values.name,
      href: values.url,
      aliases: parseSiteAliases(values.aliases),
      description: values.description,
      icon: values.icon,
      enabled: values.enabled,
      isPrivate: values.isPrivate,
      targetCategoryId: values.categoryId,
      targetSubCategoryId: values.subCategoryId || null,
    }),
  })
  return readAdminResponse<{ item: NavigationSubItem }>(response, '更新站点失败')
}
