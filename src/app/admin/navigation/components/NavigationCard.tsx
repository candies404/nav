'use client'

import { memo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/registry/new-york/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription, 
} from "@/registry/new-york/ui/dialog"
import { useToast } from "@/registry/new-york/hooks/use-toast"
import { AddNavigationForm } from './AddNavigationForm'
import { Draggable } from "@hello-pangea/dnd"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/registry/new-york/ui/tooltip"
import { NavigationItem } from '@/types/navigation'
import { navigationIcons, type IconType } from '@/lib/icons'
import {
  ChevronsDown,
  ChevronsUp,
  FolderOpen, 
  GripVertical,
  List, 
  Pencil, 
  Trash
} from 'lucide-react'
import { cn } from "@/lib/utils"
import { Badge } from "@/registry/new-york/ui/badge"

interface NavigationCardProps {
  item: NavigationItem
  index: number
  onUpdate: () => void
  isDragDisabled?: boolean
  showMoveToTop?: boolean
  showMoveToBottom?: boolean
  onMoveToTop?: () => void
  onMoveToBottom?: () => void
}

export const NavigationCard = memo(function NavigationCard({
  item, 
  index,
  onUpdate,
  isDragDisabled = false,
  showMoveToTop = false,
  showMoveToBottom = false,
  onMoveToTop,
  onMoveToBottom
}: NavigationCardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  
  const Icon = item.icon && navigationIcons[item.icon as IconType] ? navigationIcons[item.icon as IconType] : navigationIcons.Folder

  const handleEdit = async (values: { 
    title: string; 
    description?: string; 
    icon: string;
    enabled: boolean;
  }) => {
    try {
      const response = await fetch(`/api/navigation/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          title: values.title,
          description: values.description,
          icon: values.icon,
          enabled: values.enabled
        })
      })

      if (!response.ok) throw new Error('Failed to save')

      setIsEditDialogOpen(false)
      onUpdate()
      toast({
        title: "成功",
        description: "保存成功"
      })
    } catch {
      toast({
        title: "错误",
        description: "保存失败",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/navigation/${item.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete')

      setIsDeleteDialogOpen(false)
      onUpdate()
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

  return (
    <Draggable draggableId={item.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={provided.draggableProps.style}
          className={cn(
            "group relative",
            snapshot.isDragging && "z-50"
          )}
        >
          <div
            className={cn(
              "flex min-h-[72px] items-center justify-between rounded-lg border bg-card px-3 py-3 text-card-foreground",
              snapshot.isDragging
                ? "border-primary/40 shadow-md ring-1 ring-primary/20 will-change-transform"
                : "shadow-sm hover:border-primary/50"
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground active:cursor-grabbing",
                  isDragDisabled && "cursor-not-allowed opacity-50"
                )}
                title="拖动排序"
                aria-label={`拖动 ${item.title}`}
                aria-disabled={isDragDisabled}
                {...(provided.dragHandleProps || {})}
              >
                <GripVertical className="h-4 w-4" />
              </div>
              <Icon className="h-6 w-6 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate text-sm font-medium" title={item.title}>{item.title}</h3>
                  <Badge
                    variant={(item.enabled ?? true) ? "default" : "secondary"}
                    className={cn(
                      "shrink-0 text-xs",
                      (item.enabled ?? true)
                        ? "bg-green-100 text-green-800 hover:bg-green-100"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    {(item.enabled ?? true) ? "已启用" : "已禁用"}
                  </Badge>
                </div>
                {item.description && (
                  <p className="mt-1 truncate text-xs text-muted-foreground" title={item.description}>
                    {item.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!snapshot.isDragging && (
                <div className="mr-2 hidden items-center gap-1 group-hover:flex">
                  {showMoveToTop && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={onMoveToTop}
                      title="置顶"
                    >
                      <ChevronsUp className="h-4 w-4" />
                    </Button>
                  )}
                  {showMoveToBottom && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={onMoveToBottom}
                      title="置底"
                    >
                      <ChevronsDown className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/admin/navigation/${item.id}/categories`)}
                      className="h-8 w-8"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>分类管理</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/admin/sitelist?categoryId=${encodeURIComponent(item.id)}`)}
                      className="h-8 w-8"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>管理站点</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsEditDialogOpen(true)}
                      className="h-8 w-8"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>编辑</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      className="h-8 w-8"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>删除</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>编辑分类</DialogTitle>
              </DialogHeader>
              <AddNavigationForm
                defaultValues={{
                  title: item.title,
                  description: item.description || '',
                  icon: item.icon || '',
                  enabled: item.enabled ?? true
                }}
                onSubmit={handleEdit}
                onCancel={() => setIsEditDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认删除</DialogTitle>
                <DialogDescription>
                  确定要删除这个导航吗？此操作无法撤消，所有相关的分类和子项目都将被删除。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                  取消
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  删除
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </Draggable>
  )
})
