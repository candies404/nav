import { listManagedResources } from '@/lib/resource-storage'
import type { ResourceCardResource } from '@/services/resource-api'
import { ResourceManagementClient } from './resource-management-client'

export const runtime = 'edge'

export default async function ResourceManagementPage() {
  let initialResources: ResourceCardResource[] = []
  let initialError: string | null = null

  try {
    const data = await listManagedResources()
    initialResources = data.metadata.map((item, index) => ({
      id: item.hash,
      title: item.pathname || item.path || `图片资源 ${index + 1}`,
      items: [{
        title: item.pathname || item.path,
        description: '',
        icon: '',
        url: item.url || (item.path.startsWith('http') || item.path.startsWith('/') ? item.path : `/${item.path}`),
        pathname: item.pathname || item.hash,
        size: item.size,
        uploadedAt: item.uploadedAt,
      }],
    }))
  } catch (error) {
    initialError = error instanceof Error ? error.message : '图片资源加载失败'
  }

  return (
    <ResourceManagementClient
      initialResources={initialResources}
      initialError={initialError}
    />
  )
}
