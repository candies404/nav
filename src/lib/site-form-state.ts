export type MetadataField = 'name' | 'description' | 'icon'
export type MetadataForm = { url: string; name: string; description: string; icon: string }
export type MetadataValues = { title?: string; description?: string; icon?: string }

export function mergeMetadata<T extends MetadataForm>(
  current: T,
  url: string,
  metadata: MetadataValues,
  edited: ReadonlySet<MetadataField>,
  automatic: Partial<Record<MetadataField, string>>,
): T {
  if (current.url.trim() !== url.trim()) return current
  const next = { ...current }
  const values = { name: metadata.title, description: metadata.description, icon: metadata.icon }
  for (const field of ['name', 'description', 'icon'] as const) {
    if (edited.has(field)) continue
    if (current[field].trim() && current[field] !== automatic[field]) continue
    if (typeof values[field] === 'string' && values[field]?.trim()) next[field] = values[field]!
  }
  return next
}

export function isHttpUrl(value: string) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}
