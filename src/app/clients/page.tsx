'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Новый':               { bg: '#eff6ff', color: '#1d4ed8' },
  'В работе':            { bg: '#fef3c7', color: '#92400e' },
  'Ожидание документов': { bg: '#ede9fe', color: '#5b21b6' },
  'Решение получено':    { bg: '#dcfce7', color: '#14532d' },
  'Архив':               { bg: '#f3f4f6', color: '#374151' },
  'Отказ':               { bg: '#fef2f2', color: '#991b1b' },
}

const ALL_COLUMNS = [
  { key: 'name',        labelKey: 'name_and_lastname',   always: true },
  { key: 'phone',       labelKey: 'phone' },
  { key: 'email',       labelKey: 'email' },
  { key: 'pesel',       labelKey: 'pesel' },
  { key: 'citizenship', labelKey: 'citizenship' },
  { key: 'birthDate',   labelKey: 'birth_date' },
  { key: 'cases',       labelKey: 'cases_title' },
]

type SortKey = 'name' | 'cases' | 'birthDate' | 'date'
type SortDir = 'asc' | 'desc'

export default function ClientsPage() {
  const { lang, t } = useLanguage()
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [visibleCols, setVisibleCols] = useState<string[]>(['name','phone','pesel','citizenship','birthDate','cases'])
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => {
      setClients(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  // Закрытие меню колонок при клике вне
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function toggleCol(key: string) {
    setVisibleCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span style={{ marginLeft: 4, opacity: sortKey === k ? 1 : 0.3, fontSize: 11 }}>
      {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )

  const filtered = clients
    .filter(c => `${c.firstName} ${c.lastName} ${c.phone||''} ${c.email||''} ${c.pesel||''} ${c.citizenship||''} ${c.branch||''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let va: any, vb: any
      if (sortKey === 'name') { va = `${a.firstName} ${a.lastName}`; vb = `${b.firstName} ${b.lastName}` }
      else if (sortKey === 'cases') { va = a.cases?.length || 0; vb = b.cases?.length || 0 }
      else if (sortKey === 'birthDate') { va = a.birthDate || ''; vb = b.birthDate || '' }
      else { va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime() }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const activeColCount = visibleCols.length
  const totalColCount = ALL_COLUMNS.length

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{t('clients_title')}</div>
          <div className="page-subtitle">{t('total')}: {clients.length}</div>
        </div>
        <Link href="/clients/new" className="btn btn-primary">{t('add_client')}</Link>
      </div>
      <div className="page-body">
        {/* Поиск и колонки */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <input
            className="input"
            placeholder={`🔍 ${t('search_clients_full')}`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 460 }}
          />
          {/* Переключатель колонок */}
          <div ref={colMenuRef} style={{ position: 'relative', marginLeft: 'auto' }}>
            <button
              onClick={() => setShowColMenu(v => !v)}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              {t('columns')} <span style={{ background: 'var(--brand)', color: 'white', borderRadius: 10, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>{activeColCount}/{totalColCount}</span>
            </button>
            {showColMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                boxShadow: 'var(--shadow-md)', zIndex: 50, minWidth: 200, padding: '8px 0'
              }}>
                <div style={{ padding: '6px 14px 8px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {t('visible_columns')}
                </div>
                {ALL_COLUMNS.map(col => (
                  <div
                    key={col.key}
                    onClick={() => !col.always && toggleCol(col.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 14px', cursor: col.always ? 'default' : 'pointer',
                      opacity: col.always ? 0.5 : 1,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!col.always) e.currentTarget.style.background = 'var(--bg)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, border: '2px solid',
                      borderColor: visibleCols.includes(col.key) ? 'var(--brand)' : 'var(--border)',
                      background: visibleCols.includes(col.key) ? 'var(--brand)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {visibleCols.includes(col.key) && <span style={{ color: 'white', fontSize: 12, lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 13 }}>{t(col.labelKey)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Таблица */}
        <div className="table-container">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  {visibleCols.includes('name') && (
                    <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer', userSelect: 'none', minWidth: 180 }}>
                      {t('name_and_lastname')} <SortIcon k="name" />
                    </th>
                  )}
                  {visibleCols.includes('phone') && <th style={{ minWidth: 130 }}>{t('phone')}</th>}
                  {visibleCols.includes('email') && <th style={{ minWidth: 180 }}>E-mail</th>}
                  {visibleCols.includes('pesel') && <th style={{ minWidth: 120 }}>PESEL</th>}
                  {visibleCols.includes('citizenship') && <th style={{ minWidth: 120 }}>{t('citizenship')}</th>}
                  {visibleCols.includes('birthDate') && (
                    <th onClick={() => toggleSort('birthDate')} style={{ cursor: 'pointer', userSelect: 'none', minWidth: 130 }}>
                      {t('birth_date')} <SortIcon k="birthDate" />
                    </th>
                  )}
                  {visibleCols.includes('cases') && (
                    <th onClick={() => toggleSort('cases')} style={{ cursor: 'pointer', userSelect: 'none', minWidth: 60 }}>
                      {t('cases_title')} <SortIcon k="cases" />
                    </th>
                  )}
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>{t('loading')}</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                    <div>{search ? t('not_found') : t('no_clients')}</div>
                    {!search && <Link href="/clients/new" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: 12 }}>{t('add_client')}</Link>}
                  </td></tr>
                ) : filtered.map(client => {
                  const cases: any[] = client.cases || []
                  const activeCases = cases.filter((c: any) => ['В работе','Ожидание документов','Новый'].includes(c.status))
                  return (
                    <tr key={client.id} onClick={() => router.push(`/clients/${client.id}`)} style={{ cursor: 'pointer' }}>
                      {visibleCols.includes('name') && (
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
                              {client.firstName[0]}{client.lastName[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{client.firstName} {client.lastName}</div>
                              {client.phone && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{client.phone}</div>}
                            </div>
                          </div>
                        </td>
                      )}
                      {visibleCols.includes('phone') && <td style={{ fontSize: 13 }}>{client.phone || '—'}</td>}
                      {visibleCols.includes('email') && <td style={{ fontSize: 12, color: 'var(--muted)' }}>{client.email || '—'}</td>}
                      {visibleCols.includes('pesel') && <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{client.pesel || '—'}</td>}
                      {visibleCols.includes('citizenship') && <td style={{ fontSize: 13 }}>{client.citizenship || '—'}</td>}
                      {visibleCols.includes('birthDate') && (
                        <td style={{ fontSize: 13 }}>
                          {client.birthDate ? new Date(client.birthDate).toLocaleDateString(lang === 'pl' ? 'pl-PL' : lang === 'uk' ? 'uk-UA' : 'ru-RU') : '—'}
                        </td>
                      )}
                      {visibleCols.includes('cases') && (
                        <td>
                          {cases.length === 0 ? (
                            <span style={{ color: 'var(--muted)', fontSize: 13 }}>—</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {[...activeCases, ...cases.filter((c: any) => !['В работе','Ожидание документов','Новый'].includes(c.status))].map((c: any) => {
                                const sc = STATUS_COLORS[c.status] || { bg: '#f3f4f6', color: '#374151' }
                                const isArchived = ['Архив','Отказ'].includes(c.status)
                                return (
                                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: isArchived ? 0.5 : 1 }}>
                                    {c.service ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.service.color || '#3b82f6', flexShrink: 0 }} />
                                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{c.service.name}</span>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{c.caseNumber || '—'}</span>
                                      </div>
                                    )}
                                    <span className="badge" style={{ background: sc.bg, color: sc.color, fontSize: 10, padding: '1px 6px', flexShrink: 0 }}>{c.status}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </td>
                      )}
                      <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <Link href={`/clients/${client.id}`} style={{ color: 'var(--muted)', fontSize: 18, textDecoration: 'none' }}>···</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
