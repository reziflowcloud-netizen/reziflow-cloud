'use client'
import { useEffect, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { documentChecklistText } from '@/lib/documentChecklistI18n'
import styles from './DocumentChecklist.module.css'
export default function ServiceDocumentTemplate({ serviceId }: { serviceId: number }) {
  const { lang } = useLanguage(), copy = documentChecklistText[lang]
  const [template, setTemplate] = useState<any>(null), [error, setError] = useState(0), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false)
  const load = async () => { const res = await fetch(`/api/services/${serviceId}/document-template`); if (!res.ok) throw new Error(); setTemplate(await res.json()); setError(0) }
  useEffect(() => { void load().catch(() => setError(500)) }, [serviceId])
  const edit = (index: number, field: string, value: any) => { setSaved(false); setTemplate((old: any) => ({ ...old, items: old.items.map((item: any, i: number) => i === index ? { ...item, [field]: value } : item) })) }
  const move = (index: number, delta: number) => { setSaved(false); setTemplate((old: any) => { const items = [...old.items]; [items[index], items[index + delta]] = [items[index + delta], items[index]]; return { ...old, items } }) }
  const save = async () => {
    setBusy(true); setError(0); setSaved(false)
    try { const res = await fetch(`/api/services/${serviceId}/document-template`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedVersion: template.version, items: template.items }) }); if (!res.ok) throw Object.assign(new Error(), { status: res.status }); setTemplate(await res.json()); setSaved(true) }
    catch (error: any) { setError(error.status || 500) } finally { setBusy(false) }
  }
  return <div className={styles.root} data-service-document-template>
    <h3>{copy.template}</h3><p className={styles.muted}>{copy.templateHint}</p>{template?.legacy && <p className={styles.notice}>{copy.legacyTemplate}</p>}
    {error > 0 && <p role="alert">{error === 409 ? copy.conflict : copy.error}<button className="btn btn-secondary" onClick={() => void load()}>{copy.reload}</button></p>}
    {template ? <><fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>{template.items.map((item: any, index: number) => <div className={styles.templateRow} key={item.id || `draft-${index}`}>
      <input className="input" aria-label={copy.name} maxLength={200} value={item.name} onChange={event => edit(index, 'name', event.target.value)} />
      <label><input type="checkbox" checked={item.required} onChange={event => edit(index, 'required', event.target.checked)} />{copy.required}</label>
      <label><input type="checkbox" checked={item.forMos} onChange={event => edit(index, 'forMos', event.target.checked)} />{copy.mos}</label>
      <button className="btn btn-secondary" title={copy.up} aria-label={copy.up} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button className="btn btn-secondary" title={copy.down} aria-label={copy.down} disabled={index === template.items.length - 1} onClick={() => move(index, 1)}>↓</button>
      <button className="btn btn-secondary" onClick={() => { if (!item.active || confirm(copy.archiveConfirm)) edit(index, 'active', !item.active) }}>{item.active ? copy.archive : copy.active}</button>{!item.active && <span className={styles.muted}>{copy.archived}</span>}
    </div>)}</fieldset>
    <div className={styles.actions} style={{ marginTop: 12 }}><button className="btn btn-secondary" disabled={busy} onClick={() => { setSaved(false); setTemplate((old: any) => ({ ...old, items: [...old.items, { id: '', name: '', required: true, forMos: false, active: true }] })) }}>{copy.add}</button><button className="btn btn-primary" disabled={busy || template.items.some((item: any) => !item.name.trim())} onClick={() => void save()}>{copy.save}</button></div>{saved && <p role="status">{copy.templateSaved}</p>}
    </> : <p>{copy.loading}</p>}
  </div>
}
