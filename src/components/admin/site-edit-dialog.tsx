'use client'

import Image from 'next/image'
import {
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { DuplicateSiteNotice } from '@/components/admin/duplicate-site-notice'
import { Icons } from '@/components/icons'
import type { MetadataField } from '@/lib/site-form-state'
import { isHttpUrl } from '@/lib/site-form-state'
import type { SiteFormValues } from '@/lib/site-draft'
import { fileToDataUrl, uploadResourceImage } from '@/services/resource-api'
import { useToast } from '@/registry/new-york/hooks/use-toast'
import { Button } from '@/registry/new-york/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/registry/new-york/ui/dialog'
import { Input } from '@/registry/new-york/ui/input'
import { Label } from '@/registry/new-york/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/registry/new-york/ui/select'
import { Switch } from '@/registry/new-york/ui/switch'
import { Textarea } from '@/registry/new-york/ui/textarea'

export type SiteEditCategory = {
  id: string
  title: string
  subCategories?: Array<{ id: string; title: string }>
}

type SiteMetadataController = {
  loading: boolean
  error: string
  fetchMetadata: (url: string) => Promise<void>
  markEdited: (field: MetadataField) => void
}

type SiteEditDialogProps = {
  open: boolean
  values: SiteFormValues
  setValues: Dispatch<SetStateAction<SiteFormValues>>
  siteId?: string
  categories?: SiteEditCategory[]
  categoryPath?: string
  metadata: SiteMetadataController
  error?: string
  submitting: boolean
  title?: string
  description?: string
  submitLabel?: string
  submittingLabel?: string
  callbackUrl: string
  footerStart?: ReactNode
  onClose: () => void
  onSubmit: () => void | Promise<void>
}

export function SiteEditDialog({
  open,
  values,
  setValues,
  siteId,
  categories,
  categoryPath,
  metadata,
  error = '',
  submitting,
  title = '编辑站点',
  description,
  submitLabel = '更新站点',
  submittingLabel = '更新中…',
  callbackUrl,
  footerStart,
  onClose,
  onSubmit,
}: SiteEditDialogProps) {
  const { toast } = useToast()
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const latestSiteIdRef = useRef(siteId)
  const openRef = useRef(open)
  latestSiteIdRef.current = siteId
  openRef.current = open
  const selectedCategory = categories?.find(category => category.id === values.categoryId)
  const idPrefix = callbackUrl.includes('/quality') ? 'quality-edit' : 'site-edit'

  const uploadIcon = async (file: File) => {
    const formSiteId = siteId
    const uploadedUrl = values.url
    const initialIcon = values.icon
    metadata.markEdited('icon')
    setUploadingIcon(true)
    try {
      const data = await uploadResourceImage(await fileToDataUrl(file))
      if (!data.imageUrl) throw new Error('未获取到上传后的图片 URL')
      setValues(current => (
        openRef.current &&
        latestSiteIdRef.current === formSiteId &&
        current.url === uploadedUrl &&
        current.icon === initialIcon
      ) ? { ...current, icon: data.imageUrl! } : current)
      toast({ title: '成功', description: '图标上传成功' })
    } catch (cause) {
      toast({
        title: '错误',
        description: cause instanceof Error ? cause.message : '上传失败，请重试',
        variant: 'destructive',
      })
    } finally {
      setUploadingIcon(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <DialogContent className="sm:max-w-xl" data-preserve-form="true">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <FormSaveError message={error || metadata.error} callbackUrl={callbackUrl} />
        <DuplicateSiteNotice url={values.url} enabled={open} excludeId={siteId} />

        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-url`}>站点链接 *</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  id={`${idPrefix}-url`}
                  type="url"
                  value={values.url}
                  onChange={(event) => setValues(current => ({ ...current, url: event.target.value }))}
                  placeholder="输入网站链接，将自动获取网站信息"
                  disabled={submitting}
                />
                {metadata.loading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Icons.loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isHttpUrl(values.url) || metadata.loading || submitting}
                aria-label={metadata.loading ? '正在获取网站信息' : '重新获取网站信息'}
                onClick={() => void metadata.fetchMetadata(values.url)}
              >
                {metadata.loading
                  ? <Icons.loader2 className="h-4 w-4 animate-spin" />
                  : <Icons.refresh className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">自动补充标题、描述和图标；手动修改过的字段会保留</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-name`}>站点名称 *</Label>
            <Input
              id={`${idPrefix}-name`}
              value={values.name}
              onChange={(event) => {
                metadata.markEdited('name')
                setValues(current => ({ ...current, name: event.target.value }))
              }}
              placeholder="站点名称（可自动获取）"
              disabled={submitting}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-aliases`}>搜索别名</Label>
            <Input
              id={`${idPrefix}-aliases`}
              value={values.aliases}
              onChange={(event) => setValues(current => ({ ...current, aliases: event.target.value }))}
              placeholder="多个别名用逗号分隔"
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">用于首页搜索，不会显示在导航卡片上</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-icon`}>站点图标</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Input
                  id={`${idPrefix}-icon`}
                  value={values.icon}
                  onChange={(event) => {
                    metadata.markEdited('icon')
                    setValues(current => ({ ...current, icon: event.target.value }))
                  }}
                  placeholder="图标 URL（可自动获取）"
                  disabled={submitting}
                />
                {values.icon && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Image
                      src={values.icon}
                      alt="图标预览"
                      width={16}
                      height={16}
                      unoptimized
                      className="h-4 w-4 object-contain"
                      onError={(event) => { event.currentTarget.style.display = 'none' }}
                    />
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={submitting || uploadingIcon}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingIcon ? (
                  <><Icons.loader2 className="mr-2 h-4 w-4 animate-spin" />上传中…</>
                ) : (
                  <><Icons.upload className="mr-2 h-4 w-4" />上传图片</>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const input = event.currentTarget
                  const file = input.files?.[0]
                  if (file) await uploadIcon(file)
                  input.value = ''
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">可自动获取、手动输入 URL 或上传本地图片</p>
          </div>

          {categories ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-category`}>分类 *</Label>
                <Select
                  value={values.categoryId}
                  onValueChange={(categoryId) => setValues(current => ({ ...current, categoryId, subCategoryId: '' }))}
                  disabled={submitting}
                >
                  <SelectTrigger id={`${idPrefix}-category`}>
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>{category.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCategory?.subCategories && selectedCategory.subCategories.length > 0 && (
                <div className="grid gap-2">
                  <Label htmlFor={`${idPrefix}-subcategory`}>子分类</Label>
                  <Select
                    value={values.subCategoryId || 'none'}
                    onValueChange={(subCategoryId) => setValues(current => ({
                      ...current,
                      subCategoryId: subCategoryId === 'none' ? '' : subCategoryId,
                    }))}
                    disabled={submitting}
                  >
                    <SelectTrigger id={`${idPrefix}-subcategory`}>
                      <SelectValue placeholder="选择子分类（可选）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无子分类</SelectItem>
                      {selectedCategory.subCategories.map(subCategory => (
                        <SelectItem key={subCategory.id} value={subCategory.id}>{subCategory.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              <span className="text-muted-foreground">所属分类：</span>
              <span className="font-medium">{categoryPath || '-'}</span>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-description`}>描述</Label>
            <Textarea
              id={`${idPrefix}-description`}
              value={values.description}
              onChange={(event) => {
                metadata.markEdited('description')
                setValues(current => ({ ...current, description: event.target.value }))
              }}
              placeholder="输入站点描述（可选）"
              className="min-h-24 resize-y"
              disabled={submitting}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor={`${idPrefix}-enabled`}>是否启用</Label>
                <p className="text-xs text-muted-foreground">关闭后前台不会展示</p>
              </div>
              <Switch
                id={`${idPrefix}-enabled`}
                checked={values.enabled}
                onCheckedChange={(enabled) => setValues(current => ({ ...current, enabled }))}
                disabled={submitting}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor={`${idPrefix}-private`}>是否私密</Label>
                <p className="text-xs text-muted-foreground">开启后仅后台可见</p>
              </div>
              <Switch
                id={`${idPrefix}-private`}
                checked={values.isPrivate}
                onCheckedChange={(isPrivate) => setValues(current => ({ ...current, isPrivate }))}
                disabled={submitting}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
          {footerStart || <span />}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>取消</Button>
            <Button type="button" disabled={submitting} onClick={() => void onSubmit()}>
              {submitting && <Icons.loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? submittingLabel : submitLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FormSaveError({ message, callbackUrl }: { message: string; callbackUrl: string }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      {message}
      {message.includes('登录已过期') && (
        <a
          className="ml-2 underline"
          href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          重新登录
        </a>
      )}
    </div>
  )
}
