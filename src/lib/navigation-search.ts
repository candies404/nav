import type { NavigationSearchIndexItem } from '@/types/navigation'

function normalize(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase()
}

function hostnameVariants(href: string) {
  try {
    const hostname = normalize(new URL(href).hostname)
    return [hostname, hostname.replace(/^www\./, '')]
  } catch {
    return []
  }
}

export function getNavigationHostname(href: string) {
  return hostnameVariants(href)[0] || ''
}

export function searchNavigationItems(
  items: NavigationSearchIndexItem[],
  searchQuery: string,
) {
  const query = normalize(searchQuery)
  if (!query) return []
  const queryWithoutWww = query.replace(/^www\./, '')

  return items
    .map((item, sourceIndex) => ({
      item,
      sourceIndex,
      score: scoreNavigationItem(item, query, queryWithoutWww),
    }))
    .filter((result): result is typeof result & { score: number } => result.score !== null)
    .sort((left, right) => right.score - left.score || left.sourceIndex - right.sourceIndex)
    .map(result => result.item)
}

function scoreNavigationItem(
  item: NavigationSearchIndexItem,
  query: string,
  queryWithoutWww: string,
) {
  const title = normalize(item.title)
  const aliases = (item.aliases || []).map(normalize).filter(Boolean)
  const hostnames = hostnameVariants(item.href)
  const href = normalize(item.href)
  const description = normalize(item.description || '')
  const categories = item.categoryPath.map(normalize)

  if (title === query) return 1_000
  if (aliases.some(alias => alias === query)) return 950
  if (hostnames.some(hostname => hostname === query || hostname === queryWithoutWww)) return 900
  if (title.startsWith(query)) return 850
  if (hostnames.some(hostname => hostname.startsWith(queryWithoutWww))) return 800
  if (hostnames.some(hostname => hostname.includes(queryWithoutWww))) return 750
  if (href.includes(query)) return 700
  if (aliases.some(alias => alias.includes(query))) return 650
  if (title.includes(query)) return 600
  if (categories.some(category => category.includes(query))) return 400
  if (description.includes(query)) return 300
  return null
}
