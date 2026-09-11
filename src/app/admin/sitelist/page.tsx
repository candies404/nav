import { getAdminNavigationSites } from '@/lib/admin-read'
import { SiteListClient } from './site-list-client'

export const runtime = 'edge'

type SiteListPageProps = {
  searchParams: Promise<{
    categoryId?: string | string[]
    subCategoryId?: string | string[]
    query?: string | string[]
    status?: string | string[]
    page?: string | string[]
    pageSize?: string | string[]
  }>
}

export default async function SiteListPage({ searchParams }: SiteListPageProps) {
  const params = await searchParams
  const categoryId = getFirstValue(params.categoryId) || 'all'
  const subCategoryId = getFirstValue(params.subCategoryId) || 'all'
  const query = getFirstValue(params.query) || ''
  const status = getFirstValue(params.status) || 'all'
  const page = getPositiveInteger(params.page, 1)
  const pageSize = getPositiveInteger(params.pageSize, 25)
  const initialData = await getAdminNavigationSites({
    categoryId,
    subCategoryId,
    query,
    status,
    page,
    pageSize,
  })

  return (
    <SiteListClient
      initialData={initialData}
      initialCategoryId={categoryId}
      initialSubCategoryId={subCategoryId}
      initialQuery={query}
      initialStatus={status}
    />
  )
}

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getPositiveInteger(value: string | string[] | undefined, fallback: number) {
  const parsed = Number(getFirstValue(value))
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
