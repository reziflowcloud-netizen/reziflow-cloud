'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'
import styles from './MetaLeadAds.module.css'

type Binding = { id: string; pageId: string; formId: string; mode: string; enabled: boolean;
  pilotLeadIds: string[]; credentialConfigured: boolean; counts: Record<string, number>; diagnostics: Record<string, number> }
type Result = { appConfigured: boolean; globallyEnabled: boolean; callbackPath: string; bindings: Binding[] }

const copy = {
  ru: { title: 'Meta Lead Ads — отдельная интеграция', back: 'Назад к интеграциям', intro: 'Привязка Page и Form к этой организации. Токены хранятся только в защищённой конфигурации сервера. Новая привязка выключена по умолчанию.', callback: 'Callback URL', app: 'Отдельное приложение', global: 'Глобальный приём', ready: 'настроено', missing: 'не настроено', page: 'Page ID', form: 'Form ID', ids: 'Разрешённые test Lead ID (через запятую)', add: 'Создать выключенную привязку', save: 'Сохранить', revoke: 'Отключить привязку', mode: 'Режим', off: 'Выключено', pilot: 'Пилот', shadow: 'Теневой режим', live: 'Рабочий режим', enabled: 'Приём включён', token: 'Page token', counts: 'Доставка', error: 'Не удалось сохранить. Проверьте права и разрешения пилота.', empty: 'Привязок пока нет.', pilotHint: 'Пилот принимает только перечисленные test Lead ID. Теневой режим не запрашивает Graph и не создаёт лиды.' },
  uk: { title: 'Meta Lead Ads — окрема інтеграція', back: 'Назад до інтеграцій', intro: 'Прив’язка Page і Form до цієї організації. Токени зберігаються лише у захищеній конфігурації сервера. Нова прив’язка вимкнена за замовчуванням.', callback: 'Callback URL', app: 'Окремий застосунок', global: 'Глобальний прийом', ready: 'налаштовано', missing: 'не налаштовано', page: 'Page ID', form: 'Form ID', ids: 'Дозволені test Lead ID (через кому)', add: 'Створити вимкнену прив’язку', save: 'Зберегти', revoke: 'Вимкнути прив’язку', mode: 'Режим', off: 'Вимкнено', pilot: 'Пілот', shadow: 'Тіньовий режим', live: 'Робочий режим', enabled: 'Прийом увімкнено', token: 'Page token', counts: 'Доставка', error: 'Не вдалося зберегти. Перевірте права та дозволи пілота.', empty: 'Прив’язок ще немає.', pilotHint: 'Пілот приймає лише перелічені test Lead ID. Тіньовий режим не запитує Graph і не створює ліди.' },
  pl: { title: 'Meta Lead Ads — osobna integracja', back: 'Wróć do integracji', intro: 'Powiązanie Page i Form z tą organizacją. Tokeny są przechowywane tylko w bezpiecznej konfiguracji serwera. Nowe powiązanie jest domyślnie wyłączone.', callback: 'Callback URL', app: 'Osobna aplikacja', global: 'Globalny odbiór', ready: 'skonfigurowano', missing: 'brak konfiguracji', page: 'Page ID', form: 'Form ID', ids: 'Dozwolone test Lead ID (oddzielone przecinkami)', add: 'Utwórz wyłączone powiązanie', save: 'Zapisz', revoke: 'Wyłącz powiązanie', mode: 'Tryb', off: 'Wyłączone', pilot: 'Pilot', shadow: 'Tryb obserwacji', live: 'Tryb produkcyjny', enabled: 'Odbiór włączony', token: 'Page token', counts: 'Dostawa', error: 'Nie udało się zapisać. Sprawdź uprawnienia i zgodę na pilotaż.', empty: 'Brak powiązań.', pilotHint: 'Pilot przyjmuje tylko wymienione test Lead ID. Tryb obserwacji nie pobiera danych z Graph i nie tworzy leadów.' },
}

