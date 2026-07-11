import { getFileContent } from '@/lib/storage'
import { saveNavigationData } from '@/lib/navigation-storage'
import type { NavigationData, NavigationSubItem } from '@/types/navigation'

const NAVIGATION_PATH = 'src/navsphere/content/navigation.json'

export type SiteTarget = {
  targetCategoryId: string
  targetSubCategoryId?: string | null
}

export type SitePatch = Partial<Pick<
  NavigationSubItem,
  'title' | 'href' | 'description' | 'icon' | 'enabled' | 'isPrivate'
>>

export type AddSiteInput = SiteTarget & Pick<
  NavigationSubItem,
  'title' | 'href' | 'description' | 'icon' | 'enabled' | 'isPrivate'
>

export type BatchSiteOperation =
  | 'delete'
  | 'enable'
  | 'disable'
  | 'private'
  | 'public'
  | 'move'

type SiteLocation = {
  categoryIndex: number
  subCategoryIndex?: number
  itemIndex: number
}

export class NavigationSiteMutationError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
    this.name = 'NavigationSiteMutationError'
  }
}

export async function addNavigationSite(input: AddSiteInput) {
  validateSiteFields(input, true)
  const data = await loadNavigationData()
  const updatedData = cloneNavigationData(data)
  const target = resolveTarget(updatedData, input)
  const item: NavigationSubItem = {
    id: `site_${Date.now()}_${crypto.randomUUID()}`,
    title: input.title.trim(),
    href: input.href.trim(),
    description: input.description,
    icon: input.icon,
    enabled: input.enabled,
    isPrivate: input.isPrivate,
  }

  getTargetItems(updatedData, target).push(item)
  const result = await saveNavigationData(updatedData, `Add site: ${item.id}`)

  return {
    item,
    targetCategoryId: input.targetCategoryId,
    targetSubCategoryId: normalizeSubCategoryId(input.targetSubCategoryId),
    ...result,
  }
}

export async function updateNavigationSite(
  siteId: string,
  update: SitePatch & Partial<SiteTarget>
) {
  validateSiteFields(update, false)
  const data = await loadNavigationData()
  const source = findSiteLocation(data, siteId)
  if (!source) throw new NavigationSiteMutationError('Site not found', 404)

  const sourceItem = getItemsAtLocation(data, source)[source.itemIndex]
  const targetCategoryId = update.targetCategoryId ||
    data.navigationItems[source.categoryIndex].id
  const targetSubCategoryId = update.targetSubCategoryId === undefined
    ? getSourceSubCategoryId(data, source)
    : normalizeSubCategoryId(update.targetSubCategoryId)
  const updatedData = cloneNavigationData(data)
  const target = resolveTarget(updatedData, {
    targetCategoryId,
    targetSubCategoryId,
  })
  const updatedItem: NavigationSubItem = {
    ...sourceItem,
    ...pickSitePatch(update),
    id: siteId,
  }
  const sourceItems = getItemsAtLocation(updatedData, source)
  const staysInSameLocation =
    source.categoryIndex === target.categoryIndex &&
    source.subCategoryIndex === target.subCategoryIndex

  if (staysInSameLocation) {
    sourceItems[source.itemIndex] = updatedItem
  } else {
    sourceItems.splice(source.itemIndex, 1)
    getTargetItems(updatedData, target).push(updatedItem)
  }

  const result = await saveNavigationData(updatedData, `Update site: ${siteId}`)
  return {
    item: updatedItem,
    moved: !staysInSameLocation,
    targetCategoryId,
    targetSubCategoryId,
    ...result,
  }
}

export async function deleteNavigationSites(siteIds: string[]) {
  const ids = normalizeSiteIds(siteIds)
  const data = await loadNavigationData()
  const updatedData = cloneNavigationData(data)
  const deletedIds = removeSites(updatedData, ids)

  if (deletedIds.length === 0) {
    throw new NavigationSiteMutationError('Site not found', 404)
  }

  const result = await saveNavigationData(
    updatedData,
    `Delete ${deletedIds.length} site(s)`
  )
  return { deletedIds, deletedCount: deletedIds.length, ...result }
}

