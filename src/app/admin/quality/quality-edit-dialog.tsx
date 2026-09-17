'use client'

import { useEffect, useMemo, useState } from 'react'
import { SiteEditDialog } from '@/components/admin/site-edit-dialog'
import { useSiteMetadata } from '@/components/admin/use-site-metadata'
import { errorMessage } from '@/lib/admin-api-response'
import {
  createEmptySiteForm,
  formatSiteAliases,
  hasSiteFormChanges,
  type SiteFormValues,
} from '@/lib/site-draft'
import type { QualityCategory, QualityItem } from '@/lib/site-quality'
import { getSiteFormValidationError, updateSiteFromForm } from '@/services/navigation-site-api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/registry/new-york/ui/alert-dialog'

type QualityEditDialogProps = {
  item: QualityItem | null
  categories: QualityCategory[]
  onClose: () => void
  onSaved: () => Promise<void>
}

export function QualityEditDialog({ item, categories, onClose, onSaved }: QualityEditDialogProps) {
  const [values, setValues] = useState<SiteFormValues>(createEmptySiteForm)
  const [baseline, setBaseline] = useState<SiteFormValues>(createEmptySiteForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false)
  const metadata = useSiteMetadata(values, setValues, Boolean(item) && !saving, item?.href)
  const resetMetadata = metadata.reset
  const hasChanges = useMemo(
    () => Boolean(item) && hasSiteFormChanges(values, baseline),
    [baseline, item, values]
  )

  useEffect(() => {
    if (!item) return

    const nextValues: SiteFormValues = {
      name: item.title,
      url: item.href,
      aliases: formatSiteAliases(item.aliases),
      description: item.description || '',
      icon: item.icon || '',
      categoryId: item.categoryId,
      subCategoryId: item.subCategoryId || '',
      enabled: item.enabled ?? true,
      isPrivate: item.isPrivate ?? false,
    }
    resetMetadata()
    setValues(nextValues)
    setBaseline(nextValues)
    setError('')
    setShowDiscardPrompt(false)
  }, [item, resetMetadata])

  useEffect(() => {
    if (!hasChanges) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges])

  const requestClose = () => {
    if (saving) return
    if (hasChanges) {
      setShowDiscardPrompt(true)
      return
    }
    onClose()
  }

  const discardAndClose = () => {
    resetMetadata()
    setShowDiscardPrompt(false)
    onClose()
  }

  const save = async () => {
    if (!item || saving) return
    const validationError = getSiteFormValidationError(values)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')
    try {
      await updateSiteFromForm(item.id, values)
      resetMetadata()
      await onSaved()
    } catch (cause) {
      setError(errorMessage(cause, '更新站点失败'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SiteEditDialog
        open={Boolean(item)}
        values={values}
        setValues={setValues}
        siteId={item?.id}
        categories={categories}
        metadata={metadata}
        error={error}
        submitting={saving}
        title="编辑待处理站点"
        description="保存后会留在当前页面并自动刷新待处理清单。"
        submitLabel="保存并刷新清单"
        submittingLabel="保存中…"
        callbackUrl="/admin/quality"
        onClose={requestClose}
        onSubmit={save}
      />

      <AlertDialog open={showDiscardPrompt} onOpenChange={setShowDiscardPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃未保存的更改？</AlertDialogTitle>
            <AlertDialogDescription>关闭编辑弹窗后，本次修改将无法恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={discardAndClose}>
              放弃并关闭
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
