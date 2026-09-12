import { getAdminStats } from '@/lib/admin-read'
import { AdminDashboard } from './dashboard-client'

export const runtime = 'nodejs'

export default async function AdminDashboardPage() {
  return <AdminDashboard initialStats={await getAdminStats()} />
}
