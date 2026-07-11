'use client'

export const runtime = 'edge'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { Button } from "@/registry/new-york/ui/button"
import { useToast } from "@/registry/new-york/hooks/use-toast"
import {
  Plus,
  Folder,
  Search,
  X,
  ArrowLeft,
  List,
  Pencil,
  Trash,
  GripVertical,
  ChevronsUp,
  ChevronsDown
} from 'lucide-react'
import { NavigationItem, NavigationCategory } from '@/types/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/registry/new-york/ui/dialog"
import { Input } from "@/registry/new-york/ui/input"
import type {
  DragDropContextProps,
  DroppableProps,
  DraggableProps,
  DropResult,
  DraggableProvided,
  DraggableStateSnapshot,
} from '@hello-pangea/dnd'

import { Badge } from "@/registry/new-york/ui/badge"
import { Skeleton } from "@/registry/new-york/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/new-york/ui/select"

const AddCategoryForm = dynamic(
  () => import('../../components/AddCategoryForm').then(module => module.AddCategoryForm),
  { ssr: false }
)
const DragDropContext = dynamic<DragDropContextProps>(
  () => import('@hello-pangea/dnd').then(module => module.DragDropContext),
  {
    ssr: false,
    loading: () => <Skeleton className="h-24 w-full rounded-lg" />,
  }
)
const Droppable = dynamic<DroppableProps>(
  () => import('@hello-pangea/dnd').then(module => module.Droppable),
  { ssr: false }
)
const Draggable = dynamic<DraggableProps>(
  () => import('@hello-pangea/dnd').then(module => module.Draggable),
  { ssr: false }
)

