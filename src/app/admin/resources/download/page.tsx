'use client'

export const runtime = 'edge'

import Image from 'next/image'
import { useState } from 'react'
import { AlertCircle, Copy, Download, Search, UploadCloud } from 'lucide-react'
import { Button } from '@/registry/new-york/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/registry/new-york/ui/card'
import { Input } from '@/registry/new-york/ui/input'
import { useToast } from '@/registry/new-york/hooks/use-toast'
import { uploadResourceImage } from '@/services/resource-api'

function getDownloadName(url: string) {
  let hostname = 'site'

  try {
    hostname = new URL(url).hostname || hostname
  } catch {
    hostname = url.replace(/^https?:\/\//i, '').split('/')[0] || hostname
  }

  const safeHostname = hostname.replace(/[^a-z0-9.-]+/gi, '-').replace(/^-+|-+$/g, '')
  return `${safeHostname || 'site'}-favicon.ico`
}

export default function FaviconDownloader() {
  const { toast } = useToast()
  const [url, setUrl] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [faviconBlob, setFaviconBlob] = useState<Blob | null>(null)
  const [sourceApiPath, setSourceApiPath] = useState('')
  const [resourceUrl, setResourceUrl] = useState('')
  const [showError, setShowError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleFetch = async (method: 'direct' | 'html') => {
    setIsLoading(true)
    setShowError('')
    setFaviconUrl('')
    setFaviconBlob(null)
    setSourceApiPath('')
    setResourceUrl('')

    const encodedUrl = encodeURIComponent(url)
    const apiUrl = method === 'direct'
      ? `/api/favicon?domain=${encodedUrl}`
      : `/api/favicon-im?domain=${encodedUrl}`
    setSourceApiPath(apiUrl)

    try {
      const response = await fetch(apiUrl)

      if (!response.ok) {
        throw new Error('无法访问该网站或未找到 Favicon')
      }

      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      setFaviconUrl(blobUrl)
      setFaviconBlob(blob)
    } catch (error: unknown) {
      console.error(`Error fetching favicon ${method}:`, error)
      setShowError(error instanceof Error ? error.message : '发生错误，请重试。')
    } finally {
      setIsLoading(false)
    }
  }

  const downloadFavicon = () => {
    if (!faviconUrl) {
      setShowError('请先获取 Favicon。')
      return
    }

    const link = document.createElement('a')
    link.href = faviconUrl
    link.download = getDownloadName(url)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const copyToClipboard = async (value: string, description: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast({
        title: '已复制',
        description,
      })
    } catch {
      setShowError('复制失败，请手动复制。')
    }
  }

  const saveToResourceLibrary = async () => {
    if (!faviconBlob) {
      setShowError('请先获取 Favicon。')
      return
    }

    setIsSaving(true)
    setShowError('')

    try {
      const image = await blobToDataUrl(faviconBlob)
      const result = await uploadResourceImage(image)

      if (!result.imageUrl) {
        throw new Error('未获取到资源库地址')
      }

      setResourceUrl(result.imageUrl)
      toast({
        title: '已保存',
        description: 'Favicon 已保存到资源库',
      })
    } catch (error) {
      console.error('Save favicon to resource library failed:', error)
      setShowError(error instanceof Error ? error.message : '保存到资源库失败。')
    } finally {
      setIsSaving(false)
    }
  }

  const copyableFetchUrl = sourceApiPath && typeof window !== 'undefined'
    ? `${window.location.origin}${sourceApiPath}`
    : ''

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">网站图标下载</h1>
        <p className="text-sm text-muted-foreground">
          获取站点 favicon，并按域名生成下载文件名。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">获取 Favicon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com"
            disabled={isLoading}
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              onClick={() => handleFetch('direct')}
              disabled={isLoading || !url}
              variant="outline"
            >
              <Search className="mr-2 h-4 w-4" />
              {isLoading ? '获取中...' : 'Google Favicon'}
            </Button>
            <Button
              type="button"
              onClick={() => handleFetch('html')}
              disabled={isLoading || !url}
              variant="outline"
            >
              <Search className="mr-2 h-4 w-4" />
              {isLoading ? '获取中...' : 'Favicon.im'}
            </Button>
          </div>

          {faviconUrl && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Image
                    src={faviconUrl}
                    alt="Favicon"
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 rounded border bg-background object-contain p-1"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Favicon 已获取</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {resourceUrl || getDownloadName(url)}
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 sm:flex sm:items-center">
                  <Button type="button" variant="outline" onClick={downloadFavicon}>
                    <Download className="mr-2 h-4 w-4" />
                    下载
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={saveToResourceLibrary}
                    disabled={isSaving}
                  >
                    <UploadCloud className="mr-2 h-4 w-4" />
                    {isSaving ? '保存中...' : '保存到资源库'}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {copyableFetchUrl && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => copyToClipboard(copyableFetchUrl, '已复制当前获取地址')}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    复制获取地址
                  </Button>
                )}
                {resourceUrl && (
                  <Button
                    type="button"
                    onClick={() => copyToClipboard(resourceUrl, '已复制资源库地址')}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    复制资源地址
                  </Button>
                )}
              </div>
            </div>
          )}

          {showError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{showError}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
