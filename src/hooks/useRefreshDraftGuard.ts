'use client'
import { useEffect, useRef } from 'react'

// Conservative protection for manual-save detail forms outside the autosave pilot.
export function useRefreshDraftGuard() {
  const dirty = useRef(false)
  const revision = useRef(0)
  useEffect(() => {
    const changed = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('.main-content') && target.matches('input, textarea, select, [contenteditable]')) {
        dirty.current = true; revision.current++
      }
    }
    document.addEventListener('input', changed, true)
    document.addEventListener('change', changed, true)
    return () => { document.removeEventListener('input', changed, true); document.removeEventListener('change', changed, true) }
  }, [])
  return { dirty, revision, saved: (atRevision: number) => { if (revision.current === atRevision) dirty.current = false } }
}
