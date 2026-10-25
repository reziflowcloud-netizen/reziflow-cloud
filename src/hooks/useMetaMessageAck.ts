'use client'
import { useEffect, type RefObject } from 'react'
// Called only for the rendered conversation pane. Overview and failed loads have
// no snapshot. Never compute a watermark from a later server query or wall clock.
export function useMetaMessageAck(ref: RefObject<HTMLElement>, leadId: string, snapshot: string | null, active = true) {
 useEffect(() => {
  const element = ref.current
  if (!element || !snapshot || !active) return
  let visible = false, stopped = false, sent = false, inFlight = false, attempts = 0, frame = 0
  const controller = new AbortController()
  const acknowledge = () => {
   if (sent || inFlight || attempts >= 3 || stopped || !visible || document.visibilityState !== 'visible' || element.getBoundingClientRect().width === 0) return
   frame = requestAnimationFrame(() => {
    if (stopped || sent || inFlight || attempts >= 3 || document.visibilityState !== 'visible' || !visible) return
    inFlight = true; attempts++
    void fetch(`/api/leads/${encodeURIComponent(leadId)}/messages/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ snapshot }), signal: controller.signal }).then(response => {
     if (response.ok && !stopped) { sent = true; window.dispatchEvent(new Event('meta-messages-read')); try { const channel = new BroadcastChannel('legalhub-meta-read'); channel.postMessage('read'); channel.close() } catch {} }
    }).catch(() => undefined).finally(() => { inFlight = false })
   })
  }
  const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting === true; acknowledge() })
  observer.observe(element)
  document.addEventListener('visibilitychange', acknowledge)
  window.addEventListener('focus', acknowledge)
  return () => { stopped = true; controller.abort(); cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', acknowledge); window.removeEventListener('focus', acknowledge) }
 }, [ref, leadId, snapshot, active])
}
