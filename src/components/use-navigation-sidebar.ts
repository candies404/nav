'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NavigationData } from '@/types/navigation'

const STORAGE_KEY = 'navsphere:expanded-categories'

export function useNavigationSidebar(data: NavigationData) {
  const [activeId, setActiveId] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const expandedRef = useRef(expandedCategories)
  const sections = useMemo(() => data.navigationItems.flatMap(category => [
    category.id,
    ...(category.subCategories || []).map(sub => sub.id),
  ]), [data])

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        const next = Object.fromEntries(data.navigationItems.map(category => [
          category.id, (saved as Record<string, unknown>)[category.id] === true,
        ]))
        expandedRef.current = next
        setExpandedCategories(next)
      }
    } catch { /* Navigation also works when browser storage is unavailable. */ }
  }, [data])

  const toggleCategory = useCallback((id: string) => {
    const next = { ...expandedRef.current, [id]: !expandedRef.current[id] }
    expandedRef.current = next
    setExpandedCategories(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* Optional preference. */ }
  }, [])

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      let current = sections[0] || ''
      for (const id of sections) {
        const element = document.getElementById(id)
        if (element && element.getBoundingClientRect().top <= 120) current = id
      }
      // A short final section cannot reach the top of the viewport.
      if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        current = sections[sections.length - 1] || current
      }
      setActiveId(current)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // Images and responsive wrapping can move section boundaries without a scroll.
    const observer = new ResizeObserver(schedule)
    const main = document.querySelector('main')
    if (main) observer.observe(main)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [sections])

  return { activeId, expandedCategories, toggleCategory }
}
