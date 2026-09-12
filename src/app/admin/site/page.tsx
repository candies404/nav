import { getAdminSiteConfig } from '@/lib/admin-read'
import { SiteSettingsClient } from './site-settings-client'

export const runtime = 'nodejs'

export default async function SiteSettingsPage() {
  return <SiteSettingsClient initialConfig={await getAdminSiteConfig()} />
}
