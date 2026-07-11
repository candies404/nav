import { NavigationContent } from '@/components/navigation-content'
import { Metadata } from 'next/types'
import { ScrollToTop } from '@/components/ScrollToTop'
import { Container } from '@/components/ui/container'
import { getHomeData, getHomeSiteData } from '@/lib/home-data'
import { isAuthenticatedRequest } from '@/lib/auth-token'
import { headers } from 'next/headers'

export async function generateMetadata(): Promise<Metadata> {
  const siteData = await getHomeSiteData()

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
  const includePrivate = await isAuthenticatedRequest({ headers: requestHeaders })
  const { navigationData, siteData } = await getHomeData(includePrivate)

  return (
    <Container>
      <NavigationContent
        navigationData={navigationData}
        siteData={siteData}
        searchScope={includePrivate ? 'private' : 'public'}
      />
      <ScrollToTop />
    </Container>
  )
}
