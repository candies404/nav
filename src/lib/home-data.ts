import { getProcessedData, processSiteData } from '@/lib/data-loader'
import { getFileContent } from '@/lib/storage'
import type { NavigationDataRaw } from '@/types/navigation'
import type { SiteInfo } from '@/types/site'

const NAVIGATION_PATH = 'src/navsphere/content/navigation.json'
const SITE_PATH = 'src/navsphere/content/site.json'

export async function getHomeData(includePrivate = false) {
  const [navigationData, siteData] = await Promise.all([
    getFileContent(NAVIGATION_PATH, { bypassCache: true }) as Promise<NavigationDataRaw>,
    getFileContent(SITE_PATH, { bypassCache: true }) as Promise<SiteInfo>,
  ])

  return getProcessedData(navigationData, siteData, includePrivate)
}

export async function getHomeSiteData() {
  return processSiteData(
    await getFileContent(SITE_PATH, { bypassCache: true }) as SiteInfo
  )
}
