import { getManagedResourcePage } from '@/lib/resource-storage'
import { mapResourceMetadata, type ResourceListPage } from '@/services/resource-api'
import { ResourceManagementClient } from './resource-management-client'

export const runtime = 'edge'

export default async function ResourceManagementPage() {
  let initialData: ResourceListPage = {
    resources: [],
    page: 1,
    pageSize: 40,
    total: 0,
    filteredTotal: 0,
    totalPages: 1,
    manualCount: 0,
    cachedCount: 0,
    kind: 'all',
  }
  let initialError: string | null = null

  try {
    const data = await getManagedResourcePage()
    initialData = {
      resources: mapResourceMetadata(data.metadata),
      page: data.page,
      pageSize: data.pageSize,
      total: data.total,
      filteredTotal: data.filteredTotal,
      totalPages: data.totalPages,
      manualCount: data.manualCount,
      cachedCount: data.cachedCount,
      kind: data.kind,
    }
  } catch (error) {
    initialError = error instanceof Error ? error.message : '图片资源加载失败'
  }

  return (
    <ResourceManagementClient
      initialData={initialData}
      initialError={initialError}
    />
  )
}
