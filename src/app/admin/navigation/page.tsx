'use client'

export const runtime = 'edge'

import { useState } from "react"
import dynamic from 'next/dynamic'
import { Button } from "@/registry/new-york/ui/button"
import { Input } from "@/registry/new-york/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/registry/new-york/ui/dialog"
import { useToast } from "@/registry/new-york/hooks/use-toast"
import { Skeleton } from "@/registry/new-york/ui/skeleton"
import useSWR from 'swr'
import { NavigationItem } from "@/types/navigation"
import type {
  DragDropContextProps,
  DroppableProps,
  DropResult,
} from '@hello-pangea/dnd'
import { Plus, AlertTriangle, Inbox } from 'lucide-react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/registry/new-york/ui/select"

const NavigationCard = dynamic(
  () => import('./components/NavigationCard').then(module => module.NavigationCard),
  { ssr: false }
)
const AddNavigationForm = dynamic(
  () => import('./components/AddNavigationForm').then(module => module.AddNavigationForm),
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


async function fetcher(url: string): Promise<NavigationItem[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch navigation items')
  const data = await res.json()
  return data.navigationItems || []
}

export default function NavigationPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showEnabled, setShowEnabled] = useState<boolean | null>(null)
  const { toast } = useToast()

  const { data: items = [], error, isLoading, mutate } = useSWR<NavigationItem[]>(
    '/api/navigation?view=summary',
    fetcher,
    {
      fallbackData: [],
      revalidateOnFocus: false,
    }
  )

  const handleAdd = async (values: {
    title: string;
    icon: string;
    description?: string;
    enabled?: boolean
  }) => {
    try {
      // 生成唯一ID
      const newItem: NavigationItem = {
        id: Date.now().toString(),
        title: values.title,
        icon: values.icon,
        description: values.description || '',
        enabled: values.enabled ?? true,
        items: [],
        subCategories: []
      }

      const response = await fetch('/api/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: newItem
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('添加失败:', errorText)
        throw new Error('Failed to add')
      }

      setIsDialogOpen(false)
      mutate()
      toast({
        title: "成功",
        description: "添加成功"
      })
    } catch (error) {
      console.error('添加导航项错误:', error)
      toast({
        title: "错误",
        description: "添加失败：" + (error as Error).message,
        variant: "destructive"
      })
    }
  }

  const moveNavigationItem = async (sourceIndex: number, destinationIndex: number, itemId: string) => {
    if (isFiltered) return

    if (sourceIndex === destinationIndex) return

    // 创建一个新的数组副本
    const currentItems = Array.isArray(items) ? [...items] : []

    // 记录原始顺序，用于可能的回滚
    const originalItems = [...currentItems]

    // 移动元素
    const [movedItem] = currentItems.splice(sourceIndex, 1)
    currentItems.splice(destinationIndex, 0, movedItem)

    // 乐观更新：立即更新本地状态
    await mutate(currentItems, {
      revalidate: false  // 阻止重新获取数据
    })

    try {
      const response = await fetch('/api/navigation/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceIndex,
          destinationIndex,
          itemId
        })
      })

      if (!response.ok) {
        // 如果服务器请求失败，回滚到原始状态
        await mutate(originalItems, { revalidate: false })
        throw new Error('排序失败')
      }

      // 成功后重新获取最新数据以确保一致性
      await mutate()

      toast({
        title: "成功",
        description: "排序已更新"
      })

    } catch {
      // 回滚到原始状态
      await mutate(originalItems, { revalidate: false })

      toast({
        title: "错误",
        description: "排序失败，已恢复原状",
        variant: "destructive"
      })
    }
  }

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return

    await moveNavigationItem(
      result.source.index,
      result.destination.index,
      result.draggableId
    )
  }

  const moveToTop = async (id: string) => {
    const index = items.findIndex((item) => item.id === id)
    if (index > 0) {
      await moveNavigationItem(index, 0, id)
    }
  }

  const moveToBottom = async (id: string) => {
    const index = items.findIndex((item) => item.id === id)
    if (index >= 0 && index < items.length - 1) {
      await moveNavigationItem(index, items.length - 1, id)
    }
  }

  const filteredItems = items
    .filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (
        showEnabled === null ||
        (showEnabled === true && item.enabled !== false) ||
        (showEnabled === false && item.enabled === false)
      )
    )

  const isFiltered = searchQuery.trim().length > 0 || showEnabled !== null

  return (
    <div className="flex h-full flex-1 flex-col space-y-4 sm:space-y-6 md:flex">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Input
            placeholder="搜索分类..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:max-w-[300px]"
          />
          <Select
            value={showEnabled === null ? "all" : String(showEnabled)}
            onValueChange={(value) => {
              if (value === "all") {
                setShowEnabled(null)
              } else {
                setShowEnabled(value === "true")
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="状态筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="true">已启用</SelectItem>
              <SelectItem value="false">已禁用</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          添加分类
        </Button>
      </div>
      <div className="space-y-4">
        {error ? (
          <div className="flex min-h-[280px] shrink-0 items-center justify-center rounded-md border border-dashed p-4 sm:min-h-[450px]">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <AlertTriangle className="h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">加载失败</h3>
              <p className="mb-4 mt-2 text-sm text-muted-foreground">
                获取导航数据时发生错误，请稍后重试。
              </p>
              <Button
                variant="outline"
                onClick={() => mutate()}
              >
                重试
              </Button>
            </div>
          </div>
        ) : isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 rounded-lg border">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-6 w-6 rounded" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </div>
            </div>
          ))
        ) : filteredItems.length === 0 ? (
          <div className="flex min-h-[280px] shrink-0 items-center justify-center rounded-md border border-dashed p-4 sm:min-h-[450px]">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <Inbox className="h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">暂无分类</h3>
              <p className="mb-4 mt-2 text-sm text-muted-foreground">
                {searchQuery ? "没有找到匹配的分类。" : "还没有添加任何分类，点击上方的添加按钮开始创建。"}
              </p>
              {searchQuery && (
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery("")}
                >
                  清除搜索
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
          {isFiltered && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              当前处于筛选状态，已暂时停用拖拽排序和置顶置底，以避免影响未显示的分类。
            </div>
          )}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="navigation-list" isDropDisabled={isFiltered}>
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-4"
                >
                  {filteredItems.map((item, index) => {
                    const actualIndex = items.findIndex((currentItem) => currentItem.id === item.id)

                    return (
                      <NavigationCard
                        key={item.id}
                        item={item}
                        index={index}
                        onUpdate={mutate}
                        isDragDisabled={isFiltered}
                        showMoveToTop={!isFiltered && actualIndex > 0}
                        showMoveToBottom={!isFiltered && actualIndex >= 0 && actualIndex < items.length - 1}
                        onMoveToTop={() => moveToTop(item.id)}
                        onMoveToBottom={() => moveToBottom(item.id)}
                      />
                    )
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          </>
        )}
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加分类</DialogTitle>
          </DialogHeader>
          <AddNavigationForm
            onSubmit={handleAdd}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
