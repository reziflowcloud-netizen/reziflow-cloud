'use client'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { useEntityAutosave } from '@/hooks/useEntityAutosave'
import EntitySaveStatus from './EntitySaveStatus'
import { appExperienceText } from '@/lib/appExperienceI18n'
import { documentChecklistText } from '@/lib/documentChecklistI18n'
import type { ChecklistController } from '@/hooks/useDocumentChecklist'
import { registerScreenLeave } from '@/lib/screenLeave'
import { MobileAccordion } from './mobile'
import styles from './DocumentChecklist.module.css'

export function ChecklistSummary({ controller, onView }: { controller: ChecklistController; onView: () => void }) {
  const { lang } = useLanguage(), copy = documentChecklistText[lang]
  const p = controller.data?.progress
  return <section className={styles.root} data-checklist-summary>
    <div className={styles.header}><strong>{copy.documents}</strong>{p && controller.data.initialized && <span>{p.received}/{p.required} {copy.ready}</span>}</div>
    {p && controller.data.initialized && <><progress className={styles.progress} value={p.received} max={p.required || 1} aria-label={copy.requiredProgress} /><div className={styles.muted}>{p.required ? `${p.waiting} ${copy.waiting}` : copy.noRequired}</div></>}
    <button className="btn btn-secondary" type="button" onClick={onView} style={{ marginTop: 8 }}>{copy.view}</button>
  </section>
}
export function ChecklistServicePrompt({ controller }: { controller: ChecklistController }) {
  const { lang } = useLanguage(), copy = documentChecklistText[lang], data = controller.data
  if (!data?.initialized || data.serviceId === data.templateServiceId) return null
  return <div className={styles.notice} role="alertdialog" aria-label={copy.serviceChanged} data-checklist-service-prompt>
    <p>{copy.serviceChanged}</p><div className={styles.actions}><button className="btn btn-primary" disabled={controller.busy} onClick={() => void controller.action('merge')}>{copy.update}</button><button className="btn btn-secondary" disabled={controller.busy} onClick={() => void controller.action('keep')}>{copy.keep}</button></div>
    {controller.error > 0 && <p role="alert">{controller.error === 409 ? copy.conflict : copy.error}<button className="btn btn-secondary" onClick={() => void controller.reload()}>{copy.reload}</button></p>}
  </div>
}
export default function DocumentChecklist({ controller, files = [], mosOnly = false }: { controller: ChecklistController; files?: any[]; mosOnly?: boolean }) {
  const { lang, t } = useLanguage(), copy = documentChecklistText[lang]
  const [filter, setFilter] = useState('all'), [selected, setSelected] = useState<string | null>(null), [adding, setAdding] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (saved) { const timer = setTimeout(() => setSaved(false), 3500); return () => clearTimeout(timer) } }, [saved])
  const data = controller.data, p = data?.progress
  const error = controller.error === 409 ? copy.conflict : copy.error
  if (!data) return <div className={styles.notice}>{controller.error ? error : copy.loading}<button className="btn btn-secondary" onClick={() => void controller.reload()}>{copy.retry}</button></div>
  const active = data.items.filter((item: any) => item.active && (!mosOnly || item.forMos))
  const list = active.filter((item: any) => filter === 'all' || filter === 'needed' && item.status === 'NEEDED' || filter === 'ready' && item.status !== 'NEEDED' || filter === 'mos' && item.forMos)
  const rows = (items: any[]) => <div className={styles.list}>{items.map((item: any) => {
    const status = item.status === 'NEEDED' ? copy.statusNeeded : item.status === 'RECEIVED' ? copy.received : copy.submitted
    return <button type="button" key={item.id} className={`${styles.item} ${mosOnly ? styles.mosItem : ''}`} onClick={() => { setSaved(false); setSelected(item.id) }} data-checklist-item={item.name} aria-label={`${copy.edit}: ${item.name} · ${status}`}>
      <span className={styles.statusControl} data-checklist-status-control={item.status === 'NEEDED' ? 'unchecked' : 'checked'} aria-hidden="true">{item.status !== 'NEEDED' && '✓'}</span>
      <span><strong>{item.name}</strong><span className={styles.muted}>{status}{(item.mosSubmittedAt || item.receivedAt) && ` · ${new Date(item.mosSubmittedAt || item.receivedAt).toLocaleDateString(lang === 'uk' ? 'uk-UA' : lang === 'pl' ? 'pl-PL' : 'ru-RU')}`}</span><span className={styles.badges}><span className={styles.badge}>{item.required ? copy.required : copy.optional}</span><span className={styles.badge}>{item.forMos ? 'MOS' : copy.notMos}</span><span className={styles.badge}>{item.files.length ? `${copy.files}: ${item.files.length}` : copy.noFiles}</span>{item.outsideTemplate && <span className={styles.badge}>{copy.outside}</span>}</span>{item.note && <span className={styles.muted}>{item.note}</span>}</span>
    </button>
  })}</div>
  const body = <>
    {controller.error > 0 && <div role="alert" className={styles.notice}>{error}<button className="btn btn-secondary" onClick={() => void controller.reload()}>{copy.reload}</button></div>}
    {!data.initialized ? <div className={styles.notice}><p>{copy.legacy}</p><button className="btn btn-primary" disabled={controller.busy} onClick={() => void controller.action('initialize')}>{copy.initialize}</button></div> : mosOnly ? <>
      <div className={styles.header}><h3>{t('mos_documents')}</h3></div>
      <div className={styles.mosGroups}>{[
        ['submitted', t('submitted_documents'), active.filter((item: any) => item.status === 'SUBMITTED_TO_MOS')],
        ['needed', t('documents_to_deliver'), active.filter((item: any) => item.status !== 'SUBMITTED_TO_MOS')],
      ].map(([key, title, items]) => <section key={key as string} className={styles.mosGroup} data-checklist-mos-group={key as string}>
        <h4>{title as string}<span className={styles.muted}>{(items as any[]).length}</span></h4>
        {rows(items as any[])}{!(items as any[]).length && <p className={styles.muted}>{key === 'submitted' ? t('click_doc_when_submitted') : t('all_mos_documents_submitted')}</p>}
      </section>)}</div>
    </> : <>
      <div className={styles.filters}>{[['all', copy.all], ['needed', copy.needed], ['ready', copy.completed], ['mos', 'MOS']].map(([value, label]) => <button type="button" className={`btn ${filter === value ? 'btn-primary' : 'btn-secondary'}`} key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      {rows(list)}{list.length === 0 && <p className={styles.muted}>{copy.empty}</p>}
      <button type="button" className="btn btn-secondary" data-checklist-add onClick={() => setAdding(true)}>{copy.add}</button>
    </>}
  </>
  return <section className={styles.root} data-document-checklist={mosOnly ? 'mos' : 'documents'}>
    {mosOnly ? body : <MobileAccordion allLayouts defaultOpen className={styles.accordion}
      title={<span className={styles.accordionTitle}><span>{copy.title}</span>{data.initialized && <span>{p.received}/{p.required} {copy.ready}</span>}</span>}
      summary={data.initialized && <><progress className={styles.progress} value={p.received} max={p.required || 1} aria-label={copy.requiredProgress} /><span className={styles.muted}>{copy.requiredProgress}: {p.required ? `${p.waiting} ${copy.waiting}` : copy.noRequired} · {copy.total}: {p.totalReceived}/{p.total}</span></>}>
      {body}
    </MobileAccordion>}
    {saved && <div className="case-save-status" data-state="saved" role="status" aria-live="polite">{appExperienceText[lang].saved}</div>}
    {selected && data.items.find((item: any) => item.id === selected)?.active && <ChecklistItemEditor key={selected} item={data.items.find((item: any) => item.id === selected)} controller={controller} files={files} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setSaved(true) }} />}
    {adding && <AddChecklistItem controller={controller} onClose={() => setAdding(false)} />}
  </section>
}

