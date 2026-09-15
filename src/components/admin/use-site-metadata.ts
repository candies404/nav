'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { errorMessage, readAdminResponse } from '@/lib/admin-api-response'
import { isHttpUrl, mergeMetadata, type MetadataField, type MetadataForm, type MetadataValues } from '@/lib/site-form-state'

export function useSiteMetadata<T extends MetadataForm>(
  form: T, setForm: Dispatch<SetStateAction<T>>, active: boolean, originalUrl = '',
) {
  const latest = useRef({ form, active })
  latest.current = { form, active }
  const edited = useRef(new Set<MetadataField>())
  const automatic = useRef<Partial<Record<MetadataField, string>>>({})
  const request = useRef<AbortController | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const cancel = useCallback(() => {
    request.current?.abort()
    request.current = null
    setLoading(false)
  }, [])
  const reset = useCallback(() => {
    cancel()
    edited.current.clear()
    automatic.current = {}
    setError('')
  }, [cancel])
  const markEdited = useCallback((field: MetadataField) => { edited.current.add(field) }, [])

  const fetchMetadata = useCallback(async (url: string) => {
    if (!isHttpUrl(url) || !latest.current.active) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/website-metadata', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }), signal: controller.signal,
      })
      const metadata = await readAdminResponse<MetadataValues>(response, '获取网站信息失败')
      if (controller.signal.aborted || request.current !== controller || !latest.current.active) return
      if (latest.current.form.url.trim() !== url.trim()) return
      const current = latest.current.form
      const previousAutomatic = { ...automatic.current }
      const next = mergeMetadata(current, url, metadata, edited.current, previousAutomatic)
      for (const field of ['name', 'description', 'icon'] as const) {
        if (next[field] !== current[field]) automatic.current[field] = next[field]
      }
      // Merge into the current state, including edits queued while the request was pending.
      setForm(value => controller.signal.aborted ? value : mergeMetadata(value, url, metadata, edited.current, previousAutomatic))
    } catch (cause) {
      if (!controller.signal.aborted && request.current === controller && latest.current.form.url.trim() === url.trim()) {
        setError(`${errorMessage(cause, '获取网站信息失败')}。可以继续手动填写。`)
      }
    } finally {
      if (request.current === controller) { request.current = null; setLoading(false) }
    }
  }, [setForm])

  useEffect(() => {
    cancel()
    setError('')
    if (!active || !isHttpUrl(form.url) || form.url === originalUrl) return
    const timer = window.setTimeout(() => { void fetchMetadata(form.url) }, 700)
    return () => { clearTimeout(timer); cancel() }
  }, [active, form.url, originalUrl, cancel, fetchMetadata])

  useEffect(() => () => { request.current?.abort() }, [])
  return { loading, error, fetchMetadata, markEdited, reset }
}
