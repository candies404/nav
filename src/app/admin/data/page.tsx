'use client'
export const runtime = 'edge'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { NavigationItem, NavigationCategory, NavigationSubItem } from '@/types/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Archive,
  Download,
  RefreshCw,
  Save,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Upload,
  Database,
  Eye,
  FileJson,
  History,
  RotateCcw,
  ShieldAlert,
  Trash2
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

const JsonEditor = dynamic(
  () => import('@/components/ui/json-editor').then(module => module.JsonEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center rounded-lg border text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          加载高级编辑器...
        </div>
      </div>
    ),
  }
)

type NavigationHistorySummary = {
  id: string
  createdAt: string
  message: string
  categoryCount: number
  siteCount: number
  size: number
}

type NavigationHistoryDetail = NavigationHistorySummary & {
  data: {
    navigationItems: NavigationItem[]
  }
}

type NavigationDataStats = {
  categories: number
  items: number
  privateItems: number
  disabledItems: number
  size: number
}

type SiteSnapshot = {
  key: string
  title: string
  href: string
  path: string
}

function getNavigationDataStats(jsonString: string): NavigationDataStats {
  const parsed = JSON.parse(jsonString) as { navigationItems?: NavigationItem[] }
  const categories = parsed.navigationItems?.length || 0
  const sites = collectNavigationSites(parsed.navigationItems || [])

  return {
    categories,
    items: sites.length,
    privateItems: sites.filter(site => site.isPrivate).length,
    disabledItems: sites.filter(site => site.enabled === false).length,
    size: new Blob([jsonString]).size,
  }
}

function collectNavigationSites(navigationItems: NavigationItem[]) {
  const sites: Array<NavigationSubItem & { path: string }> = []

  navigationItems.forEach((category) => {
    category.items?.forEach((site) => {
      sites.push({ ...site, path: category.title })
    })

    category.subCategories?.forEach((subCategory: NavigationCategory) => {
      subCategory.items?.forEach((site) => {
        sites.push({ ...site, path: `${category.title} / ${subCategory.title}` })
      })
    })
  })

  return sites
}

function getSiteSnapshots(jsonString: string): SiteSnapshot[] {
  const parsed = JSON.parse(jsonString) as { navigationItems?: NavigationItem[] }

  return collectNavigationSites(parsed.navigationItems || []).map((site) => ({
    key: site.id || site.href,
    title: site.title || site.href,
    href: site.href,
    path: site.path,
  }))
}

function formatStatDelta(previous: number, current: number) {
  const delta = current - previous
  if (delta > 0) return `+${delta}`

  return String(delta)
}

function formatStatsSummary(previous: NavigationDataStats | null, current: NavigationDataStats) {
  if (!previous) {
    return [
      `当前分类数：${current.categories}`,
      `当前站点数：${current.items}`,
      `当前私有站点：${current.privateItems}`,
      `当前禁用站点：${current.disabledItems}`,
      `当前大小：${(current.size / 1024).toFixed(2)} KB`,
    ].join('\n')
  }

  return [
    `分类数：${previous.categories} -> ${current.categories} (${formatStatDelta(previous.categories, current.categories)})`,
    `站点数：${previous.items} -> ${current.items} (${formatStatDelta(previous.items, current.items)})`,
    `私有站点：${previous.privateItems} -> ${current.privateItems} (${formatStatDelta(previous.privateItems, current.privateItems)})`,
    `禁用站点：${previous.disabledItems} -> ${current.disabledItems} (${formatStatDelta(previous.disabledItems, current.disabledItems)})`,
    `大小：${(previous.size / 1024).toFixed(2)} KB -> ${(current.size / 1024).toFixed(2)} KB (${formatStatDelta(Number((previous.size / 1024).toFixed(2)), Number((current.size / 1024).toFixed(2)))} KB)`,
  ].join('\n')
}

