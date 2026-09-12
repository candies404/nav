import { getAdminNavigationSummary } from '@/lib/admin-read'
import { NavigationClient } from './navigation-client'

export const runtime = 'nodejs'

export default async function NavigationPage() {
  return <NavigationClient initialItems={await getAdminNavigationSummary()} />
}
