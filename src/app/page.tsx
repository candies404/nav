import { NavigationContent } from '@/components/navigation-content'
import { Metadata } from 'next/types'
import { ScrollToTop } from '@/components/ScrollToTop'
import { Container } from '@/components/ui/container'
import { getProcessedData } from '@/lib/data-loader'
import { getFileContent } from '@/lib/storage'
import { isAuthenticatedRequest } from '@/lib/auth-token'
import { headers } from 'next/headers'
import type { NavigationDataRaw } from '@/types/navigation'
import type { SiteInfo } from '@/types/site'

async function getData(includePrivate = false) {
  const [navigationData, siteDataRaw] = await Promise.all([
    getFileContent('src/navsphere/content/navigation.json') as Promise<NavigationDataRaw>,
    getFileContent('src/navsphere/content/site.json') as Promise<SiteInfo>,
  ])

  return getProcessedData(navigationData, siteDataRaw, includePrivate)
}

export async function generateMetadata(): Promise<Metadata> {
  const { siteData } = await getData()

  return {
    title: siteData.basic.title,
    description: siteData.basic.description,
    keywords: siteData.basic.keywords,
    icons: {
      icon: siteData.appearance.favicon,
    },
  }
}

export default async function HomePage() {
  const requestHeaders = await headers()
  const { navigationData, siteData } = await getData(
    await isAuthenticatedRequest({ headers: requestHeaders })
  )

  return (
    <Container>
      <NavigationContent navigationData={navigationData} siteData={siteData} />
      <ScrollToTop />
    </Container>
  )
}
