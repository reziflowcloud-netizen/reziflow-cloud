'use client'
import { useEffect, type RefObject } from 'react'
// Called only for the rendered conversation pane. Overview and failed loads have
// no snapshot. Never compute a watermark from a later server query or wall clock.
export function useMetaMessageAck(ref: RefObject<HTMLElement>, leadId: string, snapshot: string | null, active = true) {
 useEffect(() => {
  const element = ref.current
  if (!element || !snapshot || !active) return
  let visible = false, stopped = false, sent = false, frame = 0
  const controller = new AbortController()
  const acknowledge = () => {
   if (sent || stopped || !visible || document.visibilityState !== 'visible' || element.getBoundingClientRect().width === 0) return
   frame = requestAnimationFrame(() => {
    if (stopped || document.visibilityState !== 'visible' || !visible) return
    sent = true
    void fetch(`/api/leads/${encodeURIComponent(leadId)}/messages/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ snapshot }), signal: controller.signal }).then(response => {
     if (response.ok && !stopped) { window.dispatchEvent(new Event('meta-messages-read')); try { const channel = new BroadcastChannel('legalhub-meta-read'); channel.postMessage('read'); channel.close() } catch {} }
    }).catch(() => undefined)
   })
  }
  const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting === true; acknowledge() })
  observer.observe(element)
  document.addEventListener('visibilitychange', acknowledge)
  return () => { stopped = true; controller.abort(); cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', acknowledge) }
 }, [ref, leadId, snapshot, active])
}
