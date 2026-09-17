'use client'

import Image from 'next/image'
import { useSiteMetadata } from '@/components/admin/use-site-metadata'
import { readAdminResponse, errorMessage } from '@/lib/admin-api-response'
import { isHttpUrl } from '@/lib/site-form-state'
import { deselectSiteIds, selectSiteIds } from '@/lib/site-selection'
import {
  SITE_FORM_DRAFT_STORAGE_KEY,
  createEmptySiteForm,
  formatSiteAliases,
  hasSiteFormChanges,
  parseSiteAliases,
  parseSiteFormDraft,
  type SiteFormDraft,
  type SiteFormValues,
} from '@/lib/site-draft'
import { DuplicateSiteNotice } from '@/components/admin/duplicate-site-notice'
import { SiteEditDialog } from '@/components/admin/site-edit-dialog'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from "@/registry/new-york/ui/button"
import { useToast } from "@/registry/new-york/hooks/use-toast"
import { Icons } from "@/components/icons"
import { Input } from "@/registry/new-york/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/registry/new-york/ui/dialog"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/new-york/ui/table"
import { Checkbox } from "@/registry/new-york/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/registry/new-york/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/new-york/ui/select"
import { Label } from "@/registry/new-york/ui/label"
import { Textarea } from "@/registry/new-york/ui/textarea"
import { Switch } from "@/registry/new-york/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/registry/new-york/ui/tooltip"

import { NavigationSubItem } from '@/types/navigation'
import { fileToDataUrl, uploadResourceImage } from '@/services/resource-api'
import { getSiteFormValidationError, updateSiteFromForm } from '@/services/navigation-site-api'

interface SubCategory {
  id: string
  title: string
  icon?: string
  items: NavigationSubItem[]
}

interface Category {
  id: string
  title: string
  icon?: string
  items: NavigationSubItem[]
  subCategories?: SubCategory[]
}

interface Site {
  id: string
  name: string
  url: string
  description?: string
  icon?: string
  aliases?: string[]
  enabled?: boolean
  isPrivate?: boolean
  createdAt: string
  updatedAt: string
}

type BatchOperation = 'enable' | 'disable' | 'private' | 'public' | 'move' | null
type DraftPrompt =
  | { type: 'discard'; form: 'add' | 'edit' }
  | { type: 'leave'; href: string }

type SiteListResponse = {
  navigationItems: Category[]
  totalSiteCount?: number
  siteCount?: number
  page?: number
  pageSize?: number
  totalPages?: number
  siteIds?: string[]
}

const readMutationResponse = readAdminResponse

function extractSites(navigationItems: Category[]): Site[] {
  const sites: Site[] = []

  for (const category of navigationItems) {
    for (const item of category.items || []) {
      sites.push({
        id: item.id,
        name: item.title,
        url: item.href,
        description: item.description,
        icon: item.icon,
        aliases: item.aliases,
        enabled: item.enabled ?? true,
        isPrivate: item.isPrivate ?? false,
        createdAt: '',
        updatedAt: '',
      })
    }

    for (const subCategory of category.subCategories || []) {
      for (const item of subCategory.items || []) {
        sites.push({
          id: item.id,
          name: item.title,
          url: item.href,
          description: item.description,
          icon: item.icon,
          aliases: item.aliases,
          enabled: item.enabled ?? true,
          isPrivate: item.isPrivate ?? false,
          createdAt: '',
          updatedAt: '',
        })
      }
    }
  }

  return sites
}

function SiteIcon({ site }: { site: Pick<Site, 'name' | 'icon'> }) {
  const [failedIcon, setFailedIcon] = useState<string | null>(null)
  const showIcon = Boolean(site.icon && failedIcon !== site.icon)

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white dark:bg-white/5">
      {showIcon ? (
        <Image
          src={site.icon!}
          alt=""
          width={20}
          height={20}
          unoptimized
          className="h-5 w-5 object-contain"
          onError={() => setFailedIcon(site.icon || null)}
        />
      ) : (
        <Icons.link className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      )}
    </span>
  )
}

