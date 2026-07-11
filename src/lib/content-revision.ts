export function getContentRevision(value: unknown) {
  const content = JSON.stringify(value)
  let hash = 2166136261

  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `${(hash >>> 0).toString(36)}-${content.length.toString(36)}`
}