function getNavigationChangeSummary(previousJson: string, currentJson: string) {
  const currentStats = getNavigationDataStats(currentJson)
  const previousStats = previousJson ? getNavigationDataStats(previousJson) : null
  const previousSites = previousJson ? getSiteSnapshots(previousJson) : []
  const currentSiteKeys = new Set(getSiteSnapshots(currentJson).map(site => site.key))
  const deletedSites = previousSites.filter(site => !currentSiteKeys.has(site.key))
  const riskReasons: string[] = []

  if (previousStats) {
    const categoryDrop = previousStats.categories - currentStats.categories
    const deletedRatio = previousStats.items > 0 ? deletedSites.length / previousStats.items : 0

    if (categoryDrop > 0) {
      riskReasons.push(`将减少 ${categoryDrop} 个一级分类`)
    }

    if (deletedSites.length > 0) {
      riskReasons.push(`将删除 ${deletedSites.length} 个站点`)
    }

    if (deletedRatio >= 0.1) {
      riskReasons.push('删除站点比例达到 10% 或以上')
    }
  }

  const deletedPreview = deletedSites
    .slice(0, 5)
    .map(site => `- ${site.title}（${site.path}）`)

  return {
    currentStats,
    confirmationText: [
      '确认保存导航 JSON？',
      '',
      formatStatsSummary(previousStats, currentStats),
      ...(deletedPreview.length > 0 ? ['', '将删除的站点示例：', ...deletedPreview] : []),
      ...(deletedSites.length > deletedPreview.length ? [`- 另有 ${deletedSites.length - deletedPreview.length} 个站点未展示`] : []),
      ...(riskReasons.length > 0 ? ['', '高风险变更：', ...riskReasons.map(reason => `- ${reason}`)] : []),
    ].join('\n'),
    requiresTypedConfirmation: riskReasons.length > 0,
  }
}