export default function MetaLeadAdsPage() {
  const { lang } = useLanguage()
  const t = copy[lang as keyof typeof copy] || copy.ru
  const [data, setData] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pageId, setPageId] = useState('')
  const [formId, setFormId] = useState('')
  const [drafts, setDrafts] = useState<Record<string, Binding>>({})
  const [host, setHost] = useState('')

  async function load() {
    const response = await fetch('/api/meta-lead-ads/bindings', { cache: 'no-store' })
    if (!response.ok) { setError(t.error); return }
    const next = await response.json() as Result
    setData(next)
    setDrafts(Object.fromEntries(next.bindings.map(item => [item.id, item])))
  }
  useEffect(() => { setHost(window.location.origin); void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(body: Record<string, unknown>, method: 'POST' | 'PUT') {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/meta-lead-ads/bindings', { method,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error()
      await load()
    } catch { setError(t.error) } finally { setBusy(false) }
  }
  async function revoke(id: string) {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/meta-lead-ads/bindings', { method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!response.ok) throw new Error()
      await load()
    } catch { setError(t.error) } finally { setBusy(false) }
  }
  function update(id: string, patch: Partial<Binding>) { setDrafts(current => ({ ...current, [id]: { ...current[id], ...patch } })) }
  return <main className={styles.page}>
    <Link href="/settings/integrations">← {t.back}</Link>
    <h1>{t.title}</h1><p>{t.intro}</p>
    <div className={styles.info}><span>{t.app}: {data?.appConfigured ? t.ready : t.missing}</span><span>{t.global}: {data?.globallyEnabled ? t.ready : t.missing}</span></div>
    <label>{t.callback}<input readOnly value={host ? `${host}${data?.callbackPath || '/api/webhooks/meta/lead-ads'}` : ''} /></label>
    <p>{t.pilotHint}</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <section className={styles.card}>
      <h2>{t.add}</h2><div className={styles.grid}>
        <label>{t.page}<input inputMode="numeric" value={pageId} onChange={event => setPageId(event.target.value)} /></label>
        <label>{t.form}<input inputMode="numeric" value={formId} onChange={event => setFormId(event.target.value)} /></label>
      </div>
      <button disabled={busy || !pageId || !formId} onClick={() => void save({ pageId, formId, mode: 'off', enabled: false, pilotLeadIds: [] }, 'POST')}>{t.add}</button>
    </section>
    {!data?.bindings.length && <p>{t.empty}</p>}
    {data?.bindings.map(item => {
      const draft = drafts[item.id] || item
      return <section className={styles.card} key={item.id}>
        <h2>{t.page}: {item.pageId} · {t.form}: {item.formId}</h2>
        <p>{t.token}: {item.credentialConfigured ? t.ready : t.missing}</p>
        <div className={styles.grid}>
          <label>{t.mode}<select value={draft.mode} onChange={event => update(item.id, { mode: event.target.value })}>
            <option value="off">{t.off}</option><option value="pilot">{t.pilot}</option><option value="shadow">{t.shadow}</option><option value="live">{t.live}</option>
          </select></label>
          <label>{t.ids}<input value={draft.pilotLeadIds.join(', ')} onChange={event => update(item.id, { pilotLeadIds: event.target.value.split(',').map(value => value.trim()).filter(Boolean) })} /></label>
        </div>
        <label className={styles.check}><input type="checkbox" checked={draft.enabled} onChange={event => update(item.id, { enabled: event.target.checked })} />{t.enabled}</label>
        <button disabled={busy} onClick={() => void save({ id: item.id, mode: draft.mode, enabled: draft.enabled, pilotLeadIds: draft.pilotLeadIds }, 'PUT')}>{t.save}</button>
        <button disabled={busy || !item.enabled} onClick={() => void revoke(item.id)}>{t.revoke}</button>
        <p>{t.counts}: {Object.entries(item.counts).map(([status, count]) => `${status} ${count}`).join(' · ') || '0'}</p>
        {Object.keys(item.diagnostics || {}).length > 0 && <p role="status">{Object.entries(item.diagnostics).map(([code, count]) => `${code} ${count}`).join(' · ')}</p>}
      </section>
    })}
  </main>
}
