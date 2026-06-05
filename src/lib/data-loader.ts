import type { SiteConfig, SiteInfo } from '@/types/site'
import type { NavigationData, NavigationDataRaw, NavigationItem, NavigationSubItem, NavigationSubItemRaw } from '@/types/navigation'

export function processSiteData(siteDataRaw: SiteInfo): SiteConfig {
    return {
        ...siteDataRaw,
        appearance: {
            ...siteDataRaw.appearance,
            theme: (siteDataRaw.appearance?.theme === 'light' ||
                siteDataRaw.appearance?.theme === 'dark' ||
                siteDataRaw.appearance?.theme === 'system')
                ? siteDataRaw.appearance.theme
                : 'system'
        },
        navigation: {
            linkTarget: (siteDataRaw.navigation?.linkTarget === '_blank' ||
                siteDataRaw.navigation?.linkTarget === '_self')
                ? siteDataRaw.navigation.linkTarget
                : '_blank'
        }
    } as SiteConfig
}

export function processNavigationSubItem(item: NavigationSubItemRaw): NavigationSubItem {
    return {
        id: item.id,
        title: item.title,
        href: item.href,
        description: item.description,
        icon: item.icon,
        enabled: item.enabled,
        isPrivate: item.isPrivate ?? false
    }
}

export function processNavigationData(navigationDataRaw: NavigationDataRaw): NavigationData {
    const processedItems = navigationDataRaw.navigationItems.map(category => ({
        ...category,
        items: category.items?.map(processNavigationSubItem),
        subCategories: category.subCategories?.map(sub => ({
            ...sub,
            items: sub.items?.map(processNavigationSubItem)
        }))
    }))

    return {
        navigationItems: processedItems as NavigationItem[]
    }
}

function shouldShowItem(item: NavigationSubItem, includePrivate: boolean) {
    if (item.enabled === false) return false
    if (!includePrivate && item.isPrivate === true) return false

    return true
}

export function filterNavigationData(navigationData: NavigationData, includePrivate = false): NavigationData {
    const filteredItems = navigationData.navigationItems
        .filter(category => category.enabled !== false)
        .map(category => {
            const filteredSubCategories = category.subCategories
                ? category.subCategories
                    .filter((sub) => sub.enabled !== false)
                    .map((sub) => ({
                        ...sub,
                        items: sub.items?.filter((item) => shouldShowItem(item, includePrivate))
                    }))
                : undefined

            return {
                ...category,
                items: category.items?.filter((item) => shouldShowItem(item, includePrivate)),
                subCategories: filteredSubCategories
            }
        }) as NavigationItem[]

    return {
        navigationItems: filteredItems
    }
}

export function getProcessedData(navigationDataRaw: NavigationDataRaw, siteDataRaw: SiteInfo, includePrivate = false) {
    const siteData = processSiteData(siteDataRaw)
    const processedNavigationData = processNavigationData(navigationDataRaw)
    const navigationData = filterNavigationData(processedNavigationData, includePrivate)

    return {
        siteData,
        navigationData
    }
}
