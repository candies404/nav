export type SiteFormValues = {
  name: string
  url: string
  aliases: string
  description: string
  icon: string
  categoryId: string
  subCategoryId: string
  enabled: boolean
  isPrivate: boolean
}

export type SiteFormDraft = {
  version: 1
  kind: 'add' | 'edit'
  siteId?: string
  values: SiteFormValues
  baseline: SiteFormValues
  savedAt: number
}

export const SITE_FORM_DRAFT_STORAGE_KEY = 'navsphere:site-form-draft:v1'
export const SITE_FORM_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000

const FORM_FIELDS: Array<keyof SiteFormValues> = [
  'name', 'url', 'aliases', 'description', 'icon', 'categoryId',
  'subCategoryId', 'enabled', 'isPrivate',
]

export function createEmptySiteForm(): SiteFormValues {
  return {
    name: '',
    url: '',
    aliases: '',
    description: '',
    icon: '',
    categoryId: '',
    subCategoryId: '',
    enabled: true,
    isPrivate: false,
  }
}

export function hasSiteFormChanges(values: SiteFormValues, baseline: SiteFormValues) {
  return FORM_FIELDS.some(field => values[field] !== baseline[field])
}

export function parseSiteAliases(value: string) {
  const aliases = value
    .split(/[,，\n]/)
    .map(alias => alias.trim())
    .filter(Boolean)
  return [...new Set(aliases)]
}

export function formatSiteAliases(aliases?: string[]) {
  return (aliases || []).join(', ')
}

export function parseSiteFormDraft(value: string | null, now = Date.now()): SiteFormDraft | null {
  if (!value) return null
  try {
    const draft = JSON.parse(value) as Partial<SiteFormDraft>
    if (
      draft.version !== 1 ||
      (draft.kind !== 'add' && draft.kind !== 'edit') ||
      !isSiteFormValues(draft.values) ||
      !isSiteFormValues(draft.baseline) ||
      typeof draft.savedAt !== 'number' ||
      now - draft.savedAt > SITE_FORM_DRAFT_MAX_AGE_MS ||
      (draft.kind === 'edit' && !draft.siteId)
    ) {
      return null
    }
    return draft as SiteFormDraft
  } catch {
    return null
  }
}

function isSiteFormValues(value: unknown): value is SiteFormValues {
  if (!value || typeof value !== 'object') return false
  const form = value as Partial<SiteFormValues>
  return FORM_FIELDS.every(field => {
    if (field === 'enabled' || field === 'isPrivate') return typeof form[field] === 'boolean'
    return typeof form[field] === 'string'
  })
}
