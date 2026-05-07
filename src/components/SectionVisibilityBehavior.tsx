'use client'

import { useEffect } from 'react'

type Props = {
  scope: 'client' | 'case'
}

export default function SectionVisibilityBehavior({ scope }: Props) {
  useEffect(() => {
    let cancelled = false

    async function applyVisibility() {
      try {
        const res = await fetch(`/api/ui-section-settings?scope=${scope}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return

        const hidden = new Set(
          (data.settings || [])
            .filter((item: any) => item.visible === false)
            .map((item: any) => item.sectionKey)
        )

        document.querySelectorAll<HTMLElement>(`[data-section-scope="${scope}"][data-section-key]`).forEach(el => {
          const key = el.dataset.sectionKey || ''
          if (hidden.has(key)) {
            el.style.display = 'none'
            el.dataset.sectionHidden = 'true'
            return
          }
          if (el.dataset.sectionHidden === 'true') {
            el.style.display = ''
            delete el.dataset.sectionHidden
          }
        })
      } catch {
        // Visibility settings are optional; if they fail, keep all sections visible.
      }
    }

    applyVisibility()
    window.addEventListener('focus', applyVisibility)
    return () => {
      cancelled = true
      window.removeEventListener('focus', applyVisibility)
    }
  }, [scope])

  return null
}
