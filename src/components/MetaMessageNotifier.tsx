'use client'

import { useEffect, useRef, useState } from 'react'

type LatestMessage = {
  id: number
  source?: string | null
  createdAt: string
  leadId?: string | null
  leadName?: string | null
}

function playNoticeSound() {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioContextClass) return

  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(740, context.currentTime)
  oscillator.frequency.setValueAtTime(920, context.currentTime + 0.08)
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.3)
}

export default function MetaMessageNotifier() {
  const latestIdRef = useRef<number | null>(null)
  const initializedRef = useRef(false)
  const soundAllowedRef = useRef(false)
  const originalTitleRef = useRef<string | null>(null)
  const titleTimeoutRef = useRef<number | null>(null)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    originalTitleRef.current = document.title

    function allowSound() {
      soundAllowedRef.current = true
      window.removeEventListener('pointerdown', allowSound)
      window.removeEventListener('keydown', allowSound)
    }

    window.addEventListener('pointerdown', allowSound)
    window.addEventListener('keydown', allowSound)

    return () => {
      window.removeEventListener('pointerdown', allowSound)
      window.removeEventListener('keydown', allowSound)
      if (titleTimeoutRef.current) window.clearTimeout(titleTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    async function checkLatestMessage() {
      try {
        const response = await fetch('/api/notifications/meta-messages', { cache: 'no-store' })
        if (!response.ok) {
          if (response.status === 401) setEnabled(false)
          return
        }

        const data = await response.json()
        const latest = data.latest as LatestMessage | null
        if (!latest?.id) return

        if (!initializedRef.current) {
          initializedRef.current = true
          latestIdRef.current = latest.id
          return
        }

        if (latestIdRef.current !== latest.id) {
          latestIdRef.current = latest.id
          if (soundAllowedRef.current) playNoticeSound()

          if (originalTitleRef.current) {
            document.title = `Новое сообщение - ${originalTitleRef.current}`
            if (titleTimeoutRef.current) window.clearTimeout(titleTimeoutRef.current)
            titleTimeoutRef.current = window.setTimeout(() => {
              if (originalTitleRef.current) document.title = originalTitleRef.current
            }, 8000)
          }
        }
      } catch {
        // Notification polling should never interrupt CRM work.
      }
    }

    checkLatestMessage()
    const intervalId = window.setInterval(checkLatestMessage, 15000)
    return () => window.clearInterval(intervalId)
  }, [enabled])

  return null
}
