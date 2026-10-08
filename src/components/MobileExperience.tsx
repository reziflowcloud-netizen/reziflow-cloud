'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useLanguage } from '@/context/LanguageContext'
import { appExperienceText } from '@/lib/appExperienceI18n'
import { isScreenStale, refreshScreen, registerScreenRefresh, supportsScreenRefresh } from '@/lib/screenRefresh'

export function requestScreenRefresh() { window.dispatchEvent(new Event('legalhub:refresh')) }

export default function MobileExperience() {
  const pathname = usePathname()
  const router = useRouter()
  const { lang } = useLanguage()
  const copy = appExperienceText[lang]
  const [pull, setPull] = useState(0)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [transitioning, startTransition] = useTransition()
  const resolveTransition = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (!transitioning) { resolveTransition.current?.(); resolveTransition.current = null }
  }, [transitioning])
  useEffect(() => {
    if (!pathname.startsWith('/dashboard')) return
    return registerScreenRefresh({ ready: () => !document.querySelector('[role="dialog"]'), load: () => new Promise<void>(resolve => {
      resolveTransition.current = resolve
      startTransition(() => router.refresh())
    }) })
  }, [pathname, router])

  useEffect(() => {
    setPull(0)
    setStatus('')
    setBusy(false)
    if (!supportsScreenRefresh(pathname)) return
    let active = true
    let running = false
    let start: { x: number; y: number } | null = null
    let distance = 0
    let feedbackTimer: ReturnType<typeof setTimeout>
    async function refresh() {
      if (running) return
      running = true
      setBusy(true)
      setStatus(copy.refreshing)
      try {
        const result = await refreshScreen(async () => { throw new Error('No screen refresh handler') })
        if (active) setStatus(result === 'blocked' ? copy.blocked : '')
      } catch { if (active) setStatus(copy.refreshError) }
      finally {
        running = false
        if (active) { setBusy(false); setPull(0); feedbackTimer = setTimeout(() => setStatus(''), 5000) }
      }
    }
    const resume = () => {
      if (document.visibilityState === 'visible' && isScreenStale()) void refresh()
    }
    const atTop = (target: Element) => {
      if (window.scrollY > 0 || document.body.style.overflow === 'hidden') return false
      for (let el: Element | null = target; el; el = el.parentElement) {
        if (el.scrollTop > 0) return false
        const style = getComputedStyle(el)
        if (el !== document.documentElement && /auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth) return false
      }
      return true
    }
    const touchStart = (event: TouchEvent) => {
      start = null; distance = 0
      const target = event.target instanceof Element ? event.target : null
      if (!target || !matchMedia('(max-width: 768px)').matches || running || event.touches.length !== 1
        || target.closest('input, textarea, select, button, a, [contenteditable], [role="dialog"]')
        || document.querySelector('[role="dialog"]') || !atTop(target)
        || (window.visualViewport && window.visualViewport.height < window.innerHeight - 100)) return
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY }
    }
    const touchMove = (event: TouchEvent) => {
      if (!start) return
      const touch = event.touches[0]
      const dx = Math.abs(touch.clientX - start.x)
      const dy = touch.clientY - start.y
      if (event.touches.length !== 1 || dy < 0 || dx > 24 || window.scrollY > 0) {
        start = null; distance = 0; setPull(0); return
      }
      if (dy < 12) return
      if (!event.cancelable) { start = null; return }
      event.preventDefault()
      distance = Math.min(90, dy * .6)
      setPull(distance)
    }
    const cancel = () => { start = null; distance = 0; setPull(0) }
    const release = () => {
      const ready = start && distance >= 66
      cancel()
      if (ready) void refresh()
    }
    window.addEventListener('legalhub:refresh', refresh)
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('focus', resume)
    window.addEventListener('pageshow', resume)
    document.addEventListener('touchstart', touchStart, { passive: true })
    document.addEventListener('touchmove', touchMove, { passive: false })
    document.addEventListener('touchend', release)
    document.addEventListener('touchcancel', cancel)
    return () => {
      active = false; clearTimeout(feedbackTimer)
      window.removeEventListener('legalhub:refresh', refresh)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('focus', resume)
      window.removeEventListener('pageshow', resume)
      document.removeEventListener('touchstart', touchStart)
      document.removeEventListener('touchmove', touchMove)
      document.removeEventListener('touchend', release)
      document.removeEventListener('touchcancel', cancel)
    }
  }, [pathname, copy])
  if (!pull && !status && !busy) return null
  return <div role="status" aria-live="polite" className="app-refresh-indicator">{pull ? (pull >= 66 ? copy.release : copy.pull) : status}</div>
}
