'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EntityAutosave } from '@/lib/caseAutosave'
import { registerScreenLeave } from '@/lib/screenLeave'

export function useEntityAutosave(
  write: (patch: Record<string, unknown>, version: string) => Promise<string>,
  leaveMessage: string,
  hasOtherDrafts: () => boolean,
  allowed?: (key: string) => boolean,
) {
  const [, render] = useState(0)
  const router = useRouter()
  const current = useRef({ write, hasOtherDrafts, leaveMessage })
  current.current = { write, hasOtherDrafts, leaveMessage }
  const ref = useRef<EntityAutosave>()
  if (!ref.current) ref.current = new EntityAutosave((patch, version) => current.current.write(patch, version), () => render(n => n + 1), allowed)
  const barrier = useRef(false)
  const engine = ref.current
  useEffect(() => {
    let navigating = false
    const leave = async () => {
      const ok = await engine.flush()
      return (ok && !current.current.hasOtherDrafts()) || !window.confirm(current.current.leaveMessage)
    }
    const unregister = registerScreenLeave(leave)
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (engine.dirty || engine.busy || current.current.hasOtherDrafts()) { event.preventDefault(); event.returnValue = '' }
    }
    // Next links, bottom navigation and Back share a save barrier. Unsafe actions remain explicit.
    const click = async (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!link || link.target === '_blank' || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
        || (!engine.dirty && !engine.busy && !current.current.hasOtherDrafts())) return
      const url = new URL(link.href, location.href)
      if (url.href === location.href || url.protocol !== 'http:' && url.protocol !== 'https:') return
      event.preventDefault(); event.stopPropagation()
      if (navigating) return
      navigating = true
      try {
        if (!await leave()) return
        if (url.origin === location.origin) router.push(url.pathname + url.search + url.hash)
        else location.assign(url.href)
      } finally { navigating = false }
    }
    // Duplicate the current history entry; Back first hits this barrier, never unmounting dirty state.
    const href = location.href
    if (!barrier.current && !history.state?.legalhubSaveBarrier) { history.pushState({ ...history.state, legalhubSaveBarrier: true }, '', href); barrier.current = true }
    const back = async () => {
      if (navigating) return
      if (!engine.dirty && !engine.busy && !current.current.hasOtherDrafts()) { navigating = true; history.back(); return }
      history.pushState({ ...history.state, legalhubSaveBarrier: true }, '', href)
      navigating = true
      if (!await leave()) { navigating = false; return }
      history.go(-2)
    }
    const hidden = () => { if (document.visibilityState === 'hidden') void engine.flush() }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('popstate', back)
    document.addEventListener('click', click, true)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      engine.dispose()
      unregister()
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('popstate', back)
      document.removeEventListener('click', click, true)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [engine, router])
  return engine
}
