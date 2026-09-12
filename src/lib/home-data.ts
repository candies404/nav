import { getProcessedData, processSiteData } from '@/lib/data-loader'
import { getNavigationContent, getSiteContent } from '@/lib/content-cache'
import type { NavigationDataRaw } from '@/types/navigation'
import type { SiteInfo } from '@/types/site'

export async function getHomeData(includePrivate = false) {
  const [navigationData, siteData] = await Promise.all([
    getNavigationContent() as Promise<NavigationDataRaw>,
    getSiteContent() as Promise<SiteInfo>,
  ])

  return getProcessedData(navigationData, siteData, includePrivate)
}

export async function getHomeSiteData() {
  return processSiteData(
    await getSiteContent() as SiteInfo
  )
}
