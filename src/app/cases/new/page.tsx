// src/app/cases/new/page.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/context/LanguageContext'
import { caseStatusLabel } from '@/lib/caseI18n'

function ClientCombobox({
  clients,
  value,
  onSelect,
  placeholder,
  noResultsText,
}: {
  clients: any[]
  value: string
  onSelect: (clientId: string) => void
  placeholder: string
  noResultsText: string
}) {
  const selectedClient = clients.find(client => client.id === value)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(selectedClient ? `${selectedClient.firstName || ''} ${selectedClient.lastName || ''}`.trim() : '')
  }, [selectedClient?.id])

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  const q = query.trim().toLowerCase()
  const results = q
    ? clients.filter(client => `${client.firstName || ''} ${client.lastName || ''} ${client.phone || ''}`.toLowerCase().includes(q))
    : clients

  function choose(clientId: string) {
    const client = clients.find(item => item.id === clientId)
    onSelect(clientId)
    setQuery(client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() : '')
    setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        className="input"
        value={query}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false)
        }}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
          if (!e.target.value.trim()) onSelect('')
        }}
        placeholder={placeholder}
        autoComplete="off"
        style={{ borderColor: !value ? 'var(--brand)' : undefined }}
      />
      {open && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 60, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.14)', maxHeight: 260, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 13 }}>{noResultsText}</div>
          ) : results.map(client => (
            <button
              key={client.id}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(client.id)}
              style={{ width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', borderTop: '1px solid var(--border)', background: client.id === value ? 'var(--bg)' : 'transparent', cursor: 'pointer' }}
            >
              <div style={{ fontWeight: 600 }}>{client.firstName} {client.lastName}</div>
              {client.phone && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{client.phone}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NewCasePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, lang } = useLanguage()
  const [clients, setClients] = useState<any[]>([])
  const [statuses, setStatuses] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [caseOptions, setCaseOptions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showNewClient, setShowNewClient] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)
  const [newClient, setNewClient] = useState({ firstName: '', lastName: '', phone: '', email: '' })
  const [form, setForm] = useState({
    clientId: searchParams.get('clientId') || '',
    caseNumber: '',
    status: 'Новый',
    serviceId: '',
    stayPurpose: '',
    stayType: '',
    contractType: '',
    totalValue: '',
    notes: '',
  })

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : []))
    fetch('/api/statuses').then(r => r.json()).then(d => setStatuses(Array.isArray(d) ? d : []))
    fetch('/api/services').then(r => r.json()).then(d => setServices(Array.isArray(d) ? d.filter((s: any) => s.active) : []))
    fetch('/api/case-options').then(r => r.json()).then(d => setCaseOptions(Array.isArray(d) ? d : []))
  }, [])

  function optionsByType(type: string) {
    return caseOptions.filter((o: any) => o.type === type).sort((a: any, b: any) => a.order - b.order)
  }

  function set(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))
  }

  function setNewClientField(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setNewClient(prev => ({ ...prev, [k]: e.target.value }))
  }

  async function createClient() {
    if (!newClient.firstName.trim() || !newClient.lastName.trim()) return alert(t('client_name_required'))
    setCreatingClient(true)
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newClient),
    })
    const data = await res.json()
    setCreatingClient(false)
    if (!res.ok) return alert(data.error || t('create_client_failed'))

    setClients(prev => [data, ...prev])
    setForm(prev => ({ ...prev, clientId: data.id }))
    setNewClient({ firstName: '', lastName: '', phone: '', email: '' })
    setShowNewClient(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.clientId) return alert(t('client_required'))
    setLoading(true)
    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, caseNumber: form.caseNumber?.trim() || '' }),
    })
    const data = await res.json()
    if (res.ok) router.push(`/cases/${data.id}`)
    else { alert(data.error || t('save_failed')); setLoading(false) }
  }

  // Хелпер: показывать fallback опции если база пустая
  function renderOptions(type: string, fallback: string[]) {
    const loaded = optionsByType(type)
    if (loaded.length > 0) {
      return loaded.map((o: any) => <option key={o.id} value={o.value}>{o.value}</option>)
    }
    return fallback.map(v => <option key={v} value={v}>{v}</option>)
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{t('new_case').replace('+ ', '')}</div>
          <div className="page-subtitle">{t('new_case_subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary">{t('cancel')}</button>
          <button type="button" onClick={handleSubmit} className="btn btn-primary" disabled={loading}>
            {loading ? t('creating_case') : `💾 ${t('create_case')}`}
          </button>
        </div>
      </div>

      <div className="page-body">
        <form onSubmit={handleSubmit}>
          {/* Клиент */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title"><span>👤</span>{t('client')}</div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                <label className="label" style={{ margin: 0 }}>{t('choose_client')} *</label>
                <button
                  type="button"
                  onClick={() => setShowNewClient(v => !v)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: 12 }}
                >
                  {showNewClient ? t('close') : t('new_client')}
                </button>
              </div>
              <ClientCombobox
                clients={clients}
                value={form.clientId}
                onSelect={clientId => setForm(prev => ({ ...prev, clientId }))}
                placeholder={t('client_search_placeholder')}
                noResultsText={t('clients_not_found')}
              />
              {showNewClient && (
                <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)' }}>
                  <div className="section-title" style={{ marginBottom: 10 }}>{t('quick_create_client')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label">{t('first_name')} *</label>
                      <input className="input" value={newClient.firstName} onChange={setNewClientField('firstName')} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label">{t('last_name')} *</label>
                      <input className="input" value={newClient.lastName} onChange={setNewClientField('lastName')} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label">{t('phone')}</label>
                      <input className="input" value={newClient.phone} onChange={setNewClientField('phone')} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label">Email</label>
                      <input className="input" type="email" value={newClient.email} onChange={setNewClientField('email')} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="button" onClick={createClient} className="btn btn-primary" disabled={creatingClient}>
                      {creatingClient ? t('creating_case') : t('create_and_select')}
                    </button>
                    <button type="button" onClick={() => setShowNewClient(false)} className="btn btn-secondary">{t('cancel')}</button>
                  </div>
                </div>
              )}
              {clients.length === 0 && (
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>
                  {t('no_clients_create_first')} <a href="/clients/new" style={{ color: 'var(--brand)' }}>{t('create_client_first')}</a>
                </div>
              )}
            </div>
          </div>

          {/* Данные дела */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title"><span>⚖️</span>{t('case_data')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="label">🛠 {t('service')}</label>
                <select className="select" value={form.serviceId} onChange={set('serviceId')}>
                  <option value="">{t('choose_service')}</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.price ? ` · ${s.price.toFixed(0)} zł` : ''}
                    </option>
                  ))}
                </select>
                {services.length === 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
                    {t('no_services')} <a href="/settings/services" style={{ color: 'var(--brand)' }}>{t('add_in_settings')}</a>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="label">{t('case_number_later')} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({t('can_fill_later')})</span></label>
                <input className="input" value={form.caseNumber} onChange={set('caseNumber')} placeholder={t('example_case_number')} style={{ fontFamily: 'monospace' }} />
              </div>

              <div className="form-group">
                <label className="label">{t('status')}</label>
                <select className="select" value={form.status} onChange={set('status')}>
                  {statuses.map(s => <option key={s.id} value={s.name}>{caseStatusLabel(lang, s.name)}</option>)}
                  {statuses.length === 0 && <option value="Новый">{caseStatusLabel(lang, 'Новый')}</option>}
                </select>
              </div>

              <div className="form-group">
                <label className="label">{t('service_cost')} (zł)</label>
                <input className="input" type="number" value={form.totalValue} onChange={set('totalValue')} placeholder="0.00" step="0.01" />
              </div>

              {/* Цель пребывания — из базы */}
              <div className="form-group">
                <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('stay_purpose')}</span>
                  <a href="/settings/case-options" style={{ fontSize: 11, color: 'var(--brand)' }}>+ {t('configure')}</a>
                </label>
                <select className="select" value={form.stayPurpose} onChange={set('stayPurpose')}>
                  <option value="">{t('choose')}</option>
                  {renderOptions('stayPurpose', [
                    'Побыт часовый (Временный)',
                    'Побыт сталый (Постоянный)',
                    'Побыт длуготорминовы (Долгосрочный)',
                  ])}
                </select>
              </div>

              {/* Тип занятости — из базы */}
              <div className="form-group">
                <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('stay_type')}</span>
                  <a href="/settings/case-options" style={{ fontSize: 11, color: 'var(--brand)' }}>+ {t('configure')}</a>
                </label>
                <select className="select" value={form.stayType} onChange={set('stayType')}>
                  <option value="">{t('choose')}</option>
                  {renderOptions('stayType', [
                    'Выконывание пацы (Работа)',
                    'Обучение',
                    'Воссоединение семьи',
                    'Бизнес',
                    'Другое',
                  ])}
                </select>
              </div>

              {/* Тип договора — из базы */}
              <div className="form-group">
                <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('contract_type')}</span>
                  <a href="/settings/case-options" style={{ fontSize: 11, color: 'var(--brand)' }}>+ {t('configure')}</a>
                </label>
                <select className="select" value={form.contractType} onChange={set('contractType')}>
                  <option value="">{t('choose')}</option>
                  {renderOptions('contractType', [
                    'Умова злецения (Договор подряда)',
                    'Умова о працу (Трудовой)',
                    'Умова о дзело (Договор)',
                  ])}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="label">{t('notes')}</label>
                <textarea className="input" value={form.notes} onChange={set('notes')} rows={3} placeholder={t('notes_placeholder')} />
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