export async function batchUpdateNavigationSites(input: {
  siteIds: string[]
  operation: BatchSiteOperation
  targetCategoryId?: string
  targetSubCategoryId?: string | null
}) {
  const ids = normalizeSiteIds(input.siteIds)
  if (input.operation === 'delete') return deleteNavigationSites(ids)

  const data = await loadNavigationData()
  const updatedData = cloneNavigationData(data)

  if (input.operation === 'move') {
    if (!input.targetCategoryId) {
      throw new NavigationSiteMutationError('Target category is required')
    }

    const target = resolveTarget(updatedData, {
      targetCategoryId: input.targetCategoryId,
      targetSubCategoryId: input.targetSubCategoryId,
    })
    const selectedIds = new Set(ids)
    const selectedItems = new Map<string, NavigationSubItem>()
    forEachSite(updatedData, (item) => {
      if (selectedIds.has(item.id)) selectedItems.set(item.id, item)
      return item
    })
    removeSites(updatedData, ids)
    const movedItems = ids.flatMap(id => {
      const item = selectedItems.get(id)
      return item ? [item] : []
    })
    if (movedItems.length === 0) {
      throw new NavigationSiteMutationError('Site not found', 404)
    }

    getTargetItems(updatedData, target).push(...movedItems)
    const result = await saveNavigationData(
      updatedData,
      `Move ${movedItems.length} site(s)`
    )
    return {
      updatedIds: movedItems.map(item => item.id),
      updatedCount: movedItems.length,
      targetCategoryId: input.targetCategoryId,
      targetSubCategoryId: normalizeSubCategoryId(input.targetSubCategoryId),
      ...result,
    }
  }

  const patch = getBatchPatch(input.operation)
  const selectedIds = new Set(ids)
  const updatedIds: string[] = []
  forEachSite(updatedData, (item) => {
    if (!selectedIds.has(item.id)) return item

    const nextItem = { ...item, ...patch }
    if (
      nextItem.enabled !== item.enabled ||
      nextItem.isPrivate !== item.isPrivate
    ) {
      updatedIds.push(item.id)
      return nextItem
    }
    return item
  })

  if (updatedIds.length === 0) {
    return { updatedIds, updatedCount: 0, saved: false, historyRecorded: false }
  }

  const result = await saveNavigationData(
    updatedData,
    `Batch ${input.operation}: ${updatedIds.length} site(s)`
  )
  return { updatedIds, updatedCount: updatedIds.length, ...result }
}

export async function reorderNavigationSites(input: {
  categoryId: string
  subCategoryId?: string | null
  orderedSiteIds: string[]
}) {
  if (!input.categoryId) {
    throw new NavigationSiteMutationError('Category is required')
  }

  const orderedIds = normalizeSiteIds(input.orderedSiteIds)
  if (orderedIds.length !== input.orderedSiteIds.length) {
    throw new NavigationSiteMutationError('Site order contains duplicate IDs')
  }

  const data = await loadNavigationData()
  const updatedData = cloneNavigationData(data)
  const target = resolveTarget(updatedData, {
    targetCategoryId: input.categoryId,
    targetSubCategoryId: input.subCategoryId,
  })
  const currentItems = getTargetItems(updatedData, target)
  const currentIds = currentItems.map(item => item.id)
  const orderedIdSet = new Set(orderedIds)

  if (
    orderedIds.length !== currentIds.length ||
    currentIds.some(id => !orderedIdSet.has(id))
  ) {
    throw new NavigationSiteMutationError(
      'Site order must contain every site in the selected category exactly once'
    )
  }

  const itemById = new Map(currentItems.map(item => [item.id, item]))
  const reorderedItems = orderedIds.map(id => itemById.get(id)!)
  setTargetItems(updatedData, target, reorderedItems)
  const result = await saveNavigationData(
    updatedData,
    `Reorder ${orderedIds.length} site(s)`
  )

  return { orderedSiteIds: orderedIds, ...result }
}

async function loadNavigationData() {
  return getFileContent(
    NAVIGATION_PATH,
    { bypassCache: true }
  ) as Promise<NavigationData>
}

function validateSiteFields(update: SitePatch, requireAll: boolean) {
  if (!update || typeof update !== 'object') {
    throw new NavigationSiteMutationError('Invalid site payload')
  }
  if ((requireAll || update.title !== undefined) && (typeof update.title !== 'string' || !update.title.trim())) {
    throw new NavigationSiteMutationError('Site title is required')
  }
  if ((requireAll || update.href !== undefined) && (typeof update.href !== 'string' || !update.href.trim())) {
    throw new NavigationSiteMutationError('Site URL is required')
  }
  if (update.description !== undefined && typeof update.description !== 'string') {
    throw new NavigationSiteMutationError('Invalid site description')
  }
  if (update.icon !== undefined && typeof update.icon !== 'string') {
    throw new NavigationSiteMutationError('Invalid site icon')
  }
  if (update.enabled !== undefined && typeof update.enabled !== 'boolean') {
    throw new NavigationSiteMutationError('Invalid enabled state')
  }
  if (update.isPrivate !== undefined && typeof update.isPrivate !== 'boolean') {
    throw new NavigationSiteMutationError('Invalid private state')
  }
}

function normalizeSiteIds(siteIds: string[]) {
  if (!Array.isArray(siteIds)) {
    throw new NavigationSiteMutationError('Site IDs must be an array')
  }
  const ids = [...new Set(siteIds.filter(id => typeof id === 'string' && id))]
  if (ids.length === 0) {
    throw new NavigationSiteMutationError('Select at least one site')
  }
  return ids
}

function normalizeSubCategoryId(value?: string | null) {
  return !value || value === 'none' ? undefined : value
}

function pickSitePatch(update: SitePatch) {
  const patch: SitePatch = {}
  if (update.title !== undefined) patch.title = update.title.trim()
  if (update.href !== undefined) patch.href = update.href.trim()
  if (update.description !== undefined) patch.description = update.description
  if (update.icon !== undefined) patch.icon = update.icon
  if (update.enabled !== undefined) patch.enabled = update.enabled
  if (update.isPrivate !== undefined) patch.isPrivate = update.isPrivate
  return patch
}

