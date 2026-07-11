'use client'
export const runtime = 'edge'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'
import { NavigationCategory } from '@/types/navigation'

type CategorySummary = Omit<NavigationCategory, 'items'> & {
  siteCount: number
}

type NavigationCategoriesView = {
  id: string
  title: string
  subCategories: CategorySummary[]
}

export default function SubCategoryItemsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [category, setCategory] = useState<NavigationCategoriesView | null>(null)
  const [subCategory, setSubCategory] = useState<CategorySummary | null>(null)

  const fetchData = useCallback(async () => {
    try {
      if (!params?.id) {
        throw new Error('Navigation ID not found')
      }

      const navigationId = Array.isArray(params.id) ? params.id[0] : params.id
      const response = await fetch(`/api/navigation/${navigationId}/categories`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json() as NavigationCategoriesView
      setCategory(data)
      
      const sub = data.subCategories?.find((s) => String(s.id) === params.subId)
      if (sub) {
        setSubCategory(sub)
      } else {
        throw new Error('Subcategory not found')
      }
    } catch {
      toast({
        title: '错误',
        description: '加载数据失败',
        variant: 'destructive'
      })
      router.back()
    }
  }, [params?.id, params?.subId, router, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ... 添加其他必要的函数

  if (!category || !subCategory) return null

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">
            {category.title} - {subCategory.title} - 子项目管理
          </h3>
          <p className="text-sm text-muted-foreground">
            管理子分类的子项目
          </p>
        </div>
        {/* ... 添加操作按钮 */}
      </div>

      {/* ... 添加表格和其他内容 */}
    </div>
  )
}
