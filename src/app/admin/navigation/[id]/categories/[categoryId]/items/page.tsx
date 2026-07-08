'use client'

export const runtime = 'edge'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from "@/registry/new-york/ui/button"
import { Icons } from "@/components/icons"

export default function CategoryItemsPageRedirect() {
  const params = useParams<{ id: string; categoryId: string }>()
  const router = useRouter()
  const navigationId = params?.id
  const categoryId = params?.categoryId
  const targetHref = navigationId && categoryId
    ? `/admin/sitelist?categoryId=${encodeURIComponent(navigationId)}&subCategoryId=${encodeURIComponent(categoryId)}`
    : '/admin/sitelist'

  useEffect(() => {
    router.replace(targetHref)
  }, [router, targetHref])

  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-md border border-dashed p-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <Icons.list className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold">正在前往站点管理</h1>
          <p className="text-sm text-muted-foreground">
            二级分类内站点的新增、编辑、删除已统一到站点管理入口。
          </p>
        </div>
        <Button onClick={() => router.replace(targetHref)}>
          前往站点管理
        </Button>
      </div>
    </div>
  )
}