function saveSiteFormDraft(draft: SiteFormDraft) {
  try {
    window.localStorage.setItem(SITE_FORM_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // Storage can be unavailable; the current in-memory form still remains intact.
  }
}

function clearSiteFormDraft() {
  try {
    window.localStorage.removeItem(SITE_FORM_DRAFT_STORAGE_KEY)
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function SiteListClient({
  initialData,
  initialCategoryId,
  initialSubCategoryId,
  initialQuery,
  initialStatus,
  initialEditId,
}: {
  initialData: SiteListResponse
  initialCategoryId: string
  initialSubCategoryId: string
  initialQuery: string
  initialStatus: string
  initialEditId?: string
}) {
  const { toast } = useToast()
  const [sites, setSites] = useState<Site[]>(() => extractSites(initialData.navigationItems || []))
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSites, setSelectedSites] = useState<string[]>([])
  const [isSelectingAllResults, setIsSelectingAllResults] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [draftPrompt, setDraftPrompt] = useState<DraftPrompt | null>(null)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const openedEditId = useRef('')
  const editBaselineRef = useRef<SiteFormValues>(createEmptySiteForm())
  const restoredDraftRef = useRef(false)
  const allowPageLeaveRef = useRef(false)
  const [navigationData, setNavigationData] = useState<Category[]>(initialData.navigationItems || [])
  const [totalSiteCount, setTotalSiteCount] = useState(initialData.totalSiteCount ?? initialData.siteCount ?? 0)
  const [resultSiteCount, setResultSiteCount] = useState(initialData.siteCount ?? 0)
  const [currentPage, setCurrentPage] = useState(initialData.page ?? 1)
  const [pageSize, setPageSize] = useState(initialData.pageSize ?? 25)
  const [totalPages, setTotalPages] = useState(initialData.totalPages ?? 1)
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategoryId)
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>(initialSubCategoryId)
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>(
    initialStatus === 'enabled' || initialStatus === 'disabled' ? initialStatus : 'all'
  )
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [showSortDialog, setShowSortDialog] = useState(false)
  const [sortCategoryId, setSortCategoryId] = useState('')
  const [sortSubCategoryId, setSortSubCategoryId] = useState('none')
  const [sortItems, setSortItems] = useState<NavigationSubItem[]>([])
  const [sortOriginalItemIds, setSortOriginalItemIds] = useState<string[]>([])
  const [isSortSaving, setIsSortSaving] = useState(false)
  const [isSortLoading, setIsSortLoading] = useState(false)
  const [isAddingSubmitting, setIsAddingSubmitting] = useState(false)
  const [isEditingSubmitting, setIsEditingSubmitting] = useState(false)
  const [showDeleteSiteDialog, setShowDeleteSiteDialog] = useState(false)
  const [deletingSite, setDeletingSite] = useState<Site | null>(null)
  const [isUploadingAddIcon, setIsUploadingAddIcon] = useState(false)
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)
  const [batchOperation, setBatchOperation] = useState<BatchOperation>(null)
  const [showBatchMoveDialog, setShowBatchMoveDialog] = useState(false)
  const [batchMoveCategoryId, setBatchMoveCategoryId] = useState('')
  const [batchMoveSubCategoryId, setBatchMoveSubCategoryId] = useState('none')
  const isInitialLoadingRef = useRef(false)
  const skipInitialFilterFetchRef = useRef(true)
  const siteRequestSequenceRef = useRef(0)
  const [newSite, setNewSite] = useState<SiteFormValues>(createEmptySiteForm)
  const [editSite, setEditSite] = useState<SiteFormValues>(createEmptySiteForm)

  const addMetadata = useSiteMetadata(newSite, setNewSite, showAddDialog && !isAddingSubmitting)
  const editMetadata = useSiteMetadata(editSite, setEditSite, showEditDialog && !isEditingSubmitting, editingSite?.url)
  const resetEditMetadata = editMetadata.reset
  const isFetchingAddMetadata = addMetadata.loading
  const [addError, setAddError] = useState('')
  const [editError, setEditError] = useState('')
  const addHasChanges = useMemo(
    () => hasSiteFormChanges(newSite, createEmptySiteForm()),
    [newSite]
  )
  const editHasChanges = useMemo(
    () => Boolean(editingSite) && hasSiteFormChanges(editSite, editBaselineRef.current),
    [editSite, editingSite]
  )
  const hasOpenUnsavedChanges = (showAddDialog && addHasChanges) || (showEditDialog && editHasChanges)

  useEffect(() => {
    if (restoredDraftRef.current) return
    restoredDraftRef.current = true

    let draft: SiteFormDraft | null = null
    try {
      draft = parseSiteFormDraft(window.localStorage.getItem(SITE_FORM_DRAFT_STORAGE_KEY))
    } catch {
      return
    }
    if (!draft) {
      clearSiteFormDraft()
      return
    }

    if (draft.kind === 'add') {
      addMetadata.reset()
      addMetadata.markEdited('name')
      addMetadata.markEdited('description')
      addMetadata.markEdited('icon')
      setNewSite(draft.values)
      setShowAddDialog(true)
    } else {
      editMetadata.reset()
      editMetadata.markEdited('name')
      editMetadata.markEdited('description')
      editMetadata.markEdited('icon')
      editBaselineRef.current = draft.baseline
      openedEditId.current = draft.siteId!
      setEditingSite({
        id: draft.siteId!,
        name: draft.baseline.name,
        url: draft.baseline.url,
        aliases: parseSiteAliases(draft.baseline.aliases),
        description: draft.baseline.description,
        icon: draft.baseline.icon,
        enabled: draft.baseline.enabled,
        isPrivate: draft.baseline.isPrivate,
        createdAt: '',
        updatedAt: '',
      })
      setEditSite(draft.values)
      setShowEditDialog(true)
    }

    toast({
      title: '已恢复草稿',
      description: `已恢复${draft.kind === 'add' ? '新增' : '编辑'}站点时未保存的内容`,
    })
  }, [addMetadata, editMetadata, toast])

  useEffect(() => {
    if (!showAddDialog || !addHasChanges) return
    saveSiteFormDraft({
      version: 1,
      kind: 'add',
      values: newSite,
      baseline: createEmptySiteForm(),
      savedAt: Date.now(),
    })
  }, [addHasChanges, newSite, showAddDialog])

  useEffect(() => {
    if (!showEditDialog || !editingSite || !editHasChanges) return
    saveSiteFormDraft({
      version: 1,
      kind: 'edit',
      siteId: editingSite.id,
      values: editSite,
      baseline: editBaselineRef.current,
      savedAt: Date.now(),
    })
  }, [editHasChanges, editSite, editingSite, showEditDialog])

  useEffect(() => {
    if (!hasOpenUnsavedChanges) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowPageLeaveRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    const handleLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      const target = event.target instanceof Element ? event.target : null
      const anchor = target?.closest<HTMLAnchorElement>('a[href]')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const nextUrl = new URL(anchor.href, window.location.href)
      if (nextUrl.href === window.location.href) return
      event.preventDefault()
      event.stopPropagation()
      setDraftPrompt({ type: 'leave', href: nextUrl.href })
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleLinkClick, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleLinkClick, true)
    }
  }, [hasOpenUnsavedChanges])

  const loadSiteList = useCallback(async (
    categoryId: string,
    subCategoryId: string,
    options: {
      fresh?: boolean
      page?: number
      pageSize?: number
      query?: string
      status?: 'all' | 'enabled' | 'disabled'
      all?: boolean
      idsOnly?: boolean
    } = {}
  ): Promise<SiteListResponse> => {
    const searchParams = new URLSearchParams()
    if (categoryId !== 'all') searchParams.set('categoryId', categoryId)
    if (subCategoryId !== 'all') searchParams.set('subCategoryId', subCategoryId)
    if (options.query) searchParams.set('query', options.query)
    if (options.status && options.status !== 'all') searchParams.set('status', options.status)
    if (options.page) searchParams.set('page', String(options.page))
    if (options.pageSize) searchParams.set('pageSize', String(options.pageSize))
    if (options.all) searchParams.set('all', '1')
    if (options.idsOnly) searchParams.set('idsOnly', '1')
    if (options.fresh) searchParams.set('fresh', '1')
    const queryString = searchParams.toString()
    const response = await fetch(`/api/navigation/sites${queryString ? `?${queryString}` : ''}`)
    return readAdminResponse<SiteListResponse>(response, '获取站点列表失败')
  }, [])

  const fetchSites = useCallback(async (fresh = true) => {
    const requestSequence = ++siteRequestSequenceRef.current
    if (!isInitialLoadingRef.current) setIsLoading(true);
    try {
      const data = await loadSiteList(categoryFilter, subCategoryFilter, {
        fresh,
        page: currentPage,
        pageSize,
        query: deferredSearchQuery,
        status: statusFilter,
      });
      if (requestSequence !== siteRequestSequenceRef.current) return
      const navigationItems = data.navigationItems || []

      // Store navigation data for category selection
      setNavigationData(navigationItems);
      setTotalSiteCount(data.totalSiteCount ?? data.siteCount ?? 0)
      setResultSiteCount(data.siteCount ?? 0)
      setCurrentPage(data.page ?? currentPage)
      setTotalPages(data.totalPages ?? 1)

      // Extract all sites from the navigation structure
      const allSites = extractSites(navigationItems);
      setSites(allSites);
    } catch (error) {
      if (requestSequence !== siteRequestSequenceRef.current) return
      console.error('Fetch error:', error);
      toast({
        title: "错误",
        description: errorMessage(error, '获取数据失败'),
        variant: "destructive"
      });
      setSites([]);
      setNavigationData([]);
      setTotalSiteCount(0);
      setResultSiteCount(0)
      setTotalPages(1)
    } finally {
      if (requestSequence === siteRequestSequenceRef.current) {
        setIsLoading(false);
        isInitialLoadingRef.current = false;
        setIsInitialLoading(false);
      }
    }
  }, [categoryFilter, currentPage, deferredSearchQuery, loadSiteList, pageSize, statusFilter, subCategoryFilter, toast]);

  useEffect(() => {
    if (skipInitialFilterFetchRef.current) {
      skipInitialFilterFetchRef.current = false
      return
    }

    void fetchSites(false)
  }, [fetchSites])

  const siteCategoryIndex = useMemo(() => {
    const index = new Map<string, {
      categoryId: string
      categoryName: string
      subCategoryId: string
      subCategoryName: string
    }>()

    for (const category of navigationData) {
      for (const item of category.items || []) {
        index.set(item.id, {
          categoryId: category.id,
          categoryName: category.title,
          subCategoryId: '',
          subCategoryName: '',
        })
      }
      for (const subCategory of category.subCategories || []) {
        for (const item of subCategory.items || []) {
          index.set(item.id, {
            categoryId: category.id,
            categoryName: category.title,
            subCategoryId: subCategory.id,
            subCategoryName: subCategory.title,
          })
        }
      }
    }

    return index
  }, [navigationData])

  // 获取站点所属的分类
  const getSiteCategory = (siteId: string): string => siteCategoryIndex.get(siteId)?.categoryId || ''

  // 获取站点的分类信息（用于显示）
  const getSiteCategoryInfo = (siteId: string): { categoryName: string; subCategoryName: string } => {
    const location = siteCategoryIndex.get(siteId)
    return location
      ? { categoryName: location.categoryName, subCategoryName: location.subCategoryName }
      : { categoryName: '', subCategoryName: '' }
  }

  const getSortItemsFromData = useCallback((
    data: Category[],
    categoryId: string,
    subCategoryId: string
  ): NavigationSubItem[] => {
    const category = data.find((item) => item.id === categoryId)
    if (!category) return []

    if (subCategoryId === 'none') {
      return [...(category.items || [])]
    }

    const subCategory = category.subCategories?.find((item) => item.id === subCategoryId)
    return [...(subCategory?.items || [])]
  }, [])

  const syncSortItems = useCallback(async (categoryId: string, subCategoryId: string) => {
    if (!categoryId) {
      setSortItems([])
      setSortOriginalItemIds([])
      return
    }

    setIsSortLoading(true)
    try {
      const data = await loadSiteList(categoryId, subCategoryId, { all: true })
      const scopedItems = getSortItemsFromData(data.navigationItems || [], categoryId, subCategoryId)
      setSortItems(scopedItems)
      setSortOriginalItemIds(scopedItems.map((item) => item.id))
    } catch (error) {
      console.error('Fetch sort items error:', error)
      setSortItems([])
      setSortOriginalItemIds([])
      toast({
        title: "错误",
        description: "加载排序数据失败",
        variant: "destructive"
      })
    } finally {
      setIsSortLoading(false)
    }
  }, [getSortItemsFromData, loadSiteList, toast])

  const getInitialSortScope = useCallback(() => {
    const firstCategoryWithSites = navigationData.find((category) =>
      (category.items?.length || 0) > 0 ||
      category.subCategories?.some((subCategory) => (subCategory.items?.length || 0) > 0)
    )
    const categoryId = categoryFilter !== 'all'
      ? categoryFilter
      : firstCategoryWithSites?.id || navigationData[0]?.id || ''

    if (!categoryId) {
      return { categoryId: '', subCategoryId: 'none' }
    }

    if (categoryFilter !== 'all' && subCategoryFilter !== 'all') {
      return {
        categoryId,
        subCategoryId: subCategoryFilter || 'none'
      }
    }

    const category = navigationData.find((item) => item.id === categoryId)
    if ((category?.items?.length || 0) > 0) {
      return { categoryId, subCategoryId: 'none' }
    }

    const firstSubCategoryWithSites = category?.subCategories?.find(
      (subCategory) => (subCategory.items?.length || 0) > 0
    )

    return {
      categoryId,
      subCategoryId: firstSubCategoryWithSites?.id || 'none'
    }
  }, [categoryFilter, navigationData, subCategoryFilter])

  const openSortDialog = () => {
    const { categoryId, subCategoryId } = getInitialSortScope()
    setSortCategoryId(categoryId)
    setSortSubCategoryId(subCategoryId)
    void syncSortItems(categoryId, subCategoryId)
    setShowSortDialog(true)
  }

  const handleSortCategoryChange = (categoryId: string) => {
    setSortCategoryId(categoryId)
    setSortSubCategoryId('none')
    void syncSortItems(categoryId, 'none')
  }

  const handleSortSubCategoryChange = (subCategoryId: string) => {
    setSortSubCategoryId(subCategoryId)
    void syncSortItems(sortCategoryId, subCategoryId)
  }

  const moveSortItem = (fromIndex: number, toIndex: number) => {
    setSortItems((currentItems) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= currentItems.length ||
        toIndex >= currentItems.length
      ) {
        return currentItems
      }

      const nextItems = [...currentItems]
      const [movedItem] = nextItems.splice(fromIndex, 1)
      nextItems.splice(toIndex, 0, movedItem)
      return nextItems
    })
  }

  const handleSaveSort = async () => {
    if (!sortCategoryId || isSortSaving || isSortLoading) return

    setIsSortSaving(true)
    try {
      const response = await fetch('/api/navigation/sites', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId: sortCategoryId,
          subCategoryId: sortSubCategoryId,
          orderedSiteIds: sortItems.map(item => item.id),
        }),
      })
      await readMutationResponse(response, '保存排序失败')

      await fetchSites()
      setSortOriginalItemIds(sortItems.map((item) => item.id))
      setShowSortDialog(false)

      toast({
        title: "成功",
        description: "站点排序已保存",
      })
    } catch (error) {
      console.error('Save site order error:', error)
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : '保存排序失败',
        variant: "destructive"
      })
    } finally {
      setIsSortSaving(false)
    }
  }

  const filteredSites = sites
  const currentPageSiteIds = useMemo(() => filteredSites.map(site => site.id), [filteredSites])
  const selectedSiteIds = useMemo(() => new Set(selectedSites), [selectedSites])
  const selectedOnCurrentPage = currentPageSiteIds.filter(id => selectedSiteIds.has(id)).length
  const isCurrentPageFullySelected = currentPageSiteIds.length > 0 && selectedOnCurrentPage === currentPageSiteIds.length
  const isCurrentPagePartiallySelected = selectedOnCurrentPage > 0 && !isCurrentPageFullySelected
  const isAllResultsSelected = resultSiteCount > 0 && selectedSites.length === resultSiteCount

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (event.defaultPrevented || event.isComposing ||
        target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]') ||
        document.querySelector('[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"]')) return
      // Delete 键删除选中的站点
      if (event.key === 'Delete' && selectedSites.length > 0 && !showDeleteDialog) {
        event.preventDefault()
        setShowDeleteDialog(true)
      }
      // Escape 键取消选择
      if (event.key === 'Escape' && selectedSites.length > 0) {
        event.preventDefault()
        setSelectedSites([])
      }
      // Ctrl+A 处理
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        const activeElement = document.activeElement
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.hasAttribute('contenteditable')
        )

        // 如果有弹窗打开或者输入框有焦点，让浏览器处理默认行为（选中输入框内容）
        if (showAddDialog || showEditDialog || isInputFocused) {
          return // 不阻止默认行为，让输入框正常选中内容
        }

        // 只有在主列表区域且有站点时才全选站点
        if (filteredSites.length > 0) {
          event.preventDefault()
          setSelectedSites(current => selectSiteIds(current, currentPageSiteIds))
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedSites, showDeleteDialog, filteredSites, currentPageSiteIds, showAddDialog, showEditDialog])

  const handleSelectAll = (checked: boolean | string) => {
    if (checked === true) {
      setSelectedSites(current => selectSiteIds(current, currentPageSiteIds))
    } else {
      setSelectedSites(current => deselectSiteIds(current, currentPageSiteIds))
    }
  }

  const handleSelectOne = (checked: boolean | string, siteId: string) => {
    if (checked === true) {
      setSelectedSites(current => current.includes(siteId) ? current : [...current, siteId])
    } else {
      setSelectedSites(current => current.filter(id => id !== siteId))
    }
  }

  const handleSelectAllResults = async () => {
    if (isSelectingAllResults || isLoading || resultSiteCount === 0) return
    setIsSelectingAllResults(true)
    try {
      const data = await loadSiteList(categoryFilter, subCategoryFilter, {
        all: true,
        idsOnly: true,
        query: deferredSearchQuery,
        status: statusFilter,
      })
      setSelectedSites(data.siteIds || [])
    } catch (error) {
      toast({
        title: '错误',
        description: errorMessage(error, '选择全部筛选结果失败'),
        variant: 'destructive',
      })
    } finally {
      setIsSelectingAllResults(false)
    }
  }

  const handleBatchDelete = async () => {
    if (isBatchDeleting) return

    setIsBatchDeleting(true)
    try {
      const response = await fetch('/api/navigation/sites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'delete', siteIds: selectedSites }),
      })
      const result = await readMutationResponse<{ deletedIds: string[]; deletedCount: number }>(
        response,
        '批量删除失败'
      )
      await fetchSites()

      toast({
        title: "成功",
        description: `已删除选中的 ${result.deletedCount} 个站点`,
      })

      setSelectedSites([])
    } catch (error) {
      console.error('Batch delete error:', error)
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "批量删除失败",
        variant: "destructive"
      })
    } finally {
      setIsBatchDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleAddSite = async () => {
    // 防止重复提交
    if (isAddingSubmitting) {
      return
    }

    if (!newSite.name.trim() || !newSite.url.trim() || !newSite.categoryId) {
      const missing = [!newSite.name.trim() && '站点名称', !newSite.url.trim() && '站点链接', !newSite.categoryId && '所属分类'].filter(Boolean)
      const message = `请填写${missing.join('、')}`
      setAddError(message)
      toast({
        title: "错误",
        description: message,
        variant: "destructive"
      })
      return
    }

    setAddError('')
    setIsAddingSubmitting(true)
    try {
      const response = await fetch('/api/navigation/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSite.name,
          href: newSite.url,
          aliases: parseSiteAliases(newSite.aliases),
          description: newSite.description,
          icon: newSite.icon,
          enabled: newSite.enabled,
          isPrivate: newSite.isPrivate,
          targetCategoryId: newSite.categoryId,
          targetSubCategoryId: newSite.subCategoryId || null,
        }),
      })
      await readMutationResponse<{
        item: NavigationSubItem
        targetCategoryId: string
        targetSubCategoryId?: string
      }>(response, '添加站点失败')
      await fetchSites()

      toast({
        title: "成功",
        description: "站点添加成功",
      })

      // Reset only after a successful save.
      clearSiteFormDraft()
      addMetadata.reset()
      setNewSite(createEmptySiteForm())
      setShowAddDialog(false)

    } catch (error) {
      setAddError(errorMessage(error, '添加站点失败'))
      console.error('Add site error:', error)
      toast({
        title: "错误",
        description: errorMessage(error, '添加站点失败'),
        variant: "destructive"
      })
    } finally {
      setIsAddingSubmitting(false)
    }
  }

  const handleEditSite = async () => {
    // 防止重复提交
    if (isEditingSubmitting) {
      return
    }

    if (!editingSite) {
      const message = '站点已不存在，请刷新列表'
      setEditError(message)
      toast({ title: '错误', description: message, variant: 'destructive' })
      return
    }

    const validationError = getSiteFormValidationError(editSite)
    if (validationError) {
      const message = validationError
      setEditError(message)
      toast({
        title: "错误",
        description: message,
        variant: "destructive"
      })
      return
    }

    setEditError('')
    setIsEditingSubmitting(true)
    try {
      await updateSiteFromForm(editingSite.id, editSite)

      await fetchSites()

      toast({
        title: "成功",
        description: "站点更新成功",
      })

      // Reset form and close dialog
      clearSiteFormDraft()
      setEditSite(createEmptySiteForm())
      setEditingSite(null)
      setShowEditDialog(false)

    } catch (error) {
      setEditError(errorMessage(error, '更新站点失败'))
      console.error('Edit site error:', error)
      toast({
        title: "错误",
        description: errorMessage(error, '更新站点失败'),
        variant: "destructive"
      })
    } finally {
      setIsEditingSubmitting(false)
    }
  }

  const openEditDialog = useCallback((site: Site) => {
    setEditingSite(site)

    // Find the category and subcategory for this site, and get the icon
    let categoryId = ''
    let subCategoryId = ''
    let icon = ''
    let enabled = site.enabled ?? true
    let isPrivate = site.isPrivate ?? false

    for (const category of navigationData) {
      // Check main category items
      const mainItem = category.items?.find(item => item.id === site.id)
      if (mainItem) {
        categoryId = category.id
        icon = mainItem.icon || ''
        enabled = mainItem.enabled ?? true
        isPrivate = mainItem.isPrivate ?? false
        break
      }
      // Check subcategory items
      if (category.subCategories) {
        for (const subCategory of category.subCategories) {
          const subItem = subCategory.items?.find(item => item.id === site.id)
          if (subItem) {
            categoryId = category.id
            subCategoryId = subCategory.id
            icon = subItem.icon || ''
            enabled = subItem.enabled ?? true
            isPrivate = subItem.isPrivate ?? false
            break
          }
        }
        if (categoryId) break
      }
    }

    const formValues: SiteFormValues = {
      name: site.name,
      url: site.url,
      aliases: formatSiteAliases(site.aliases),
      description: site.description || '',
      icon: icon,
      categoryId,
      subCategoryId,
      enabled,
      isPrivate,
    }

    resetEditMetadata()
    setEditError('')
    editBaselineRef.current = formValues
    setEditSite(formValues)
    setShowEditDialog(true)
  }, [navigationData, resetEditMetadata])

  const discardAddDraft = () => {
    if (isAddingSubmitting) return
    clearSiteFormDraft()
    addMetadata.reset()
    setAddError('')
    setNewSite(createEmptySiteForm())
    setShowAddDialog(false)
  }

  const discardEditDraft = () => {
    if (isEditingSubmitting) return
    clearSiteFormDraft()
    editMetadata.reset()
    setEditError('')
    setEditSite(createEmptySiteForm())
    setEditingSite(null)
    setShowEditDialog(false)
  }

  const closeAddDialog = () => {
    if (isAddingSubmitting) return
    if (addHasChanges) {
      setDraftPrompt({ type: 'discard', form: 'add' })
      return
    }
    discardAddDraft()
  }

  const closeEditDialog = () => {
    if (isEditingSubmitting) return
    if (editHasChanges) {
      setDraftPrompt({ type: 'discard', form: 'edit' })
      return
    }
    discardEditDraft()
  }

  const confirmDraftPrompt = () => {
    if (!draftPrompt) return
    if (draftPrompt.type === 'leave') {
      allowPageLeaveRef.current = true
      window.location.assign(draftPrompt.href)
      return
    }
    if (draftPrompt.form === 'add') discardAddDraft()
    else discardEditDraft()
    setDraftPrompt(null)
  }

  useEffect(() => {
    if (!initialEditId || openedEditId.current === initialEditId) return
    const site = sites.find(item => item.id === initialEditId)
    if (site) {
      openedEditId.current = initialEditId
      openEditDialog(site)
    }
  }, [initialEditId, openEditDialog, sites])

  const handleDeleteSite = async () => {
    if (!deletingSite) return

    try {
      const response = await fetch(
        `/api/navigation/sites/${encodeURIComponent(deletingSite.id)}`,
        { method: 'DELETE' }
      )
      await readMutationResponse<{ deletedIds: string[] }>(
        response,
        '删除站点失败'
      )
      await fetchSites()

      toast({
        title: "成功",
        description: "站点删除成功",
      })

      // Close dialog
      setSelectedSites(current => current.filter(id => id !== deletingSite.id))
      setShowDeleteSiteDialog(false)
      setDeletingSite(null)
    } catch (error) {
      console.error('Delete site error:', error)
      toast({
        title: "错误",
        description: errorMessage(error, '删除站点失败'),
        variant: "destructive"
      })
    }
  }

  const openDeleteDialog = (site: Site) => {
    setDeletingSite(site)
    setShowDeleteSiteDialog(true)
  }

  // 描述显示组件
  const DescriptionCell = ({ description }: { description?: string }) => {
    if (!description) return <span className="text-muted-foreground">-</span>

    const maxLength = 50
    const isLong = description.length > maxLength
    const truncated = isLong ? description.substring(0, maxLength) + '...' : description

    if (!isLong) {
      return (
        <span className="block max-w-full truncate text-sm" title={description}>
          {description}
        </span>
      )
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block max-w-full cursor-help truncate text-sm transition-colors hover:text-primary">
            {truncated}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="whitespace-pre-wrap">{description}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const SiteStatusCell = ({ site }: { site: Site }) => (
    <div className="flex flex-wrap gap-1">
      {site.enabled === false ? (
        <span className="inline-flex items-center rounded-full border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
          已禁用
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-700 dark:text-emerald-300">
          已启用
        </span>
      )}
      {site.isPrivate ? (
        <span className="inline-flex items-center rounded-full border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-700 dark:text-amber-300">
          私密
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 dark:border-blue-700 dark:text-blue-300">
          公开
        </span>
      )}
    </div>
  )

  const isValidUrl = isHttpUrl
  const fetchWebsiteMetadata = (url: string) => addMetadata.fetchMetadata(url)

  const handleIconUpload = async (file: File) => {
    const uploadedUrl = newSite.url
    const initialIcon = newSite.icon
    addMetadata.markEdited('icon')

    try {
      setIsUploadingAddIcon(true)

      const data = await uploadResourceImage(await fileToDataUrl(file))

      if (data.imageUrl) {
        setNewSite(current => current.url === uploadedUrl && current.icon === initialIcon
          ? { ...current, icon: data.imageUrl! } : current)
        toast({
          title: "成功",
          description: "图标上传成功",
        })
      } else {
        throw new Error('未获取到上传后的图片URL')
      }

    } catch (error) {
      console.error('上传失败:', error)
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : '上传失败，请重试',
        variant: "destructive"
      })
    } finally {
      setIsUploadingAddIcon(false)
    }
  }

  const getBatchOperationLabel = (operation: Exclude<BatchOperation, null>) => {
    const labels: Record<Exclude<BatchOperation, null>, string> = {
      enable: '启用',
      disable: '禁用',
      private: '设为私有',
      public: '设为公开',
      move: '移动分类',
    }

    return labels[operation]
  }

  const handleBatchBooleanUpdate = async (
    operation: 'enable' | 'disable' | 'private' | 'public'
  ) => {
    if (selectedSites.length === 0 || batchOperation) return

    setBatchOperation(operation)
    try {
      const response = await fetch('/api/navigation/sites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, siteIds: selectedSites }),
      })
      const result = await readMutationResponse<{
        updatedIds: string[]
        updatedCount: number
      }>(response, `批量${getBatchOperationLabel(operation)}失败`)
      if (result.updatedCount > 0) {
        await fetchSites()
      }

      toast({
        title: result.updatedCount > 0 ? "成功" : "完成",
        description: `已${getBatchOperationLabel(operation)} ${result.updatedCount} 个站点`,
      })
    } catch (error) {
      console.error('Batch boolean update error:', error)
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : `批量${getBatchOperationLabel(operation)}失败`,
        variant: "destructive"
      })
    } finally {
      setBatchOperation(null)
    }
  }

  const openBatchMoveDialog = () => {
    const firstSelectedSiteId = selectedSites[0]
    const currentCategoryId = firstSelectedSiteId ? getSiteCategory(firstSelectedSiteId) : ''
    const defaultCategoryId = categoryFilter !== 'all'
      ? categoryFilter
      : currentCategoryId || navigationData[0]?.id || ''

    setBatchMoveCategoryId(defaultCategoryId)
    setBatchMoveSubCategoryId('none')
    setShowBatchMoveDialog(true)
  }

  const handleBatchMove = async () => {
    if (!batchMoveCategoryId || selectedSites.length === 0 || batchOperation) return

    setBatchOperation('move')
    try {
      const response = await fetch('/api/navigation/sites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'move',
          siteIds: selectedSites,
          targetCategoryId: batchMoveCategoryId,
          targetSubCategoryId: batchMoveSubCategoryId,
        }),
      })
      const result = await readMutationResponse<{
        updatedIds: string[]
        updatedCount: number
      }>(response, '批量移动分类失败')
      await fetchSites()

      toast({
        title: "成功",
        description: `已移动 ${result.updatedCount} 个站点`,
      })

      setShowBatchMoveDialog(false)
      setSelectedSites([])
    } catch (error) {
      console.error('Batch move error:', error)
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "批量移动分类失败",
        variant: "destructive"
      })
    } finally {
      setBatchOperation(null)
    }
  }

  const selectedSortCategory = navigationData.find((category) => category.id === sortCategoryId)
  const sortSubCategories = selectedSortCategory?.subCategories || []
  const selectedBatchMoveCategory = navigationData.find((category) => category.id === batchMoveCategoryId)
  const batchMoveSubCategories = selectedBatchMoveCategory?.subCategories || []
  const isBatchWorking = Boolean(batchOperation) || isBatchDeleting || isSelectingAllResults
  const hasSortChanges =
    sortItems.length !== sortOriginalItemIds.length ||
    sortItems.some((item, index) => item.id !== sortOriginalItemIds[index])

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-muted-foreground">
                共 {resultSiteCount} 个匹配站点
                <span>，全站 {totalSiteCount} 个</span>
                {resultSiteCount > 0 && (
                  <span>，当前显示 {sites.length} 个</span>
                )}
              </span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <div className="relative w-full sm:max-w-sm">
                <Input
                  placeholder="搜索站点..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                    setSelectedSites([])
                  }}
                  className="pr-8"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
                    onClick={() => {
                      setSearchQuery('')
                      setCurrentPage(1)
                      setSelectedSites([])
                    }}
                  >
                    <Icons.x className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Select
                value={categoryFilter}
                onValueChange={(value) => {
                  setCategoryFilter(value)
                  setSubCategoryFilter('all') // 重置子分类筛选
                  setCurrentPage(1)
                  setSelectedSites([])
                }}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="按分类筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  {navigationData.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* 子分类筛选器 */}
              <Select
                value={subCategoryFilter}
                onValueChange={(value) => {
                  setSubCategoryFilter(value)
                  setCurrentPage(1)
                  setSelectedSites([])
                }}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="按子分类筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部子分类</SelectItem>
                  <SelectItem value="none">无子分类</SelectItem>
                  {categoryFilter !== 'all' &&
                    navigationData
                      .find(cat => cat.id === categoryFilter)
                      ?.subCategories?.map((subCategory) => (
                        <SelectItem key={subCategory.id} value={subCategory.id}>
                          {subCategory.title}
                        </SelectItem>
                      ))
                  }
                  {categoryFilter === 'all' &&
                    navigationData
                      .flatMap(cat => cat.subCategories || [])
                      .map((subCategory) => (
                        <SelectItem key={subCategory.id} value={subCategory.id}>
                          {subCategory.title}
                        </SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(value: 'all' | 'enabled' | 'disabled') => {
                  setStatusFilter(value)
                  setCurrentPage(1)
                  setSelectedSites([])
                }}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="按状态筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="enabled">已启用</SelectItem>
                  <SelectItem value="disabled">已禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-0 lg:justify-end">
            <Button
              variant="outline"
              onClick={openSortDialog}
              className="w-full whitespace-nowrap sm:w-auto"
              disabled={navigationData.length === 0 || isLoading}
            >
              <Icons.list className="mr-2 h-4 w-4" />
              站点排序
            </Button>

            <Dialog open={showAddDialog} onOpenChange={(open) => {
              if (open) setShowAddDialog(true)
              else closeAddDialog()
            }}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Icons.plus className="mr-2 h-4 w-4" />
                  添加站点
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]" data-preserve-form="true">
                <DialogHeader>
                  <DialogTitle>添加站点</DialogTitle>
                </DialogHeader>
                <FormSaveError message={addError || addMetadata.error} />
                <DuplicateSiteNotice url={newSite.url} enabled={showAddDialog}  />
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="url">站点链接 *</Label>
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1">
                        <Input
                          id="url"
                          value={newSite.url}
                          onChange={(e) => setNewSite({ ...newSite, url: e.target.value })}
                          placeholder="输入网站链接，将自动获取网站信息"
                          disabled={isAddingSubmitting}
                        />
                        {isFetchingAddMetadata && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <Icons.loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!newSite.url || !isValidUrl(newSite.url) || isFetchingAddMetadata || isAddingSubmitting}
                        aria-label={isFetchingAddMetadata ? '正在获取网站信息' : '重新获取网站信息'}
                        onClick={() => fetchWebsiteMetadata(newSite.url)}
                      >
                        {isFetchingAddMetadata ? (
                          <Icons.loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Icons.refresh className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      自动补充标题、描述和图标；手动修改过的字段会保留
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="name">站点名称 *</Label>
                    <Input
                      id="name"
                      value={newSite.name}
                      onChange={(e) => { addMetadata.markEdited('name'); setNewSite(current => ({ ...current, name: e.target.value })) }}
                      placeholder="站点名称（可自动获取）"
                      disabled={isAddingSubmitting}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="aliases">搜索别名</Label>
                    <Input
                      id="aliases"
                      value={newSite.aliases}
                      onChange={(event) => setNewSite(current => ({ ...current, aliases: event.target.value }))}
                      placeholder="多个别名用逗号分隔"
                      disabled={isAddingSubmitting}
                    />
                    <p className="text-xs text-muted-foreground">用于首页搜索，不会显示在导航卡片上</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="icon">站点图标</Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="flex-1 relative">
                        <Input
                          id="icon"
                          value={newSite.icon}
                          onChange={(e) => { addMetadata.markEdited('icon'); setNewSite(current => ({ ...current, icon: e.target.value })) }}
                          placeholder="图标URL（可自动获取）"
                          disabled={isAddingSubmitting}
                        />
                        {newSite.icon && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <Image
                              src={newSite.icon}
                              alt="图标预览"
                              width={16}
                              height={16}
                              unoptimized
                              className="w-4 h-4 object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="relative"
                        disabled={isAddingSubmitting || isUploadingAddIcon}
                        onClick={() => {
                          const fileInput = document.getElementById('add-icon-upload')
                          fileInput?.click()
                        }}
                      >
                        {isUploadingAddIcon ? (
                          <>
                            <Icons.loader2 className="mr-2 h-4 w-4 animate-spin" />
                            上传中...
                          </>
                        ) : (
                          <>
                            <Icons.upload className="mr-2 h-4 w-4" />
                            上传图片
                          </>
                        )}
                        <input
                          id="add-icon-upload"
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              await handleIconUpload(file)
                              // 清空文件输入
                              const fileInput = document.getElementById('add-icon-upload') as HTMLInputElement
                              if (fileInput) {
                                fileInput.value = ''
                              }
                            }
                          }}
                          className="hidden"
                        />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      输入站点链接后会自动获取并回填图标，也可手动输入 URL 或上传本地图片
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category">分类 *</Label>
                    <Select
                      value={newSite.categoryId}
                      onValueChange={(value) => {
                        setNewSite({ ...newSite, categoryId: value, subCategoryId: '' })
                      }}
                      disabled={isAddingSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择分类" />
                      </SelectTrigger>
                      <SelectContent>
                        {navigationData.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {newSite.categoryId && navigationData.find(cat => cat.id === newSite.categoryId)?.subCategories && (
                    <div className="grid gap-2">
                      <Label htmlFor="subcategory">子分类</Label>
                      <Select
                        value={newSite.subCategoryId || "none"}
                        onValueChange={(value) => setNewSite({ ...newSite, subCategoryId: value === "none" ? "" : value })}
                        disabled={isAddingSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择子分类（可选）" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">无子分类</SelectItem>
                          {navigationData
                            .find(cat => cat.id === newSite.categoryId)
                            ?.subCategories?.map((subCategory) => (
                              <SelectItem key={subCategory.id} value={subCategory.id}>
                                {subCategory.title}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="description">描述</Label>
                    <Textarea
                      id="description"
                      value={newSite.description}
                      onChange={(e) => { addMetadata.markEdited('description'); setNewSite(current => ({ ...current, description: e.target.value })) }}
                      placeholder="输入站点描述（可选）"
                      className="resize-none"
                      disabled={isAddingSubmitting}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="is-enabled">是否启用</Label>
                      <p className="text-xs text-muted-foreground">关闭后前台不会展示该站点</p>
                    </div>
                    <Switch
                      id="is-enabled"
                      checked={newSite.enabled}
                      onCheckedChange={(checked) => setNewSite({ ...newSite, enabled: checked })}
                      disabled={isAddingSubmitting}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="is-private">是否私密</Label>
                      <p className="text-xs text-muted-foreground">开启后仅后台登录用户可见</p>
                    </div>
                    <Switch
                      id="is-private"
                      checked={newSite.isPrivate}
                      onCheckedChange={(checked) => setNewSite({ ...newSite, isPrivate: checked })}
                      disabled={isAddingSubmitting}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeAddDialog}
                    disabled={isAddingSubmitting}
                  >
                    取消
                  </Button>
                  <Button onClick={handleAddSite} disabled={isAddingSubmitting}>
                    {isAddingSubmitting && (
                      <Icons.loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isAddingSubmitting ? "添加中..." : "添加站点"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showSortDialog} onOpenChange={(open) => {
              if (!open && !isSortSaving && !isSortLoading) {
                setShowSortDialog(false)
              }
            }}>
              <DialogContent className="sm:max-w-[720px]">
                <DialogHeader>
                  <DialogTitle>站点排序</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="sort-category">一级分类</Label>
                      <Select
                        value={sortCategoryId}
                        onValueChange={handleSortCategoryChange}
                        disabled={isSortSaving || isSortLoading}
                      >
                        <SelectTrigger id="sort-category">
                          <SelectValue placeholder="选择一级分类" />
                        </SelectTrigger>
                        <SelectContent>
                          {navigationData.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sort-subcategory">排序范围</Label>
                      <Select
                        value={sortSubCategoryId}
                        onValueChange={handleSortSubCategoryChange}
                        disabled={!sortCategoryId || isSortSaving || isSortLoading}
                      >
                        <SelectTrigger id="sort-subcategory">
                          <SelectValue placeholder="选择排序范围" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">一级分类直属站点</SelectItem>
                          {sortSubCategories.map((subCategory) => (
                            <SelectItem key={subCategory.id} value={subCategory.id}>
                              {subCategory.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-md border">
                    <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                      <span className="min-w-0 truncate text-sm font-medium">
                        当前范围：{selectedSortCategory?.title || '-'}
                        {sortSubCategoryId !== 'none' && (
                          <span>
                            {' / '}
                            {sortSubCategories.find((item) => item.id === sortSubCategoryId)?.title || '-'}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {sortItems.length} 个站点
                      </span>
                    </div>

                    {isSortLoading ? (
                      <div className="flex min-h-[180px] items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground">
                        <Icons.loader2 className="mr-2 h-4 w-4 animate-spin" />
                        正在加载排序数据...
                      </div>
                    ) : sortItems.length > 0 ? (
                      <div className="max-h-[420px] divide-y overflow-y-auto">
                        {sortItems.map((item, index) => (
                          <div key={item.id} className="flex items-center gap-3 px-3 py-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/30">
                              {item.icon ? (
                                <Image
                                  src={item.icon}
                                  alt=""
                                  width={20}
                                  height={20}
                                  unoptimized
                                  className="h-5 w-5 object-contain"
                                  onError={(event) => {
                                    const target = event.target as HTMLImageElement
                                    target.style.display = 'none'
                                  }}
                                />
                              ) : (
                                <Icons.link className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium" title={item.title}>
                                {item.title}
                              </div>
                              <div className="truncate text-xs text-muted-foreground" title={item.href}>
                                {item.href}
                              </div>
                            </div>
                            <div className="hidden shrink-0 sm:block">
                              <SiteStatusCell
                                site={{
                                  id: item.id,
                                  name: item.title,
                                  url: item.href,
                                  description: item.description,
                                  enabled: item.enabled,
                                  isPrivate: item.isPrivate,
                                  createdAt: '',
                                  updatedAt: ''
                                }}
                              />
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="置顶"
                                disabled={index === 0 || isSortSaving || isSortLoading}
                                onClick={() => moveSortItem(index, 0)}
                              >
                                <Icons.chevronsUp className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="上移"
                                disabled={index === 0 || isSortSaving || isSortLoading}
                                onClick={() => moveSortItem(index, index - 1)}
                              >
                                <Icons.arrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="下移"
                                disabled={index === sortItems.length - 1 || isSortSaving || isSortLoading}
                                onClick={() => moveSortItem(index, index + 1)}
                              >
                                <Icons.arrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="置底"
                                disabled={index === sortItems.length - 1 || isSortSaving || isSortLoading}
                                onClick={() => moveSortItem(index, sortItems.length - 1)}
                              >
                                <Icons.chevronsDown className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-[180px] items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground">
                        当前范围暂无站点
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSortDialog(false)}
                    disabled={isSortSaving || isSortLoading}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleSaveSort}
                    disabled={!hasSortChanges || isSortSaving || isSortLoading}
                  >
                    {isSortSaving && (
                      <Icons.loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isSortSaving ? "保存中..." : "保存排序"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <SiteEditDialog
              open={showEditDialog}
              values={editSite}
              setValues={setEditSite}
              siteId={editingSite?.id}
              categories={navigationData}
              metadata={editMetadata}
              error={editError}
              submitting={isEditingSubmitting}
              callbackUrl="/admin/sitelist"
              onClose={closeEditDialog}
              onSubmit={handleEditSite}
            />
          </div>
        </div>



        {/* 选择状态栏 */}
        {selectedSites.length > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/20 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Icons.check className="h-4 w-4 shrink-0 text-blue-600" />
              <span className="min-w-0 text-sm font-medium text-blue-900 dark:text-blue-100">
                已选择 {selectedSites.length} 个站点
              </span>
              {isCurrentPageFullySelected && !isAllResultsSelected && resultSiteCount > currentPageSiteIds.length && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-1 text-blue-700 dark:text-blue-200"
                  onClick={() => void handleSelectAllResults()}
                  disabled={isSelectingAllResults || isLoading}
                >
                  {isSelectingAllResults && <Icons.loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  选择全部 {resultSiteCount} 个匹配站点
                </Button>
              )}
              {isAllResultsSelected && (
                <span className="text-xs text-blue-700 dark:text-blue-200">已选择全部筛选结果</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchBooleanUpdate('enable')}
                disabled={isBatchWorking}
                className="border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-100 dark:hover:bg-blue-900/40"
              >
                {batchOperation === 'enable' ? (
                  <Icons.loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icons.check className="mr-2 h-4 w-4" />
                )}
                启用
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchBooleanUpdate('disable')}
                disabled={isBatchWorking}
                className="border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-100 dark:hover:bg-blue-900/40"
              >
                {batchOperation === 'disable' ? (
                  <Icons.loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icons.x className="mr-2 h-4 w-4" />
                )}
                禁用
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openBatchMoveDialog}
                disabled={isBatchWorking || navigationData.length === 0}
                className="border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-100 dark:hover:bg-blue-900/40"
              >
                {batchOperation === 'move' ? (
                  <Icons.loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icons.folderOpen className="mr-2 h-4 w-4" />
                )}
                移动分类
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchBooleanUpdate('private')}
                disabled={isBatchWorking}
                className="border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-100 dark:hover:bg-blue-900/40"
              >
                {batchOperation === 'private' ? (
                  <Icons.loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icons.shield className="mr-2 h-4 w-4" />
                )}
                设为私有
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchBooleanUpdate('public')}
                disabled={isBatchWorking}
                className="border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-100 dark:hover:bg-blue-900/40"
              >
                {batchOperation === 'public' ? (
                  <Icons.loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icons.globe className="mr-2 h-4 w-4" />
                )}
                设为公开
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedSites([])}
                disabled={isBatchWorking}
                className="border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-100 dark:hover:bg-blue-900/40"
              >
                取消选择
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isBatchWorking}
              >
                {isBatchDeleting ? (
                  <>
                    <Icons.loader2 className="mr-2 h-4 w-4 animate-spin" />
                    删除中...
                  </>
                ) : (
                  <>
                    <Icons.trash className="mr-2 h-4 w-4" />
                    删除选中
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {isInitialLoading ? (
          <div className="flex items-center justify-center h-[400px]">
            <Icons.loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : isLoading ? (
          <div className="opacity-50 pointer-events-none">
            <div className="rounded-md border">
              <Table className="min-w-[980px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          isCurrentPageFullySelected
                            ? true
                            : isCurrentPagePartiallySelected
                              ? 'indeterminate'
                              : false
                        }
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="w-[30%]">名称</TableHead>
                    <TableHead className="w-[22%]">链接</TableHead>
                    <TableHead className="w-[10%]">一级分类</TableHead>
                    <TableHead className="w-[10%]">二级分类</TableHead>
                    <TableHead className="w-[16%]">描述</TableHead>
                    <TableHead className="w-28">状态</TableHead>
                    <TableHead className="w-24 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSites.map((site) => (
                    <TableRow key={site.id}>
                      <TableCell className="w-12">
                        <Checkbox
                          checked={selectedSites.includes(site.id)}
                          onCheckedChange={(checked) => handleSelectOne(checked, site.id)}
                          aria-label={`Select ${site.name}`}
                        />
                      </TableCell>
                      <TableCell className="min-w-0 font-medium">
                        <div className="flex min-w-0 items-center gap-2">
                          <SiteIcon site={site} />
                          <span className="block min-w-0 truncate" title={site.name}>{site.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-0">
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block min-w-0 truncate text-sm text-blue-500 hover:text-blue-700 hover:underline"
                          title={site.url}
                        >
                          {site.url}
                        </a>
                      </TableCell>
                      <TableCell className="min-w-0">
                        <span
                          className="inline-block max-w-full truncate rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          title={getSiteCategoryInfo(site.id).categoryName || '-'}
                        >
                          {getSiteCategoryInfo(site.id).categoryName || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-0">
                        {getSiteCategoryInfo(site.id).subCategoryName ? (
                          <span
                            className="inline-block max-w-full truncate rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
                            title={getSiteCategoryInfo(site.id).subCategoryName}
                          >
                            {getSiteCategoryInfo(site.id).subCategoryName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="min-w-0">
                        <DescriptionCell description={site.description} />
                      </TableCell>
                      <TableCell className="w-28">
                        <SiteStatusCell site={site} />
                      </TableCell>
                      <TableCell className="w-24">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(site)}
                            title="编辑"
                          >
                            <Icons.pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => openDeleteDialog(site)}
                            title="删除"
                          >
                            <Icons.trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : filteredSites.length > 0 ? (
          <div className="rounded-md border">
            <Table className="min-w-[980px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        isCurrentPageFullySelected
                          ? true
                          : isCurrentPagePartiallySelected
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="w-[30%]">名称</TableHead>
                  <TableHead className="w-[22%]">链接</TableHead>
                  <TableHead className="w-[10%]">一级分类</TableHead>
                  <TableHead className="w-[10%]">二级分类</TableHead>
                  <TableHead className="w-[16%]">描述</TableHead>
                  <TableHead className="w-28">状态</TableHead>
                  <TableHead className="w-24 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSites.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell className="w-12">
                      <Checkbox
                        checked={selectedSites.includes(site.id)}
                        onCheckedChange={(checked) => handleSelectOne(checked, site.id)}
                        aria-label={`Select ${site.name}`}
                      />
                    </TableCell>
                    <TableCell className="min-w-0 font-medium">
                      <div className="flex min-w-0 items-center gap-2">
                        <SiteIcon site={site} />
                        <span className="block min-w-0 truncate" title={site.name}>{site.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0">
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block min-w-0 truncate text-sm text-blue-500 hover:text-blue-700 hover:underline"
                        title={site.url}
                      >
                        {site.url}
                      </a>
                    </TableCell>
                    <TableCell className="min-w-0">
                      <span
                        className="inline-block max-w-full truncate rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        title={getSiteCategoryInfo(site.id).categoryName || '-'}
                      >
                        {getSiteCategoryInfo(site.id).categoryName || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-0">
                      {getSiteCategoryInfo(site.id).subCategoryName ? (
                        <span
                          className="inline-block max-w-full truncate rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
                          title={getSiteCategoryInfo(site.id).subCategoryName}
                        >
                          {getSiteCategoryInfo(site.id).subCategoryName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-0">
                      <DescriptionCell description={site.description} />
                    </TableCell>
                    <TableCell className="w-28">
                      <SiteStatusCell site={site} />
                    </TableCell>
                    <TableCell className="w-24">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(site)}
                          title="编辑"
                        >
                          <Icons.pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => openDeleteDialog(site)}
                          title="删除"
                        >
                          <Icons.trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Icons.search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {totalSiteCount === 0 ? "暂无站点" : "未找到匹配的站点"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {totalSiteCount === 0
                ? "开始添加您的第一个站点吧"
                : "尝试调整搜索条件或筛选器"
              }
            </p>
            {totalSiteCount === 0 && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Icons.plus className="mr-2 h-4 w-4" />
                添加站点
              </Button>
            )}
            {totalSiteCount > 0 && resultSiteCount === 0 && (
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('')
                    setCategoryFilter('all')
                    setSubCategoryFilter('all')
                    setStatusFilter('all')
                    setCurrentPage(1)
                  }}
                >
                  清除筛选
                </Button>
              </div>
            )}
          </div>
        )}

        {resultSiteCount > 0 && (
          <div className="flex flex-col gap-3 rounded-md border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              第 {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, resultSiteCount)} 条，
              共 {resultSiteCount} 条
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-[108px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">每页 10 条</SelectItem>
                  <SelectItem value="25">每页 25 条</SelectItem>
                  <SelectItem value="50">每页 50 条</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => {
                  setCurrentPage(page => Math.max(1, page - 1))
                }}
              >
                上一页
              </Button>
              <span className="min-w-16 text-center text-sm">
                {currentPage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => {
                  setCurrentPage(page => Math.min(totalPages, page + 1))
                }}
              >
                下一页
              </Button>
            </div>
          </div>
        )}

        <Dialog open={showBatchMoveDialog} onOpenChange={(open) => {
          if (!open && batchOperation !== 'move') {
            setShowBatchMoveDialog(false)
          }
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>移动选中站点</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                将 {selectedSites.length} 个站点移动到目标分类末尾。
              </div>
              <div className="grid gap-2">
                <Label htmlFor="batch-move-category">一级分类</Label>
                <Select
                  value={batchMoveCategoryId}
                  onValueChange={(value) => {
                    setBatchMoveCategoryId(value)
                    setBatchMoveSubCategoryId('none')
                  }}
                  disabled={batchOperation === 'move'}
                >
                  <SelectTrigger id="batch-move-category">
                    <SelectValue placeholder="选择一级分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {navigationData.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="batch-move-subcategory">目标范围</Label>
                <Select
                  value={batchMoveSubCategoryId}
                  onValueChange={setBatchMoveSubCategoryId}
                  disabled={!batchMoveCategoryId || batchOperation === 'move'}
                >
                  <SelectTrigger id="batch-move-subcategory">
                    <SelectValue placeholder="选择目标范围" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">一级分类直属站点</SelectItem>
                    {batchMoveSubCategories.map((subCategory) => (
                      <SelectItem key={subCategory.id} value={subCategory.id}>
                        {subCategory.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowBatchMoveDialog(false)}
                disabled={batchOperation === 'move'}
              >
                取消
              </Button>
              <Button
                onClick={handleBatchMove}
                disabled={!batchMoveCategoryId || batchOperation === 'move'}
              >
                {batchOperation === 'move' && (
                  <Icons.loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {batchOperation === 'move' ? "移动中..." : "移动站点"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={Boolean(draftPrompt)}
          onOpenChange={(open) => { if (!open) setDraftPrompt(null) }}
        >
          <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md gap-0 overflow-hidden border-0 p-0 shadow-2xl">
            <div className="border-b bg-gradient-to-br from-amber-50 via-background to-background px-6 pb-5 pt-6 dark:from-amber-950/30">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-sm ring-1 ring-amber-200/70 dark:bg-amber-900/50 dark:text-amber-300 dark:ring-amber-800">
                <Icons.save className="h-5 w-5" aria-hidden="true" />
              </div>
              <AlertDialogHeader className="space-y-2 text-left">
                <AlertDialogTitle className="text-xl tracking-tight">
                  {draftPrompt?.type === 'leave' ? '要离开站点管理吗？' : '放弃未保存的更改？'}
                </AlertDialogTitle>
                <AlertDialogDescription className="leading-6">
                  {draftPrompt?.type === 'leave'
                    ? '当前表单尚未保存。离开后可以返回站点管理继续编辑。'
                    : `关闭后将删除这份${draftPrompt?.type === 'discard' && draftPrompt.form === 'edit' ? '编辑' : '新增'}草稿，刚才填写的内容无法恢复。`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-100/60 px-3.5 py-3 text-sm text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200">
                <Icons.check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {draftPrompt?.type === 'leave'
                    ? '草稿已自动保存在当前浏览器，有效期为 7 天。'
                    : '如果还需要这些内容，请选择继续编辑。'}
                </span>
              </div>
            </div>
            <AlertDialogFooter className="gap-2 bg-muted/20 px-6 py-4 sm:space-x-0">
              <AlertDialogCancel className="mt-0">
                {draftPrompt?.type === 'leave' ? '留在此页' : '继续编辑'}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDraftPrompt}
                className={draftPrompt?.type === 'discard'
                  ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                  : ''}
              >
                {draftPrompt?.type === 'leave' ? '保留草稿并离开' : '放弃并关闭'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
          if (!open && !isBatchDeleting) {
            setShowDeleteDialog(false)
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除选中的 {selectedSites.length} 个站点吗？此操作无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isBatchDeleting}>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBatchDelete}
                disabled={isBatchDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isBatchDeleting ? (
                  <>
                    <Icons.loader2 className="mr-2 h-4 w-4 animate-spin" />
                    删除中...
                  </>
                ) : (
                  '删除'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 删除单个站点对话框 */}
        <AlertDialog open={showDeleteSiteDialog} onOpenChange={setShowDeleteSiteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除站点</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除站点 &ldquo;{deletingSite?.name}&rdquo; 吗？此操作无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteSite}
                className="bg-red-600 hover:bg-red-700"
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}

function FormSaveError({ message }: { message: string }) {
  if (!message) return null
  return <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
    {message}
    {message.includes('登录已过期') && <a className="ml-2 underline" href="/auth/signin?callbackUrl=%2Fadmin%2Fsitelist" target="_blank" rel="noopener noreferrer">重新登录</a>}
  </div>
}
