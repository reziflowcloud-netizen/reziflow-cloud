'use client'
import { useEffect, useRef } from 'react'
import { publishMetaMessageStatus } from '@/lib/metaMessageStatus'
const VISIBLE_POLL_INTERVAL_MS = 30_000

async function playNoticeSound(allowed: () => boolean) {
 const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
 if (!AudioContextClass) return
 const context = new AudioContextClass()
 try {
  let timer: ReturnType<typeof setTimeout> | undefined
  const resumed = await Promise.race([context.resume().then(() => true), new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 500) })]).finally(() => clearTimeout(timer))
  if (!resumed || !allowed()) return
  if (context.state !== 'running') return
  const oscillator = context.createOscillator(), gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(740, context.currentTime)
  oscillator.frequency.setValueAtTime(920, context.currentTime + 0.08)
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28)
  oscillator.connect(gain); gain.connect(context.destination)
  await new Promise<void>(resolve => { oscillator.onended = () => resolve(); oscillator.start(); oscillator.stop(context.currentTime + 0.3) })
 } finally { void context.close().catch(() => undefined) }
}
export default function MetaMessageNotifier() {
 const setUnread = publishMetaMessageStatus
 const pollingEnabledRef = useRef(true)
 useEffect(() => {
  let disposed = false, inFlight = false, refreshPending = false, generation = 0, latestId: number | null = null, identity: string | null = null, initialized = false, soundAllowed = false, signature = ''
  let suppressSoundNext = false
  let timeoutId: number | null = null
  const controller = new AbortController()
  function clearTimer() { if (timeoutId !== null) window.clearTimeout(timeoutId); timeoutId = null }
  function scheduleNext() {
   clearTimer()
   if (disposed || !pollingEnabledRef.current || document.visibilityState !== 'visible') return
   timeoutId = window.setTimeout(() => void checkLatestMessage(), VISIBLE_POLL_INTERVAL_MS)
  }
  const allowSound = () => { soundAllowed = true }
  const invalidate = () => { generation++; pollingEnabledRef.current = false; initialized = false; latestId = null; identity = null; signature = ''; setUnread([]); clearTimer() }
  const storage = (event: StorageEvent) => { if (event.key === 'legalhub-meta-session') invalidate() }
  async function soundOnce(data: any, requestGeneration: number) {
   const key = `legalhub-meta-sound:${data.userKey}`
   const play = async () => {
    if (disposed || !pollingEnabledRef.current || generation !== requestGeneration || document.visibilityState !== 'visible') return
    try { if (Number(localStorage.getItem(key) || 0) >= data.latest.id) return; localStorage.setItem(key, String(data.latest.id)) } catch { return }
    await playNoticeSound(() => !disposed && pollingEnabledRef.current && generation === requestGeneration && document.visibilityState === 'visible').catch(() => undefined)
   }
   if (navigator.locks) await navigator.locks.request(key, play)
   else await play()
  }
  async function checkLatestMessage() {
   if (disposed || inFlight || !pollingEnabledRef.current || document.visibilityState !== 'visible') return
   const requestGeneration = generation
   inFlight = true
   try {
    const response = await fetch('/api/notifications/meta-messages', { cache: 'no-store', signal: controller.signal })
    if (disposed || requestGeneration !== generation) return
    if (!response.ok) { if (response.status === 401) invalidate(); return }
    const data = await response.json()
    if (disposed || requestGeneration !== generation) return
    if (data.enabled === false) { pollingEnabledRef.current = false; setUnread([]); return }
    if (identity !== null && identity !== data.userKey) { initialized = false; latestId = null; signature = ''; setUnread([]) }
    identity = data.userKey
    setUnread(Array.isArray(data.unread) ? data.unread : [])
    const nextSignature = JSON.stringify([data.userKey, data.visualRevision])
    if (signature !== nextSignature) window.dispatchEvent(new Event('meta-messages-changed'))
    signature = nextSignature
    const fresh = initialized && data.latest?.id && data.latest.id > (latestId || 0)
    latestId = Math.max(latestId || 0, data.latest?.id || 0)
    // Initialize even an empty inbox. First future event is a fresh arrival.
    initialized = true
    if (fresh && !suppressSoundNext && data.sound === true && soundAllowed && document.visibilityState === 'visible') void soundOnce(data, requestGeneration).catch(() => undefined)
    suppressSoundNext = false
   } catch { /* Alerts must never interrupt CRM work. */ }
   finally { inFlight = false; if (refreshPending) { refreshPending = false; void checkLatestMessage() } else scheduleNext() }
  }
  function handleVisibilityChange() { clearTimer(); if (document.visibilityState === 'visible') void checkLatestMessage() }
  const refresh = () => { generation++; if (inFlight) refreshPending = true; else void checkLatestMessage() }
  const preferences = () => { suppressSoundNext = true; refresh() }
  let preferenceChannel: BroadcastChannel | null = null, readChannel: BroadcastChannel | null = null
  try { preferenceChannel = new BroadcastChannel('legalhub-meta-preferences'); preferenceChannel.onmessage = preferences; readChannel = new BroadcastChannel('legalhub-meta-read'); readChannel.onmessage = () => window.dispatchEvent(new Event('meta-messages-read')) } catch {}
  window.addEventListener('pointerdown', allowSound); window.addEventListener('keydown', allowSound)
  window.addEventListener('meta-session-changed', invalidate); window.addEventListener('storage', storage)
  window.addEventListener('meta-preferences-changed', preferences); window.addEventListener('meta-messages-read', refresh)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  if (document.visibilityState === 'visible') void checkLatestMessage()
  return () => {
   disposed = true; generation++; setUnread([]); clearTimer(); controller.abort(); preferenceChannel?.close(); readChannel?.close()
   window.removeEventListener('pointerdown', allowSound); window.removeEventListener('keydown', allowSound)
   window.removeEventListener('meta-session-changed', invalidate); window.removeEventListener('storage', storage)
   window.removeEventListener('meta-preferences-changed', preferences); window.removeEventListener('meta-messages-read', refresh)
   document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
 }, [])
 return null
}
