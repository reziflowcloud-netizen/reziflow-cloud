'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
export function useDocumentChecklist(caseId: string, serviceId?: number | null) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState(0)
  const [busy, setBusy] = useState(false)
  const requestRevision = useRef(0)
  const reload = useCallback(async () => {
    const revision = ++requestRevision.current
    const response = await fetch(`/api/cases/${caseId}/checklist`, { cache: 'no-store' })
    if (!response.ok) throw Object.assign(new Error('Checklist load failed'), { status: response.status })
    const result = await response.json()
    if (revision === requestRevision.current) { setData(result); setError(0) }
    return result
  }, [caseId])
  useEffect(() => { void reload().catch(error => setError(error.status || 500)) }, [reload, serviceId])
  const write = async (path: string, method: string, body: any) => {
    // A late pre-save GET must never replace an acknowledged checklist mutation.
    ++requestRevision.current
    const response = await fetch(`/api/cases/${caseId}/checklist${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) throw Object.assign(new Error('Checklist save failed'), { status: response.status })
    const result = await response.json(); ++requestRevision.current; setData(result); setError(0); return result
  }
  const action = async (action: string, extra: any = {}) => {
    setBusy(true); setError(0)
    try { await write('', 'POST', { action, expectedVersion: data.version, serviceId: data.serviceId, ...extra }); return true }
    catch (error: any) { setError(error.status || 500); return false } finally { setBusy(false) }
  }
  return { data, error, busy, reload, write, action }
}
export type ChecklistController = ReturnType<typeof useDocumentChecklist>
