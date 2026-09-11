import { getAdminSystemStatus } from '@/lib/admin-system-status'
import { SystemStatusClient } from './system-status-client'

export const runtime = 'edge'

export default async function AdminSystemStatusPage() {
  return <SystemStatusClient initialStatus={await getAdminSystemStatus()} />
}
