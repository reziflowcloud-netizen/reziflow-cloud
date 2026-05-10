'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LEAD_SOURCES, LEAD_STATUSES, leadDisplayName } from '@/lib/leads'

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  'Новый': { bg: '#eff6ff', color: '#1d4ed8' },
  'Первый контакт': { bg: '#e0f2fe', color: '#0369a1' },
  'Квалификация': { bg: '#fef3c7', color: '#92400e' },
  'Прогрев': { bg: '#ede9fe', color: '#5b21b6' },
  'Готов к сделке': { bg: '#dcfce7', color: '#166534' },
  'Не подходит': { bg: '#fef2f2', color: '#991b1b' },
  'Переведён в клиента': { bg: '#f3f4f6', color: '#374151' },
}

function sourceLabel(value: string) {
  return LEAD_SOURCES.find(source => source.value === value)?.label || value
}

function initials(lead: any) {
  return leadDisplayName(lead).slice(0, 2).toUpperCase()
}

function dateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatLeadDateTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (source) params.set('source', source)
    fetch(`/api/leads?${params.toString()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setLeads(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [status, source])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return leads
    return leads.filter(lead => [
      leadDisplayName(lead),
      lead.phone,
      lead.email,
      lead.instagram,
      lead.facebook,
      lead.serviceInterest,
      lead.nextContactNote,
      lead.city,
      lead.notes,
    ].filter(Boolean).join(' ').toLowerCase().includes(q))
  }, [leads, search])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const lead of leads) counts[lead.status] = (counts[lead.status] || 0) + 1
    return counts
  }, [leads])

  const reminders = useMemo(() => {
    return leads
      .filter(lead => lead.nextContactAt)
      .sort((a, b) => new Date(a.nextContactAt).getTime() - new Date(b.nextContactAt).getTime())
  }, [leads])

  const remindersByDate = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const lead of reminders) {
      const key = dateKey(lead.nextContactAt)
      if (!key) continue
      map[key] = [...(map[key] || []), lead]
    }
    return map
  }, [reminders])

  const selectedReminders = remindersByDate[selectedDate] || []

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const offset = (firstDay.getDay() + 6) % 7
    const totalDays = new Date(year, month + 1, 0).getDate()
    const days: Array<{ key: string; day: number | null; hasReminder: boolean }> = []
    for (let i = 0; i < offset; i++) days.push({ key: `empty-${i}`, day: null, hasReminder: false })
    for (let day = 1; day <= totalDays; day++) {
      const key = dateKey(new Date(year, month, day))
      days.push({ key, day, hasReminder: Boolean(remindersByDate[key]?.length) })
    }
    return days
  }, [calendarMonth, remindersByDate])

  function changeCalendarMonth(delta: number) {
    setCalendarMonth(current => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Лиды</div>
          <div className="page-subtitle">Всего: {leads.length}. Обработка, прогрев и перевод в клиентов</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/dashboard" className="btn btn-secondary">Dashboard</Link>
          <Link href="/leads/new" className="btn btn-primary">+ Добавить лид</Link>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
          {LEAD_STATUSES.map(item => {
            const colors = STATUS_STYLE[item] || { bg: '#f3f4f6', color: '#374151' }
            return (
              <button
                key={item}
                onClick={() => setStatus(current => current === item ? '' : item)}
                style={{ textAlign: 'left', border: `1px solid ${status === item ? colors.color : 'var(--border)'}`, background: status === item ? colors.bg : 'var(--surface)', borderRadius: 8, padding: 10, cursor: 'pointer' }}
              >
                <div style={{ color: colors.color, fontWeight: 800, fontSize: 18 }}>{statusCounts[item] || 0}</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{item}</div>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 190px 190px', gap: 10, marginBottom: 16 }}>
          <input className="input" placeholder="🔍 Поиск по имени, телефону, Instagram, услуге..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Все статусы</option>
            {LEAD_STATUSES.map(item => <option key={item}>{item}</option>)}
          </select>
          <select className="select" value={source} onChange={e => setSource(e.target.value)}>
            <option value="">Все источники</option>
            {LEAD_SOURCES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)', gap: 16, alignItems: 'start' }}>
          <div className="table-container">
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Лид</th>
                    <th>Статус</th>
                    <th>Источник</th>
                    <th>Интерес</th>
                    <th>Следующий контакт</th>
                    <th>Ответственный</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Загрузка...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>◎</div>
                      <div>{search || status || source ? 'Лиды не найдены' : 'Пока нет лидов'}</div>
                      {!search && !status && !source && <Link href="/leads/new" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: 12 }}>Добавить первый лид</Link>}
                    </td></tr>
                  ) : filtered.map(lead => {
                    const colors = STATUS_STYLE[lead.status] || { bg: '#f3f4f6', color: '#374151' }
                    return (
                      <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials(lead)}</div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{leadDisplayName(lead)}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{lead.phone || lead.email || lead.instagram || lead.facebook || 'Контакт не указан'}</div>
                            </div>
                          </div>
                        </td>
                        <td><span style={{ background: colors.bg, color: colors.color, borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }}>{lead.status}</span></td>
                        <td style={{ fontSize: 13 }}>{sourceLabel(lead.source)}</td>
                        <td style={{ fontSize: 13 }}>{lead.serviceInterest || '—'}</td>
                        <td style={{ fontSize: 13 }}>
                          {lead.nextContactAt ? (
                            <div>
                              <div>{formatLeadDateTime(lead.nextContactAt)}</div>
                              {lead.nextContactNote && <div style={{ color: 'var(--muted)', marginTop: 2 }}>{lead.nextContactNote}</div>}
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ fontSize: 13 }}>{lead.assignedTo?.name || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ position: 'sticky', top: 16 }}>
            <div className="section-title"><span>◷</span>Календарь лидов</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => changeCalendarMonth(-1)}>‹</button>
              <strong>{calendarMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</strong>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => changeCalendarMonth(1)}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8, color: 'var(--muted)', fontSize: 11, textAlign: 'center', fontWeight: 700 }}>
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <div key={day}>{day}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {calendarDays.map(item => item.day ? (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedDate(item.key)}
                  style={{
                    minHeight: 34,
                    borderRadius: 6,
                    border: item.key === selectedDate ? '1px solid #2563eb' : '1px solid var(--border)',
                    background: item.key === selectedDate ? '#eff6ff' : 'var(--surface)',
                    color: item.key === selectedDate ? '#1d4ed8' : 'inherit',
                    fontWeight: item.hasReminder ? 800 : 500,
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  {item.day}
                  {item.hasReminder && <span style={{ position: 'absolute', left: '50%', bottom: 4, width: 5, height: 5, marginLeft: -2.5, borderRadius: 999, background: '#2563eb' }} />}
                </button>
              ) : <div key={item.key} />)}
            </div>
            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
              {selectedReminders.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>На этот день контактов по лидам нет</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {selectedReminders.map(lead => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      style={{ textAlign: 'left', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: 10, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <strong>{leadDisplayName(lead)}</strong>
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(lead.nextContactAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{lead.nextContactNote || 'Без пометки'}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
