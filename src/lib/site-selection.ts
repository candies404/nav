export function selectSiteIds(currentIds: string[], addedIds: string[]) {
  return [...new Set([...currentIds, ...addedIds])]
}

export function deselectSiteIds(currentIds: string[], removedIds: string[]) {
  const removed = new Set(removedIds)
  return currentIds.filter(id => !removed.has(id))
}
