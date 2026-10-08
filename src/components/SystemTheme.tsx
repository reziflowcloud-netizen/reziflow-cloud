'use client'
import { useEffect } from 'react'

// Apple status style is a launch hint. Dynamic changes are best effort only.


export default function SystemTheme() {
  useEffect(() => {
    const apply = () => {
      const dark = ['dark', 'slate'].includes(document.documentElement.dataset.theme || '')
      const color = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
      document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', dark ? 'black' : 'default')
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return null
}
