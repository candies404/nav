export const RECENT_VISITS_STORAGE_KEY = 'navsphereRecentVisitsV1'
export const RECENT_VISITS_UPDATED_EVENT = 'navsphere:recent-visits-updated'
export const MAX_RECENT_VISITS = 6

export function readRecentVisitIds() {
  if (typeof window === 'undefined') return []

  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(RECENT_VISITS_STORAGE_KEY) || '[]')
    if (!Array.isArray(value)) return []

    return Array.from(new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
    )).slice(0, MAX_RECENT_VISITS)
  } catch {
    return []
  }
}

export function recordRecentVisit(itemId: string) {
  if (typeof window === 'undefined') return

  const normalizedId = itemId.trim()
  if (!normalizedId) return

  const nextIds = [
    normalizedId,
    ...readRecentVisitIds().filter(id => id !== normalizedId),
  ].slice(0, MAX_RECENT_VISITS)

  try {
    window.localStorage.setItem(RECENT_VISITS_STORAGE_KEY, JSON.stringify(nextIds))
    window.dispatchEvent(new Event(RECENT_VISITS_UPDATED_EVENT))
  } catch {
    // Recent visits are an optional browser-local enhancement.
  }
}

export function clearRecentVisits() {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(RECENT_VISITS_STORAGE_KEY)
    window.dispatchEvent(new Event(RECENT_VISITS_UPDATED_EVENT))
  } catch {
    // Ignore unavailable or restricted browser storage.
  }
}
