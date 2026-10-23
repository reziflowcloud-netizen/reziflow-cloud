'use client'

import { useCallback, useEffect, useState } from 'react'
import type { StaffScopeValue } from '@/lib/staffScope'
import { leadScopeOwner, readLeadScopeQuery, readLeadScope, restoreLeadScope, validateLeadScope, writeLeadScope, type LeadScopeMetadata, type LeadScopeQuery } from '@/lib/leadScopePersistence'

export function useLeadScopePersistence(userId: number, organizationId: string, restricted: boolean) {
  const owner = leadScopeOwner(userId, organizationId)
  const [value, setValue] = useState<StaffScopeValue>(restricted ? 'mine' : 'all')
  const [metadata, setMetadata] = useState<LeadScopeMetadata | null>(null)
  const [unvalidatedQuery, setUnvalidatedQuery] = useState<LeadScopeQuery>({staffScope: null, staffScopeOwner: null})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    const abort = new AbortController()
    let current: LeadScopeMetadata | null = null
    const restore = () => {
      setUnvalidatedQuery(readLeadScopeQuery(new URLSearchParams(window.location.search)))
      if (!current) return
      let saved: unknown = null
      try { saved = readLeadScope(owner, window.localStorage) } catch { /* SecurityError getter */ }
      setValue(restoreLeadScope(new URLSearchParams(window.location.search), owner, saved, current))
    }
    restore()
    setReady(false)
    setMetadata(null)
    setValue(restricted ? 'mine' : 'all')
    fetch('/api/staff-scope', { cache: 'no-store', signal: abort.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Staff metadata unavailable')
        return response.json()
      })
      .then((data: LeadScopeMetadata) => {
        if (!active) return
        if (data.userId !== userId || data.organizationId !== organizationId || !Array.isArray(data.employees)) {
          throw new Error('Staff identity changed')
        }
        current = data
        restore()
        setMetadata(data)
        setReady(true)
      })
      .catch(() => { if (active) setReady(true) })
    window.addEventListener('popstate', restore)
    return () => {
      active = false
      abort.abort()
      window.removeEventListener('popstate', restore)
    }
  }, [owner, userId, organizationId, restricted])

  const onChange = useCallback((next: StaffScopeValue) => {
    if (metadata) setValue(validateLeadScope(next, metadata))
  }, [metadata])

  useEffect(() => {
    if (!ready || !metadata) return
    try { writeLeadScope(owner, value, window.localStorage) } catch { /* SecurityError getter */ }
  }, [owner, ready, metadata, value])

  return { staffScope: value, setStaffScope: onChange, staffScopeReady: ready, staffScopeMetadata: metadata, staffScopeOwner: owner, unvalidatedScopeQuery: unvalidatedQuery }
}
