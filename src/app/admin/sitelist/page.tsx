import { getAdminNavigationSites } from '@/lib/admin-read'
import { SiteListClient } from './site-list-client'

export const runtime = 'edge'

type SiteListPageProps = {
  searchParams: Promise<{
    categoryId?: string | string[]
    subCategoryId?: string | string[]
  }>
}

export default async function SiteListPage({ searchParams }: SiteListPageProps) {
  const params = await searchParams
  const categoryId = getFirstValue(params.categoryId) || 'all'
  const subCategoryId = getFirstValue(params.subCategoryId) || 'all'
  const initialData = await getAdminNavigationSites({
    categoryId,
    subCategoryId,
  })

  return (
    <SiteListClient
      initialData={initialData}
      initialCategoryId={categoryId}
      initialSubCategoryId={subCategoryId}
    />
  )
}

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
