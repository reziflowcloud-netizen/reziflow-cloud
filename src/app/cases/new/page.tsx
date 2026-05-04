// src/app/cases/new/page.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ClientCombobox({
  clients,
  value,
  onSelect,
}: {
  clients: any[]
  value: string
  onSelect: (clientId: string) => void
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
        placeholder="Начните вводить имя или фамилию"
        autoComplete="off"
        style={{ borderColor: !value ? 'var(--brand)' : undefined }}
      />
      {open && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 60, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.14)', maxHeight: 260, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 13 }}>Клиенты не найдены</div>
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
    if (!newClient.firstName.trim() || !newClient.lastName.trim()) return alert('Введите имя и фамилию клиента')
    setCreatingClient(true)
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newClient),
    })
    const data = await res.json()
    setCreatingClient(false)
    if (!res.ok) return alert(data.error || 'Не удалось создать клиента')

    setClients(prev => [data, ...prev])
    setForm(prev => ({ ...prev, clientId: data.id }))
    setNewClient({ firstName: '', lastName: '', phone: '', email: '' })
    setShowNewClient(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.clientId) return alert('Выберите клиента')
    setLoading(true)
    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, caseNumber: form.caseNumber?.trim() || '' }),
    })
    const data = await res.json()
    if (res.ok) router.push(`/cases/${data.id}`)
    else { alert(data.error || 'Ошибка'); setLoading(false) }
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
          <div className="page-title">Новое дело</div>
          <div className="page-subtitle">Создайте дело для клиента</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary">Отмена</button>
          <button type="button" onClick={handleSubmit} className="btn btn-primary" disabled={loading}>
            {loading ? 'Создание...' : '💾 Создать дело'}
          </button>
        </div>
      </div>

      <div className="page-body">
        <form onSubmit={handleSubmit}>
          {/* Клиент */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title"><span>👤</span>Клиент</div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                <label className="label" style={{ margin: 0 }}>Выберите клиента *</label>
                <button
                  type="button"
                  onClick={() => setShowNewClient(v => !v)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: 12 }}
                >
                  {showNewClient ? 'Закрыть' : '+ Новый клиент'}
                </button>
              </div>
              <ClientCombobox
                clients={clients}
                value={form.clientId}
                onSelect={clientId => setForm(prev => ({ ...prev, clientId }))}
              />
              {showNewClient && (
                <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)' }}>
                  <div className="section-title" style={{ marginBottom: 10 }}>Быстро создать клиента</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label">Имя *</label>
                      <input className="input" value={newClient.firstName} onChange={setNewClientField('firstName')} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label">Фамилия *</label>
                      <input className="input" value={newClient.lastName} onChange={setNewClientField('lastName')} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label">Телефон</label>
                      <input className="input" value={newClient.phone} onChange={setNewClientField('phone')} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label">Email</label>
                      <input className="input" type="email" value={newClient.email} onChange={setNewClientField('email')} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="button" onClick={createClient} className="btn btn-primary" disabled={creatingClient}>
                      {creatingClient ? 'Создание...' : '+ Создать и выбрать'}
                    </button>
                    <button type="button" onClick={() => setShowNewClient(false)} className="btn btn-secondary">Отмена</button>
                  </div>
                </div>
              )}
              {clients.length === 0 && (
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>
                  Нет клиентов. <a href="/clients/new" style={{ color: 'var(--brand)' }}>Создайте сначала клиента →</a>
                </div>
              )}
            </div>
          </div>

          {/* Данные дела */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title"><span>⚖️</span>Данные дела</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="label">🛠 Услуга</label>
                <select className="select" value={form.serviceId} onChange={set('serviceId')}>
                  <option value="">— Выберите услугу —</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.price ? ` · ${s.price.toFixed(0)} zł` : ''}
                    </option>
                  ))}
                </select>
                {services.length === 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
                    Нет услуг. <a href="/settings/services" style={{ color: 'var(--brand)' }}>Добавить в настройках →</a>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="label">Номер дела <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(можно заполнить позже)</span></label>
                <input className="input" value={form.caseNumber} onChange={set('caseNumber')} placeholder="Например: SC-II.1234.567/2026" style={{ fontFamily: 'monospace' }} />
              </div>

              <div className="form-group">
                <label className="label">Статус</label>
                <select className="select" value={form.status} onChange={set('status')}>
                  {statuses.map(s => <option key={s.id}>{s.name}</option>)}
                  {statuses.length === 0 && <option>Новый</option>}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Стоимость услуги (zł)</label>
                <input className="input" type="number" value={form.totalValue} onChange={set('totalValue')} placeholder="0.00" step="0.01" />
              </div>

              {/* Цель пребывания — из базы */}
              <div className="form-group">
                <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Цель пребывания</span>
                  <a href="/settings/case-options" style={{ fontSize: 11, color: 'var(--brand)' }}>+ настроить</a>
                </label>
                <select className="select" value={form.stayPurpose} onChange={set('stayPurpose')}>
                  <option value="">Выберите</option>
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
                  <span>Тип занятости</span>
                  <a href="/settings/case-options" style={{ fontSize: 11, color: 'var(--brand)' }}>+ настроить</a>
                </label>
                <select className="select" value={form.stayType} onChange={set('stayType')}>
                  <option value="">Выберите</option>
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
                  <span>Тип договора</span>
                  <a href="/settings/case-options" style={{ fontSize: 11, color: 'var(--brand)' }}>+ настроить</a>
                </label>
                <select className="select" value={form.contractType} onChange={set('contractType')}>
                  <option value="">Выберите</option>
                  {renderOptions('contractType', [
                    'Умова злецения (Договор подряда)',
                    'Умова о працу (Трудовой)',
                    'Умова о дзело (Договор)',
                  ])}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="label">Заметки</label>
                <textarea className="input" value={form.notes} onChange={set('notes')} rows={3} placeholder="Дополнительная информация..." />
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
