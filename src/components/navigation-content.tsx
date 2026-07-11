import type { NavigationData } from '@/types/navigation'
import type { SiteConfig } from '@/types/site'
import { NavigationCard } from '@/components/navigation-card'
import { NavigationShell } from '@/components/navigation-shell'
import { Footer } from '@/components/footer'
import { getContentRevision } from '@/lib/content-revision'

interface NavigationContentProps {
  navigationData: NavigationData
  siteData: SiteConfig
  searchScope?: 'public' | 'private'
}

export function NavigationContent({
  navigationData,
  siteData,
  searchScope = 'public',
}: NavigationContentProps) {
  const navigationOutline: NavigationData = {
    navigationItems: navigationData.navigationItems.map(category => ({
      id: category.id,
      title: category.title,
      icon: category.icon,
      subCategories: category.subCategories?.map(subCategory => ({
        id: subCategory.id,
        title: subCategory.title,
        icon: subCategory.icon,
      })),
    })),
  }

  return (
    <NavigationShell
      navigationOutline={navigationOutline}
      siteData={siteData}
      searchRevision={getContentRevision(navigationData)}
      searchScope={searchScope}
    >
      <div className="px-2 py-3 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <div className="space-y-5 sm:space-y-6">
          {navigationData.navigationItems.map((category) => (
            <section
              key={category.id}
              id={category.id}
              className="scroll-m-16 [content-visibility:auto] [contain-intrinsic-size:720px]"
            >
              <div className="space-y-3 sm:space-y-4">
                <h2 className="text-base font-medium tracking-tight">
                  {category.title}
                </h2>

                {(category.items || []).length > 0 && (
                  <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                    {(category.items || []).map((item) => (
                      <NavigationCard key={item.id} item={item} siteConfig={siteData} />
                    ))}
                  </div>
                )}

                {category.subCategories && category.subCategories.length > 0 && (
                  category.subCategories.map((subCategory) => (
                    <div key={subCategory.id} id={subCategory.id} className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        {subCategory.title}
                      </h3>
                      <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                        {(subCategory.items || []).map((item) => (
                          <NavigationCard key={item.id} item={item} siteConfig={siteData} />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
      <Footer siteInfo={siteData} />
    </NavigationShell>
  )
}
