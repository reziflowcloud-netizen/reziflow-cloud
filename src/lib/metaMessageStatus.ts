'use client'
export type MetaUnreadPreview = { leadId: string; leadName: string; count: number; total: number }
const empty: MetaUnreadPreview[] = []
let status = empty
const listeners = new Set<() => void>()
export const getMetaMessageStatus = () => status
export const getServerMetaMessageStatus = () => empty
export function subscribeMetaMessageStatus(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function publishMetaMessageStatus(value: MetaUnreadPreview[]) { status = value; listeners.forEach(listener => listener()) }
