'use client'
export function invalidateMetaSession() {
 window.dispatchEvent(new Event('meta-session-changed'))
 try { localStorage.setItem('legalhub-meta-session', crypto.randomUUID()) } catch {}
}