function ChecklistItemEditor({ item, controller, files, onClose, onSaved }: { item: any; controller: ChecklistController; files: any[]; onClose: () => void; onSaved: () => void }) {
  const { lang } = useLanguage(), copy = documentChecklistText[lang]
  const [operationError, setOperationError] = useState(0), [busy, setBusy] = useState(false), [fileId, setFileId] = useState('')
  const latest = useRef(item); latest.current = item
  const operation = useRef(false)
  const engine = useEntityAutosave(async (patch, version) => {
    const result = await controller.write(`/${item.id}`, 'PATCH', { ...patch, expectedVersion: Number(version) })
    return String(result.item.version)
  }, appExperienceText[lang].leave, () => false, key => ['status', 'note', 'submittedAt'].includes(key), false)
  useEffect(() => { engine.initialize({ status: item.status, note: item.note || '', submittedAt: item.mosSubmittedAt?.slice(0, 10) || '' }, String(item.version)) }, [engine, item.id])
  const close = async () => { if (!operation.current && await engine.flush()) onClose() }
  const dialogRef = useDialogFocus(() => void close())
  const explicit = async (run: () => Promise<any>) => {
    if (operation.current) return
    operation.current = true; setBusy(true); setOperationError(0)
    try { if (!await engine.flush()) return; await run(); engine.initialize({ status: latest.current.status, note: latest.current.note || '', submittedAt: latest.current.mosSubmittedAt?.slice(0, 10) || '' }, String(latest.current.version)) }
    catch (error: any) { setOperationError(error.status || 500) }
    finally { operation.current = false; setBusy(false) }
  }
  const save = async () => {
    if (operation.current) return
    operation.current = true; setBusy(true); setOperationError(0)
    try { if (await engine.flush(true)) onSaved() }
    finally { operation.current = false; setBusy(false) }
  }
  // React state may render after the response: explicit writes reinitialize from their returned payload.
  const fileAction = async (documentId: number, unlink = false) => {
    const result = await controller.write(`/${item.id}/files`, 'POST', { documentId, unlink, expectedVersion: Number(engine.version) })
    const current = result.items.find((row: any) => row.id === item.id); latest.current = current
    setFileId('')
  }
  const linkedIds = new Set(controller.data.items.filter((row: any) => row.id !== item.id).flatMap((row: any) => row.files.map((file: any) => file.id)))
  return <div className={styles.overlay} onClick={() => void close()}><div ref={dialogRef} className={styles.editor} role="dialog" aria-modal="true" aria-label={item.name} onClick={event => event.stopPropagation()}>
    <div className={styles.header}><h3>{item.name}</h3><button className="btn btn-secondary" disabled={busy} onClick={() => void close()}>{copy.close}</button></div>
    <label>{copy.status}<select className="select" value={String(engine.values.status || item.status)} disabled={busy} onChange={event => { engine.change('status', event.target.value); engine.change('submittedAt', event.target.value === 'SUBMITTED_TO_MOS' ? new Date().toISOString().slice(0, 10) : '') }}><option value="NEEDED">{copy.statusNeeded}</option><option value="RECEIVED">{copy.received}</option>{item.forMos && <option value="SUBMITTED_TO_MOS">{copy.submitted}</option>}</select></label>
    {engine.values.status === 'SUBMITTED_TO_MOS' && <label>{copy.submittedDate}<input className="input" disabled={busy} type="date" max={new Date().toISOString().slice(0, 10)} value={String(engine.values.submittedAt || '')} onChange={event => engine.change('submittedAt', event.target.value)} /></label>}
    <label>{copy.note}<textarea className="input" disabled={busy} maxLength={2000} rows={3} value={String(engine.values.note || '')} onChange={event => engine.change('note', event.target.value)} /></label>
    <EntitySaveStatus engine={engine} lang={lang} reload={() => { void controller.reload().then(result => { const row = result.items.find((row: any) => row.id === item.id); engine.initialize({ status: row.status, note: row.note || '', submittedAt: row.mosSubmittedAt?.slice(0, 10) || '' }, String(row.version)) }) }} />
    <h4>{copy.files}</h4>{item.files.map((file: any) => <div className={styles.file} key={file.id}><a href={`/api/documents/${file.id}/file`} target="_blank" rel="noreferrer">{file.name}</a><button className="btn btn-secondary" disabled={busy} onClick={() => void explicit(() => fileAction(file.id, true))}>{copy.unlink}</button></div>)}
    <label>{copy.link}<select className="select" disabled={busy} value={fileId} onChange={event => setFileId(event.target.value)}><option value="">—</option>{files.filter(file => !linkedIds.has(file.id) && !item.files.some((linked: any) => linked.id === file.id)).map(file => <option value={file.id} key={file.id}>{file.name}</option>)}</select></label><button className="btn btn-secondary" disabled={!fileId || busy} onClick={() => void explicit(() => fileAction(Number(fileId)))}>{copy.link}</button>
    {operationError > 0 && <p role="alert">{operationError === 409 ? copy.conflict : copy.error}</p>}
    <div className={styles.actions} style={{ marginTop: 16 }}><button className="btn btn-primary" data-checklist-save disabled={busy} onClick={() => void save()}>{busy ? appExperienceText[lang].saving : copy.save}</button><button className="btn btn-secondary" disabled={busy} onClick={() => { if (confirm(copy.archiveConfirm)) void explicit(async () => { await controller.write(`/${item.id}`, 'DELETE', { expectedVersion: Number(engine.version) }); onClose() }) }}>{copy.archive}</button></div>
  </div></div>
}
function AddChecklistItem({ controller, onClose }: { controller: ChecklistController; onClose: () => void }) {
  const { lang } = useLanguage(), copy = documentChecklistText[lang]
  const [name, setName] = useState(''), [required, setRequired] = useState(true), [forMos, setForMos] = useState(false)
  const dirty = useRef(false); dirty.current = !!name.trim()
  useEffect(() => registerScreenLeave(async () => !dirty.current || !confirm(appExperienceText[lang].leave), () => dirty.current), [lang])
  const dialogRef = useDialogFocus(onClose)
  return <div className={styles.overlay}><div ref={dialogRef} className={styles.editor} role="dialog" aria-modal="true" aria-label={copy.add}>
    <h3>{copy.add}</h3><label>{copy.name}<input className="input" autoFocus maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label><label className={styles.check}><input type="checkbox" checked={required} onChange={event => setRequired(event.target.checked)} />{copy.required}</label><label className={styles.check}><input type="checkbox" checked={forMos} onChange={event => setForMos(event.target.checked)} />{copy.mos}</label>
    {controller.error > 0 && <p role="alert">{controller.error === 409 ? copy.conflict : copy.error}<button className="btn btn-secondary" onClick={() => void controller.reload()}>{copy.reload}</button></p>}
    <div className={styles.actions}><button className="btn btn-secondary" onClick={onClose}>{copy.cancel}</button><button className="btn btn-primary" disabled={!name.trim() || controller.busy} onClick={() => void controller.action('add', { name, required, forMos }).then(ok => { if (ok) onClose() })}>{copy.add}</button></div>
  </div></div>
}

function useDialogFocus(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null), close = useRef(onClose); close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const controls = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]') || [])
    controls()[0]?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const elements = controls(), first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus() }
  }, [])
  return ref
}
