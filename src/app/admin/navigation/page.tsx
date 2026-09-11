import { getAdminNavigationSummary } from '@/lib/admin-read'
import { NavigationClient } from './navigation-client'

export const runtime = 'edge'

export default async function NavigationPage() {
  return <NavigationClient initialItems={await getAdminNavigationSummary()} />
}