export default function CategoriesPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const navigationId = params?.id
  const [navigation, setNavigation] = useState<NavigationItem | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [editingCategory, setEditingCategory] = useState<{ category: NavigationCategory } | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<{ category: NavigationCategory } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all')

  const fetchNavigation = useCallback(async () => {
    if (!navigationId) {
      throw new Error('Navigation ID not found')
    }

    try {
      setIsLoading(true)
      const response = await fetch(`/api/navigation/${navigationId}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setNavigation(data)
    } catch {
      toast({
        title: "错误",
        description: "加载数据失败",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }, [navigationId, toast])

  useEffect(() => {
    if (!navigationId) {
      router.push('/admin/navigation')
      return
    }
    fetchNavigation()
  }, [fetchNavigation, navigationId, router])

  const addCategory = async (values: {
    title: string,
    icon: string,
    description?: string,
    enabled: boolean
  }) => {
    if (!navigationId || !navigation) return

    try {
      const newCategory: NavigationCategory = {
        id: crypto.randomUUID(),
        title: values.title,
        icon: values.icon,
        description: values.description,
        enabled: values.enabled,
        items: []
      }

      const updatedNavigation: NavigationItem = {
        ...navigation,
        subCategories: [...(navigation.subCategories || []), newCategory]
      }

      const response = await fetch(`/api/navigation/${navigationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedNavigation)
      })

      if (!response.ok) throw new Error('Failed to save')

      await fetchNavigation()
      toast({
        title: "成功",
        description: "添加成功"
      })
      setIsAddDialogOpen(false)
    } catch (error) {
      console.error('Save error:', error)
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "保存失败",
        variant: "destructive"
      })
    }
  }

  const editCategory = async (values: {
    title: string,
    icon: string,
    description?: string,
    enabled: boolean
  }) => {
    if (!navigationId || !navigation || !editingCategory) return

    try {
      const updatedCategories = navigation.subCategories?.map((cat) =>
        cat.id === editingCategory.category.id
          ? {
            ...cat,
            title: values.title,
            icon: values.icon,
            description: values.description,
            enabled: values.enabled
          }
          : cat
      ) || []

      const updatedNavigation: NavigationItem = {
        ...navigation,
        subCategories: updatedCategories
      }

      const response = await fetch(`/api/navigation/${navigationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedNavigation)
      })

      if (!response.ok) throw new Error('Failed to save')

      const updatedData = await response.json()
      setNavigation(updatedData)
      setEditingCategory(null)

      toast({
        title: "成功",
        description: "更新成功"
      })
    } catch {
      toast({
        title: "错误",
        description: "保存失败",
        variant: "destructive"
      })
    }
  }

  const deleteCategory = async (categoryId: string) => {
    if (!navigationId) {
      throw new Error('Navigation ID not found')
    }

    try {
      const response = await fetch(`/api/navigation/${navigationId}/categories`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId })
      })

      if (!response.ok) throw new Error('Failed to delete')

      await fetchNavigation()
      toast({
        title: "成功",
        description: "删除成功"
      })
    } catch {
      toast({
        title: "错误",
        description: "删除失败",
        variant: "destructive"
      })
    }
  }

  const filteredCategories = useMemo(() => navigation?.subCategories?.filter(category => {
    const matchesSearch = category.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all'
      ? true
      : statusFilter === 'enabled'
        ? category.enabled !== false
        : category.enabled === false
    return matchesSearch && matchesStatus
  }) || [], [navigation?.subCategories, searchQuery, statusFilter])

  const isFiltered = useMemo(
    () => searchQuery.trim().length > 0 || statusFilter !== 'all',
    [searchQuery, statusFilter]
  )

  const moveCategory = useCallback(async (fromIndex: number, toIndex: number) => {
    if (!navigationId) {
      throw new Error('Navigation ID not found')
    }

    if (!navigation?.subCategories) return
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= navigation.subCategories.length ||
      toIndex >= navigation.subCategories.length
    ) {
      return
    }

    const previousNavigation = navigation
    const newCategories = [...navigation.subCategories]
    const [removed] = newCategories.splice(fromIndex, 1)
    newCategories.splice(toIndex, 0, removed)

    const updatedNavigation = {
      ...navigation,
      subCategories: newCategories
    }

    setNavigation(updatedNavigation)

    try {
      const response = await fetch(`/api/navigation/${navigationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedNavigation)
      })

      if (!response.ok) throw new Error('Failed to save order')

      const updatedData = await response.json()
      setNavigation(updatedData)
    } catch {
      setNavigation(previousNavigation)
      toast({
        title: "错误",
        description: "保存顺序失败，已恢复原顺序",
        variant: "destructive"
      })
    }
  }, [navigation, navigationId, toast])

  const handleDragEnd = useCallback((result: DropResult) => {
    const { destination, source } = result

    if (isFiltered) return
    if (!destination || destination.index === source.index || !navigation?.subCategories) return

    void moveCategory(source.index, destination.index)
  }, [isFiltered, moveCategory, navigation?.subCategories])

  const moveToTop = useCallback(async (id: string) => {
    if (!navigationId) {
      throw new Error('Navigation ID not found')
    }

    if (!navigation?.subCategories) return
    const index = navigation.subCategories.findIndex(cat => cat.id === id)
    if (index > 0) {
      await moveCategory(index, 0)
    }
  }, [moveCategory, navigation?.subCategories, navigationId])

  const moveToBottom = useCallback(async (id: string) => {
    if (!navigationId) {
      throw new Error('Navigation ID not found')
    }

    if (!navigation?.subCategories) return
    const index = navigation.subCategories.findIndex(cat => cat.id === id)
    if (index < (navigation.subCategories.length - 1)) {
      await moveCategory(index, navigation.subCategories.length - 1)
    }
  }, [moveCategory, navigation?.subCategories, navigationId])



  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-8 w-8"
            title="返回"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {isLoading ? (
            <Skeleton className="h-7 w-32" />
          ) : (
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {navigation?.title || '未命名导航'}
            </h2>
          )}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索分类..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                disabled={isLoading}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1 top-1 h-7 w-7 p-0"
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value: 'all' | 'enabled' | 'disabled') => setStatusFilter(value)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="按状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="enabled">已启用</SelectItem>
                <SelectItem value="disabled">已禁用</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={isLoading}>
              <Plus className="mr-2 h-4 w-4" />
              添加分类
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加分类</DialogTitle>
            </DialogHeader>
            <AddCategoryForm
              onSubmit={addCategory}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
        {isFiltered && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            当前处于筛选状态，已暂时停用拖拽排序和置顶置底，以避免影响未显示的分类。
          </div>
        )}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="droppable" isDropDisabled={isFiltered}>
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                {filteredCategories.map((category, index) => {
                  const actualIndex = navigation?.subCategories?.findIndex((currentCategory) => currentCategory.id === category.id) ?? -1

                  return (
                  <Draggable key={category.id} draggableId={category.id} index={index} isDragDisabled={isFiltered}>
                    {(provided, snapshot) => (
                      <CategoryRow
                        category={category}
                        actualIndex={actualIndex}
                        totalCount={navigation?.subCategories?.length || 0}
                        isFiltered={isFiltered}
                        navigationId={navigationId}
                        provided={provided}
                        snapshot={snapshot}
                        onMoveToTop={moveToTop}
                        onMoveToBottom={moveToBottom}
                        onEdit={(currentCategory) => setEditingCategory({ category: currentCategory })}
                        onDelete={(currentCategory) => setDeletingCategory({ category: currentCategory })}
                        onManageSites={(currentCategory) => {
                          if (navigationId) {
                            router.push(`/admin/sitelist?categoryId=${encodeURIComponent(navigationId)}&subCategoryId=${encodeURIComponent(currentCategory.id)}`)
                          }
                        }}
                      />
                    )}
                  </Draggable>
                  )
                })}
                {filteredCategories.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    {navigation?.subCategories?.length === 0 ? (
                      <p>暂无分类</p>
                    ) : (
                      <p>未找到匹配的分类</p>
                    )}
                  </div>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        </>
      )}

      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑分类</DialogTitle>
          </DialogHeader>
          <AddCategoryForm
            defaultValues={{
              title: editingCategory?.category.title || '',
              icon: editingCategory?.category.icon || '',
              description: editingCategory?.category.description || '',
              enabled: editingCategory?.category.enabled ?? true
            }}
            onSubmit={editCategory}
            onCancel={() => setEditingCategory(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除确认</DialogTitle>
            <DialogDescription>
              确定要删除分类 &ldquo;{deletingCategory?.category.title}&rdquo; 吗？此操作无法撤销，分类下的所有项目也将被删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeletingCategory(null)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingCategory) {
                  deleteCategory(deletingCategory.category.id)
                  setDeletingCategory(null)
                }
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface CategoryRowProps {
  category: NavigationCategory
  actualIndex: number
  totalCount: number
  isFiltered: boolean
  navigationId?: string
  provided: DraggableProvided
  snapshot: DraggableStateSnapshot
  onMoveToTop: (id: string) => void
  onMoveToBottom: (id: string) => void
  onManageSites: (category: NavigationCategory) => void
  onEdit: (category: NavigationCategory) => void
  onDelete: (category: NavigationCategory) => void
}

const CategoryRow = memo(function CategoryRow({
  category,
  actualIndex,
  totalCount,
  isFiltered,
  navigationId,
  provided,
  snapshot,
  onMoveToTop,
  onMoveToBottom,
  onManageSites,
  onEdit,
  onDelete,
}: CategoryRowProps) {
  const isEnabled = category.enabled !== false
  const canMoveToTop = !isFiltered && actualIndex > 0
  const canMoveToBottom = !isFiltered && actualIndex >= 0 && actualIndex < totalCount - 1

  return (
    <div
      {...provided.draggableProps}
      ref={provided.innerRef}
      style={provided.draggableProps.style}
      className={cn(
        "group relative",
        snapshot.isDragging && "z-50"
      )}
    >
      <div
        className={cn(
          "flex min-h-[64px] items-center justify-between rounded-lg border bg-card px-3 py-2 text-card-foreground",
          snapshot.isDragging
            ? "border-primary/40 shadow-md ring-1 ring-primary/20 will-change-transform"
            : "shadow-sm hover:bg-accent/10"
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground active:cursor-grabbing",
              isFiltered && "cursor-not-allowed opacity-50"
            )}
            title="拖动排序"
            aria-label={`拖动 ${category.title}`}
            aria-disabled={isFiltered}
            {...(provided.dragHandleProps || {})}
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Folder className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium leading-none" title={category.title}>
                {category.title}
              </span>
              <Badge
                variant={isEnabled ? "default" : "secondary"}
                className={cn(
                  "shrink-0 text-xs",
                  isEnabled
                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                )}
              >
                {isEnabled ? "已启用" : "已禁用"}
              </Badge>
            </div>
            {category.description && (
              <div className="mt-1 truncate text-xs text-muted-foreground" title={category.description}>
                {category.description}
              </div>
            )}
            <div className="mt-1 text-xs text-muted-foreground">
              {category.items?.length || 0} 个项目
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!snapshot.isDragging && (
            <div className="mr-2 hidden items-center gap-1 group-hover:flex">
              {canMoveToTop && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onMoveToTop(category.id)}
                  title="置顶"
                >
                  <ChevronsUp className="h-4 w-4" />
                </Button>
              )}
              {canMoveToBottom && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onMoveToBottom(category.id)}
                  title="置底"
                >
                  <ChevronsDown className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onManageSites(category)}
            title="管理站点"
            disabled={!navigationId}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onEdit(category)}
            title="编辑"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onDelete(category)}
            title="删除"
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
})