function getBatchPatch(operation: Exclude<BatchSiteOperation, 'delete' | 'move'>) {
  if (operation === 'enable') return { enabled: true }
  if (operation === 'disable') return { enabled: false }
  if (operation === 'private') return { isPrivate: true }
  return { isPrivate: false }
}

function cloneNavigationData(data: NavigationData): NavigationData {
  return {
    navigationItems: data.navigationItems.map(category => ({
      ...category,
      items: category.items ? [...category.items] : undefined,
      subCategories: category.subCategories?.map(subCategory => ({
        ...subCategory,
        items: subCategory.items ? [...subCategory.items] : undefined,
      })),
    })),
  }
}

function findSiteLocation(data: NavigationData, siteId: string): SiteLocation | null {
  for (let categoryIndex = 0; categoryIndex < data.navigationItems.length; categoryIndex += 1) {
    const category = data.navigationItems[categoryIndex]
    const itemIndex = category.items?.findIndex(item => item.id === siteId) ?? -1
    if (itemIndex >= 0) return { categoryIndex, itemIndex }

    for (let subCategoryIndex = 0; subCategoryIndex < (category.subCategories?.length || 0); subCategoryIndex += 1) {
      const subItemIndex = category.subCategories?.[subCategoryIndex].items?.findIndex(
        item => item.id === siteId
      ) ?? -1
      if (subItemIndex >= 0) {
        return { categoryIndex, subCategoryIndex, itemIndex: subItemIndex }
      }
    }
  }
  return null
}

function getItemsAtLocation(data: NavigationData, location: Omit<SiteLocation, 'itemIndex'>) {
  if (location.subCategoryIndex !== undefined) {
    return data.navigationItems[location.categoryIndex]
      .subCategories?.[location.subCategoryIndex].items || []
  }
  return data.navigationItems[location.categoryIndex].items || []
}

function getSourceSubCategoryId(data: NavigationData, location: SiteLocation) {
  if (location.subCategoryIndex === undefined) return undefined
  return data.navigationItems[location.categoryIndex]
    .subCategories?.[location.subCategoryIndex].id
}

function resolveTarget(data: NavigationData, target: SiteTarget) {
  if (!target.targetCategoryId) {
    throw new NavigationSiteMutationError('Target category is required')
  }
  const categoryIndex = data.navigationItems.findIndex(
    category => category.id === target.targetCategoryId
  )
  if (categoryIndex < 0) {
    throw new NavigationSiteMutationError('Target category not found')
  }
  const subCategoryId = normalizeSubCategoryId(target.targetSubCategoryId)
  const subCategoryIndex = subCategoryId
    ? data.navigationItems[categoryIndex].subCategories?.findIndex(
      subCategory => subCategory.id === subCategoryId
    )
    : undefined
  if (subCategoryId && (subCategoryIndex === undefined || subCategoryIndex < 0)) {
    throw new NavigationSiteMutationError('Target subcategory not found')
  }
  return { categoryIndex, subCategoryIndex }
}

function getTargetItems(
  data: NavigationData,
  target: { categoryIndex: number; subCategoryIndex?: number }
) {
  if (target.subCategoryIndex !== undefined) {
    const subCategory = data.navigationItems[target.categoryIndex]
      .subCategories?.[target.subCategoryIndex]
    if (!subCategory) throw new NavigationSiteMutationError('Target subcategory not found')
    subCategory.items ||= []
    return subCategory.items
  }
  const category = data.navigationItems[target.categoryIndex]
  category.items ||= []
  return category.items
}

function setTargetItems(
  data: NavigationData,
  target: { categoryIndex: number; subCategoryIndex?: number },
  items: NavigationSubItem[]
) {
  if (target.subCategoryIndex !== undefined) {
    const subCategory = data.navigationItems[target.categoryIndex]
      .subCategories?.[target.subCategoryIndex]
    if (!subCategory) throw new NavigationSiteMutationError('Target subcategory not found')
    subCategory.items = items
    return
  }
  data.navigationItems[target.categoryIndex].items = items
}

function removeSites(data: NavigationData, siteIds: string[]) {
  const selectedIds = new Set(siteIds)
  const deletedIds: string[] = []
  for (const category of data.navigationItems) {
    if (category.items) {
      category.items = category.items.filter(item => {
        if (!selectedIds.has(item.id)) return true
        deletedIds.push(item.id)
        return false
      })
    }
    for (const subCategory of category.subCategories || []) {
      if (subCategory.items) {
        subCategory.items = subCategory.items.filter(item => {
          if (!selectedIds.has(item.id)) return true
          deletedIds.push(item.id)
          return false
        })
      }
    }
  }
  return deletedIds
}

function forEachSite(
  data: NavigationData,
  updater: (item: NavigationSubItem) => NavigationSubItem
) {
  for (const category of data.navigationItems) {
    if (category.items) category.items = category.items.map(updater)
    for (const subCategory of category.subCategories || []) {
      if (subCategory.items) subCategory.items = subCategory.items.map(updater)
    }
  }
}
