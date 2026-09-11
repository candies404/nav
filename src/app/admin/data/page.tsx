import { getAdminNavigationData } from '@/lib/admin-read'
import { DataManagementClient } from './data-management-client'

export const runtime = 'edge'

export default async function DataManagementPage() {
  const initialData = await getAdminNavigationData()
  return (
    <DataManagementClient
      initialNavigationJson={JSON.stringify(initialData, null, 2)}
    />
  )
}