export default function DataManagementPage() {
  const [navigationData, setNavigationData] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false)
  const [isJsonValid, setIsJsonValid] = useState(true)
  const [jsonError, setJsonError] = useState('')
  const [dataStats, setDataStats] = useState({ categories: 0, items: 0, privateItems: 0, disabledItems: 0, size: 0 })
  const [savedDataStats, setSavedDataStats] = useState<NavigationDataStats | null>(null)
  const [savedNavigationData, setSavedNavigationData] = useState('')
  const [activeTab, setActiveTab] = useState('maintenance')

  const [defaultFileStatus, setDefaultFileStatus] = useState({ exists: false, valid: false, itemCount: 0, checked: false })
  const [historyVersions, setHistoryVersions] = useState<NavigationHistorySummary[]>([])
  const [historyLimit, setHistoryLimit] = useState(10)
  const [historyPreview, setHistoryPreview] = useState<NavigationHistoryDetail | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isRestoringHistory, setIsRestoringHistory] = useState(false)
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null)
  const { toast } = useToast()

  // 检查默认文件状态
  const checkDefaultFile = useCallback(async () => {
    try {
      const response = await fetch('/api/navigation/check-default')
      if (response.ok) {
        const status = await response.json()
        setDefaultFileStatus({ ...status, checked: true })
      } else {
        setDefaultFileStatus({ exists: false, valid: false, itemCount: 0, checked: true })
      }
    } catch (error) {
      console.error('Failed to check default file:', error)
      setDefaultFileStatus({ exists: false, valid: false, itemCount: 0, checked: true })
    }
  }, [])

  const loadHistoryVersions = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const response = await fetch('/api/navigation/history')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.details || result.error || '加载历史版本失败')
      }

      setHistoryVersions(Array.isArray(result.versions) ? result.versions : [])
      setHistoryLimit(typeof result.limit === 'number' ? result.limit : 10)
    } catch (error) {
      console.error('Load history error:', error)
      toast({
        title: "错误",
        description: (error as Error).message || "加载历史版本失败",
        variant: "destructive",
      })
    } finally {
      setIsLoadingHistory(false)
    }
  }, [toast])

  const openRestoreDialog = (open: boolean) => {
    setIsRestoreDialogOpen(open)

    if (open) {
      setHistoryPreview(null)
      loadHistoryVersions()
      checkDefaultFile()
    }
  }

  // 验证JSON格式并更新统计信息
  const validateJson = useCallback((jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString)
      setIsJsonValid(true)
      setJsonError('')

      if (parsed.navigationItems) {
        setDataStats(getNavigationDataStats(jsonString))
      }
      return true
    } catch (error) {
      setIsJsonValid(false)
      setJsonError((error as Error).message)
      return false
    }
  }, [])

  // 加载当前导航数据
  const loadNavigationData = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/navigation')
      if (response.ok) {
        const data = await response.json()
        const jsonString = JSON.stringify(data, null, 2)
        setNavigationData(jsonString)
        validateJson(jsonString)
        setSavedDataStats(getNavigationDataStats(jsonString))
        setSavedNavigationData(jsonString)
      } else {
        throw new Error('加载数据失败')
      }
    } catch (error) {
      console.error('Load data error:', error)
      toast({
        title: "错误",
        description: "加载导航数据失败",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast, validateJson])

  const previewHistoryVersion = async (versionId: string) => {
    setIsLoadingHistory(true)
    try {
      const response = await fetch(`/api/navigation/history/${encodeURIComponent(versionId)}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.details || result.error || '加载历史版本详情失败')
      }

      setHistoryPreview(result.version)
    } catch (error) {
      console.error('Preview history error:', error)
      toast({
        title: "错误",
        description: (error as Error).message || "加载历史版本详情失败",
        variant: "destructive",
      })
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const restoreHistoryVersion = async (versionId: string) => {
    if (!window.confirm('确认恢复到这个历史版本？当前数据会先自动保存为历史版本，然后被选中版本替换。')) return

    setIsRestoringHistory(true)
    try {
      const response = await fetch('/api/navigation/history/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: versionId }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.details || result.error || '恢复历史版本失败')
      }

      const jsonString = JSON.stringify(result.data, null, 2)
      setNavigationData(jsonString)
      validateJson(jsonString)
      setSavedDataStats(getNavigationDataStats(jsonString))
      setSavedNavigationData(jsonString)
      setHistoryPreview(null)
      setIsRestoreDialogOpen(false)
      await loadHistoryVersions()

      toast({
        title: "成功",
        description: "已恢复到选中的历史版本，恢复前的数据已自动保存为新历史版本",
      })
    } catch (error) {
      console.error('Restore history error:', error)
      toast({
        title: "错误",
        description: (error as Error).message || "恢复历史版本失败",
        variant: "destructive",
      })
    } finally {
      setIsRestoringHistory(false)
    }
  }

  const deleteHistoryVersion = async (versionId: string) => {
    if (!window.confirm('确认删除这个历史版本？删除后无法从历史版本中恢复。')) return

    setDeletingHistoryId(versionId)
    try {
      const response = await fetch(`/api/navigation/history/${encodeURIComponent(versionId)}`, {
        method: 'DELETE',
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.details || result.error || '删除历史版本失败')
      }

      if (historyPreview?.id === versionId) {
        setHistoryPreview(null)
      }

      await loadHistoryVersions()

      toast({
        title: "成功",
        description: "历史版本已删除",
      })
    } catch (error) {
      console.error('Delete history error:', error)
      toast({
        title: "错误",
        description: (error as Error).message || "删除历史版本失败",
        variant: "destructive",
      })
    } finally {
      setDeletingHistoryId(null)
    }
  }

  // 恢复初始化数据
  const restoreDefaultData = async () => {
    if (!window.confirm('确认恢复初始化数据？当前导航数据会被默认数据替换。')) return

    // 检查默认文件是否存在
    if (!defaultFileStatus.exists) {
      toast({
        title: "错误",
        description: "navigation-default.json 文件不存在，无法恢复默认数据",
        variant: "destructive",
      })
      return
    }

    if (!defaultFileStatus.valid) {
      toast({
        title: "错误",
        description: "navigation-default.json 文件格式无效，无法恢复默认数据",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/navigation/restore', {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        const jsonString = JSON.stringify(data, null, 2)
        setNavigationData(jsonString)
        validateJson(jsonString)
        setSavedDataStats(getNavigationDataStats(jsonString))
        setSavedNavigationData(jsonString)
        setIsRestoreDialogOpen(false)
        await loadHistoryVersions()
        toast({
          title: "成功",
          description: `没有历史版本，已恢复为初始化数据（${defaultFileStatus.itemCount} 个分类）`,
        })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.details || '恢复数据失败')
      }
    } catch (error) {
      toast({
        title: "错误",
        description: (error as Error).message || "恢复初始化数据失败",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 保存数据
  const saveData = useCallback(async () => {
    if (!validateJson(navigationData)) {
      toast({
        title: "错误",
        description: "JSON格式不正确，请检查语法",
        variant: "destructive",
      })
      return
    }

    const changeSummary = getNavigationChangeSummary(savedNavigationData, navigationData)

    if (changeSummary.requiresTypedConfirmation) {
      const confirmation = window.prompt(`${changeSummary.confirmationText}\n\n这是高风险变更。如需继续，请输入“确认保存”。`)
      if (confirmation !== '确认保存') return
    } else if (!window.confirm(changeSummary.confirmationText)) {
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/navigation', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: navigationData,
      })
      const result = await response.json()

      if (response.ok) {
        if (result.saved === false) {
          toast({
            title: "无需保存",
            description: "数据未修改，已跳过保存",
          })
          return
        }

        await loadHistoryVersions()
        setSavedDataStats(changeSummary.currentStats)
        setSavedNavigationData(navigationData)
        toast({
          title: "成功",
          description: "数据保存成功",
        })
      } else {
        throw new Error(result.details || result.error || '保存失败')
      }
    } catch (error) {
      console.error('Save data error:', error)
      toast({
        title: "错误",
        description: "保存数据失败",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }, [loadHistoryVersions, navigationData, savedNavigationData, toast, validateJson])

  // 下载数据到本地
  const downloadData = useCallback(() => {
    if (!validateJson(navigationData)) {
      toast({
        title: "错误",
        description: "JSON格式不正确，无法下载",
        variant: "destructive",
      })
      return
    }

    try {
      const parsedData = JSON.parse(navigationData)
      const blob = new Blob([JSON.stringify(parsedData, null, 2)], {
        type: 'application/json',
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `navigation-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "成功",
        description: "数据已下载到本地",
      })
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: "错误",
        description: "下载失败",
        variant: "destructive",
      })
    }
  }, [navigationData, toast, validateJson])

  // 上传JSON文件
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 检查文件类型
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      toast({
        title: "错误",
        description: "请选择JSON文件",
        variant: "destructive",
      })
      return
    }

    // 检查文件大小 (限制为5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "错误",
        description: "文件大小不能超过5MB",
        variant: "destructive",
      })
      return
    }

    if (navigationData && !window.confirm('上传文件会替换当前编辑器中的 JSON 内容，确认继续？')) {
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        // 验证JSON格式
        JSON.parse(content)

        // 格式化JSON并设置到编辑器
        const formatted = JSON.stringify(JSON.parse(content), null, 2)
        setNavigationData(formatted)
        validateJson(formatted)

        toast({
          title: "成功",
          description: `已上传文件: ${file.name}`,
        })
      } catch (error) {
        console.error('File upload error:', error)
        toast({
          title: "错误",
          description: "文件内容不是有效的JSON格式",
          variant: "destructive",
        })
      }
    }

    reader.onerror = () => {
      toast({
        title: "错误",
        description: "文件读取失败",
        variant: "destructive",
      })
    }

    reader.readAsText(file)

    // 清空input值，允许重复上传同一文件
    event.target.value = ''
  }

  // 触发文件选择
  const triggerFileUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = (e) => handleFileUpload(e as unknown as React.ChangeEvent<HTMLInputElement>)
    input.click()
  }

  // 处理编辑器变化
  const handleEditorChange = (value: string) => {
    setNavigationData(value)
    validateJson(value)
  }

  // 处理编辑器验证
  const handleEditorValidate = (isValid: boolean, errors: string[]) => {
    setIsJsonValid(isValid)
    if (!isValid && errors.length > 0) {
      setJsonError(errors[0])
    } else {
      setJsonError('')
    }
  }

  const formatHistoryTime = (value: string) => {
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    } catch {
      return value
    }
  }

  const formatSize = (size: number) => `${(size / 1024).toFixed(2)} KB`

  useEffect(() => {
    loadNavigationData()
    checkDefaultFile()
    loadHistoryVersions()
  }, [checkDefaultFile, loadHistoryVersions, loadNavigationData])

  // Monaco Editor 事件监听
  useEffect(() => {
    const handleMonacoSave = () => {
      if (!isSaving && !isLoading && isJsonValid) {
        saveData()
      }
    }

    const handleMonacoRefresh = () => {
      if (!isLoading) {
        loadNavigationData()
      }
    }

    const handleMonacoDownload = () => {
      if (!isLoading && isJsonValid) {
        downloadData()
      }
    }

    window.addEventListener('monaco-save', handleMonacoSave)
    window.addEventListener('monaco-refresh', handleMonacoRefresh)
    window.addEventListener('monaco-download', handleMonacoDownload)

    return () => {
      window.removeEventListener('monaco-save', handleMonacoSave)
      window.removeEventListener('monaco-refresh', handleMonacoRefresh)
      window.removeEventListener('monaco-download', handleMonacoDownload)
    }
  }, [downloadData, isSaving, isLoading, isJsonValid, loadNavigationData, saveData])

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">数据管理</h1>
          <p className="text-muted-foreground">
            日常维护、备份恢复和高级 JSON 编辑已分区管理。
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          高级 JSON 独立入口
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>一级分类</CardDescription>
            <CardTitle className="text-2xl">{dataStats.categories}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>站点总数</CardDescription>
            <CardTitle className="text-2xl">{dataStats.items}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>私有站点</CardDescription>
            <CardTitle className="text-2xl">{dataStats.privateItems}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>禁用站点</CardDescription>
            <CardTitle className="text-2xl">{dataStats.disabledItems}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-[560px]">
          <TabsTrigger value="maintenance">
            <Database className="mr-2 h-4 w-4" />
            日常维护
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Archive className="mr-2 h-4 w-4" />
            备份恢复
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <FileJson className="mr-2 h-4 w-4" />
            高级 JSON
          </TabsTrigger>
        </TabsList>

        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">日常维护</CardTitle>
              <CardDescription>
                这里放低风险的维护动作，不直接暴露完整 JSON 编辑器。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Button
                  onClick={loadNavigationData}
                  disabled={isLoading}
                  variant="outline"
                  className="h-12 w-full justify-start"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  同步最新数据
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full justify-start"
                  onClick={() => setActiveTab('backup')}
                >
                  <History className="mr-2 h-4 w-4" />
                  查看历史版本
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">当前数据状态</CardTitle>
              <CardDescription>
                用于快速判断当前导航数据规模和备份情况。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border p-3">
                  <div className="text-sm text-muted-foreground">JSON 大小</div>
                  <div className="mt-1 font-mono text-lg">{(dataStats.size / 1024).toFixed(2)} KB</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm text-muted-foreground">历史版本</div>
                  <div className="mt-1 font-mono text-lg">{historyVersions.length}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm text-muted-foreground">最近版本</div>
                  <div className="mt-1 truncate text-sm">
                    {historyVersions[0] ? formatHistoryTime(historyVersions[0].createdAt) : '暂无'}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm text-muted-foreground">JSON 状态</div>
                  <div className="mt-1 flex items-center gap-1 text-sm">
                    {isJsonValid ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>格式正确</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span>格式错误</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">备份与恢复</CardTitle>
              <CardDescription>
                下载当前数据或从历史版本恢复。上传 JSON 已归入高级 JSON 编辑流程。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Button
                  onClick={downloadData}
                  disabled={isLoading || !isJsonValid}
                  variant="outline"
                  className="h-12 w-full justify-start"
                >
                  <Download className="mr-2 h-4 w-4" />
                  下载备份
                </Button>

                <Button
                  onClick={() => {
                    setActiveTab('advanced')
                    triggerFileUpload()
                  }}
                  disabled={isLoading}
                  variant="outline"
                  className="h-12 w-full justify-start"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  上传 JSON
                </Button>

                <Dialog open={isRestoreDialogOpen} onOpenChange={openRestoreDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={isLoading}
                      className="relative h-12 w-full justify-start"
                    >
                      <History className="mr-2 h-4 w-4" />
                      历史版本
                      {historyVersions.length > 0 && (
                        <Badge variant="outline" className="pointer-events-none absolute right-0 top-0 flex h-5 min-w-5 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background px-1.5 py-0 text-[11px] leading-none text-foreground shadow-sm">
                          {historyVersions.length}
                        </Badge>
                      )}
                      {historyVersions.length === 0 && defaultFileStatus.checked && !defaultFileStatus.exists && (
                        <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 w-4 p-0 text-xs">
                          !
                        </Badge>
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        历史版本
                      </DialogTitle>
                      <DialogDescription>
                        保留最近 {historyLimit} 个导航数据版本。没有历史版本时，可恢复为初始化数据。
                      </DialogDescription>
                    </DialogHeader>
                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        加载历史版本中...
                      </div>
                    ) : historyVersions.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                          {historyVersions.map((version) => (
                            <div key={version.id} className="rounded-lg border p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <div className="font-medium">{formatHistoryTime(version.createdAt)}</div>
                                  <div className="truncate text-xs text-muted-foreground" title={version.message}>
                                    {version.message}
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline">{version.categoryCount} 分类</Badge>
                                    <Badge variant="outline">{version.siteCount} 站点</Badge>
                                    <Badge variant="outline">{formatSize(version.size)}</Badge>
                                  </div>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => previewHistoryVersion(version.id)}
                                    disabled={isLoadingHistory || isRestoringHistory || deletingHistoryId === version.id}
                                  >
                                    <Eye className="mr-1 h-3.5 w-3.5" />
                                    预览
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => restoreHistoryVersion(version.id)}
                                    disabled={isLoadingHistory || isRestoringHistory || deletingHistoryId === version.id}
                                  >
                                    {isRestoringHistory ? (
                                      <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                    )}
                                    恢复
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteHistoryVersion(version.id)}
                                    disabled={isLoadingHistory || isRestoringHistory || deletingHistoryId === version.id}
                                  >
                                    {deletingHistoryId === version.id ? (
                                      <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                                    )}
                                    删除
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="min-h-[240px] rounded-lg border bg-muted/30 p-3">
                          {historyPreview ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-medium">{formatHistoryTime(historyPreview.createdAt)}</div>
                                  <div className="truncate text-xs text-muted-foreground" title={historyPreview.message}>
                                    {historyPreview.message}
                                  </div>
                                </div>
                                <Badge variant="outline">{historyPreview.siteCount} 站点</Badge>
                              </div>
                              <textarea
                                readOnly
                                value={JSON.stringify(historyPreview.data, null, 2)}
                                className="h-[340px] w-full resize-none overflow-auto rounded border bg-background p-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label="历史版本 JSON 预览"
                              />
                            </div>
                          ) : (
                            <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                              选择一个历史版本进行预览
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
                          <div className="mb-1 flex items-center gap-2 font-medium">
                            <AlertTriangle className="h-4 w-4" />
                            暂无历史版本
                          </div>
                          <div>
                            当前没有可恢复的在线历史版本，可使用 <code className="rounded bg-white/70 px-1 py-0.5">navigation-default.json</code> 恢复初始化数据。
                          </div>
                        </div>

                        <div className="rounded-lg bg-muted/50 p-3">
                          <div className="mb-2 text-sm font-medium">默认文件状态：</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center justify-between">
                              <span>文件存在：</span>
                              <Badge variant={defaultFileStatus.exists ? "default" : "destructive"}>
                                {defaultFileStatus.exists ? "是" : "否"}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>格式有效：</span>
                              <Badge variant={defaultFileStatus.valid ? "default" : "destructive"}>
                                {defaultFileStatus.valid ? "是" : "否"}
                              </Badge>
                            </div>
                            {defaultFileStatus.exists && defaultFileStatus.valid && (
                              <div className="flex items-center justify-between">
                                <span>分类数量：</span>
                                <Badge variant="outline">{defaultFileStatus.itemCount}</Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsRestoreDialogOpen(false)}>
                        取消
                      </Button>
                      {historyVersions.length === 0 && (
                        <Button
                          onClick={restoreDefaultData}
                          disabled={isLoading || isLoadingHistory || !defaultFileStatus.exists || !defaultFileStatus.valid}
                          variant="destructive"
                        >
                          {isLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                          恢复初始化
                        </Button>
                      )}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full justify-start"
                  onClick={() => setActiveTab('advanced')}
                >
                  <FileJson className="mr-2 h-4 w-4" />
                  打开高级 JSON
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <div className="font-medium">高级 JSON 编辑入口</div>
                <p>
                  日常新增、编辑和移动站点请优先使用“站点管理”和“分类管理”。这里保存 JSON 或恢复版本会直接影响前台导航数据。
                </p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">高级 JSON 操作</CardTitle>
              <CardDescription>
                直接修改完整导航数据。保存前会展示变化摘要，高风险变更需要再次确认。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Button
                  onClick={saveData}
                  disabled={isSaving || isLoading || !isJsonValid}
                  className="h-12 w-full justify-start"
                >
                  <Save className={`mr-2 h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} />
                  保存数据
                </Button>
                <Button
                  onClick={triggerFileUpload}
                  disabled={isLoading}
                  variant="outline"
                  className="h-12 w-full justify-start"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  上传 JSON
                </Button>
                <Button
                  onClick={downloadData}
                  disabled={isLoading || !isJsonValid}
                  variant="outline"
                  className="h-12 w-full justify-start"
                >
                  <Download className="mr-2 h-4 w-4" />
                  下载备份
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {!isJsonValid && jsonError && (
                <div className="m-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                    <div className="flex-1">
                      <div className="mb-1 font-medium text-destructive">JSON 语法错误</div>
                      <p className="mb-2 text-sm text-destructive/80">{jsonError}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            try {
                              const lines = navigationData.split('\n')
                              const errorMatch = jsonError.match(/position (\d+)/)
                              if (errorMatch) {
                                const position = parseInt(errorMatch[1])
                                let currentPos = 0
                                let lineNum = 0
                                for (let i = 0; i < lines.length; i++) {
                                  if (currentPos + lines[i].length >= position) {
                                    lineNum = i + 1
                                    break
                                  }
                                  currentPos += lines[i].length + 1
                                }
                                toast({
                                  title: "错误位置",
                                  description: `错误可能在第 ${lineNum} 行附近`,
                                })
                              }
                            } catch {
                              toast({
                                title: "无法定位错误",
                                description: "请手动检查JSON语法",
                                variant: "destructive",
                              })
                            }
                          }}
                          className="h-7 text-xs"
                        >
                          定位错误
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            let fixed = navigationData
                            fixed = fixed.replace(/,(\s*[}\]])/g, '$1')
                            fixed = fixed.replace(/([{,]\s*)(\w+):/g, '$1"$2":')
                            setNavigationData(fixed)
                            validateJson(fixed)
                          }}
                          className="h-7 text-xs"
                        >
                          尝试修复
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="relative">
                <JsonEditor
                  value={navigationData}
                  onChange={handleEditorChange}
                  onValidate={handleEditorValidate}
                  disabled={isLoading}
                  height="500px"
                  isValid={isJsonValid}
                  stats={dataStats}
                />

                {isLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
                      <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm font-medium">加载数据中...</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 p-4">
                <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>字符数: {navigationData.length.toLocaleString()}</span>
                    <span>行数: {navigationData.split('\n').length}</span>
                    <span>大小: {(new Blob([navigationData]).size / 1024).toFixed(2)} KB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isJsonValid ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        <span>格式正确</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-destructive">
                        <XCircle className="h-3 w-3" />
                        <span>格式错误</span>
                      </div>
                    )}
                  </div>
                </div>

                {isJsonValid && navigationData && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border p-4">
                      <div className="mb-3 text-sm font-medium">数据结构</div>
                        <div className="space-y-2 text-sm">
                          {(() => {
                            try {
                              const data = JSON.parse(navigationData)
                              return (
                                <div className="space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">根分类:</span>
                                    <span className="font-mono">{data.navigationItems?.length || 0}</span>
                                  </div>
                                  {data.navigationItems?.map((item: NavigationItem, index: number) => (
                                    <div key={index} className="ml-4 text-xs text-muted-foreground">
                                      <div className="flex justify-between gap-3">
                                        <span className="truncate">• {item.title}</span>
                                        <span>
                                          {(item.items?.length || 0) + (item.subCategories?.reduce((acc: number, sub: NavigationCategory) => acc + (sub.items?.length || 0), 0) || 0)} 项
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            } catch {
                              return <span className="text-muted-foreground">无法解析数据结构</span>
                            }
                          })()}
                        </div>
                    </div>

                    <div className="rounded-md border p-4">
                      <div className="mb-3 text-sm font-medium">保存前摘要</div>
                        <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                          {formatStatsSummary(savedDataStats, dataStats)}
                        </pre>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
