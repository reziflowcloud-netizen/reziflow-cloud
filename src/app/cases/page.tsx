'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'
import { caseStatusLabel, isActiveCaseStatus, isArchiveCaseStatus } from '@/lib/caseI18n'
import TutorialVideoButton from '@/components/TutorialVideoButton'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Новый':               { bg: '#eff6ff', color: '#1d4ed8' },
  'В работе':            { bg: '#fef3c7', color: '#92400e' },
  'Ожидание документов': { bg: '#ede9fe', color: '#5b21b6' },
  'Решение получено':    { bg: '#dcfce7', color: '#14532d' },
  'Архив':               { bg: '#f3f4f6', color: '#374151' },
  'Отказ':               { bg: '#fef2f2', color: '#991b1b' },
}

const ALL_FILTER = 'all'
const LOCALES = { ru: 'ru-RU', uk: 'uk-UA', pl: 'pl-PL' } as const

type SortKey = 'client' | 'status' | 'service' | 'responsible' | 'value' | 'debt' | 'date'
type SortDir = 'asc' | 'desc'

export default function CasesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, lang } = useLanguage()
  const locale = LOCALES[lang] || 'ru-RU'
  const [cases, setCases] = useState<any[]>([])
  const [statuses, setStatuses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [statusPopup, setStatusPopup] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Читаем фильтр из URL параметра
  // filter=active → активные дела
  // filter=no_pay → договора без оплаты
  // filter=Новый  → конкретный статус
  const urlFilter = searchParams.get('filter') || ALL_FILTER
  const [activeFilter, setActiveFilter] = useState(urlFilter)

  useEffect(() => {
    setActiveFilter(urlFilter)
  }, [urlFilter])

  useEffect(() => {
    Promise.all([
      fetch('/api/cases?view=list').then(r => r.json()),
      fetch('/api/statuses').then(r => r.json()),
    ]).then(([c, s]) => {
      setCases(Array.isArray(c) ? c : [])
      setStatuses(Array.isArray(s) ? s : [])
      setLoading(false)
    })
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => setCurrentUser(data))
  }, [])

  async function quickChangeStatus(caseId: string, newStatus: string, e: React.MouseEvent) {
    e.stopPropagation()
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: newStatus } : c))
    setStatusPopup(null)
    await fetch(`/api/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  async function deleteCase(caseId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(t('delete_case_confirm'))) return
    const res = await fetch(`/api/cases/${caseId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || t('delete_case_failed'))
      return
    }
    setCases(prev => prev.filter(c => c.id !== caseId))
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ k }: { k: SortKey }) {
    return <span style={{ marginLeft: 4, opacity: sortKey === k ? 1 : 0.3, fontSize: 11 }}>
      {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  }

  function getCaseStatusStyle(name: string) {
    const custom = statuses.find((status: any) => status.name === name)
    if (custom?.color) return { bg: `${custom.color}18`, color: custom.color }
    return STATUS_COLORS[name] || { bg: '#f3f4f6', color: '#374151' }
  }

  function responsibleName(record: any) {
    return record?.assignedTo?.name || record?.assignedTo?.email || ''
  }

  function caseMatchesStatus(caseStatus: string, filterStatus: string) {
    if (isArchiveCaseStatus(filterStatus)) return isArchiveCaseStatus(caseStatus)
    return caseStatus === filterStatus
  }

  const filtered = cases
    .filter(c => {
      // Фильтр
      if (activeFilter === ALL_FILTER || activeFilter === 'Все') return true
      if (activeFilter === 'active') return isActiveCaseStatus(c.status)
      if (activeFilter === 'no_pay') return c.contractSigned && c.totalPaid === 0 && c.totalValue > 0
      return caseMatchesStatus(c.status, activeFilter)
    })
    .filter(c => search === '' ||
      `${c.client?.firstName} ${c.client?.lastName} ${c.client?.phone||''} ${responsibleName(c)}`.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let va: any, vb: any
      if (sortKey === 'client') { va = `${a.client?.firstName} ${a.client?.lastName}`; vb = `${b.client?.firstName} ${b.client?.lastName}` }
      else if (sortKey === 'status') { va = a.status; vb = b.status }
      else if (sortKey === 'service') { va = a.service?.name || ''; vb = b.service?.name || '' }
      else if (sortKey === 'responsible') { va = responsibleName(a); vb = responsibleName(b) }
      else if (sortKey === 'value') { va = a.totalValue; vb = b.totalValue }
      else if (sortKey === 'debt') { va = a.totalValue - a.totalPaid; vb = b.totalValue - b.totalPaid }
      else { va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime() }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const activeCasesCount = cases.filter(c => isActiveCaseStatus(c.status)).length
  const noPayCount = cases.filter(c => c.contractSigned && c.totalPaid === 0 && c.totalValue > 0).length
  const canDeleteCases = currentUser?.role === 'admin' || currentUser?.role === 'owner'

  // Заголовок активного фильтра
  const filterTitle = activeFilter === 'active' ? `${t('active_cases_title')} (${activeCasesCount})`
    : activeFilter === 'no_pay' ? `${t('contracts_without_payment_title')} (${noPayCount})`
    : activeFilter === ALL_FILTER || activeFilter === 'Все' ? `${t('all_cases_title')} (${cases.length})`
    : `${activeFilter} (${cases.filter(c => caseMatchesStatus(c.status, activeFilter)).length})`

  return (
    <div className="fade-in" onClick={() => setStatusPopup(null)}>
      <div className="page-header">
        <div>
          <div className="page-title">{t('cases_title')}</div>
          <div className="page-subtitle">{filterTitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TutorialVideoButton videoKey="cases" />
          <Link href="/cases/new" className="btn btn-primary">{t('new_case')}</Link>
        </div>
      </div>
      <div className="page-body">
        {/* Фильтры */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {/* Все */}
          <button
            onClick={() => setActiveFilter(ALL_FILTER)}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
              background: (activeFilter === ALL_FILTER || activeFilter === 'Все') ? 'var(--brand)' : 'var(--bg)',
              color: (activeFilter === ALL_FILTER || activeFilter === 'Все') ? 'white' : 'var(--muted)' }}>
            {t('total')} ({cases.length})
          </button>
          {/* Статусы */}
          {statuses.map(s => {
            const count = cases.filter(c => caseMatchesStatus(c.status, s.name)).length
            const isActive = activeFilter === s.name
            const sc = getCaseStatusStyle(s.name)
            return (
              <button key={s.id} onClick={() => setActiveFilter(s.name)}
                style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
                  background: isActive ? sc.color : sc.bg, color: isActive ? 'white' : sc.color }}>
                {caseStatusLabel(lang, s.name)} ({count})
              </button>
            )
          })}
        </div>

        {/* Быстрые фильтры из пульта */}
        {(activeFilter === 'active' || activeFilter === 'no_pay') && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: activeFilter === 'active' ? '#fef3c7' : '#fef2f2',
              color: activeFilter === 'active' ? '#92400e' : '#dc2626',
              border: `1px solid ${activeFilter === 'active' ? '#fbbf24' : '#fca5a5'}`,
              display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeFilter === 'active' ? '⚡' : '📄'}
              {activeFilter === 'active' ? `${t('active_cases_title')}: ${activeCasesCount}` : `${t('contracts_without_payment_title')}: ${noPayCount}`}
            </div>
            <button onClick={() => setActiveFilter(ALL_FILTER)} className="btn btn-ghost" style={{ fontSize: 12 }}>
              ✕ {t('reset_filter')}
            </button>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <input className="input" placeholder={`🔍 ${t('search_cases_phone')}`}
            value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 380 }} />
        </div>

        <div className="table-container">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th onClick={() => toggleSort('client')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('client')} <SortIcon k="client" /></th>
                  <th onClick={() => toggleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('status')} <SortIcon k="status" /></th>
                  <th onClick={() => toggleSort('service')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('service')} <SortIcon k="service" /></th>
                  <th onClick={() => toggleSort('responsible')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('responsible')} <SortIcon k="responsible" /></th>
                  <th onClick={() => toggleSort('value')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('cost')} <SortIcon k="value" /></th>
                  <th onClick={() => toggleSort('debt')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('debt_col')} <SortIcon k="debt" /></th>
                  <th onClick={() => toggleSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('created')} <SortIcon k="date" /></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                    <div>{t('no_cases')}</div>
                  </td></tr>
                ) : filtered.map(c => {
                  const debt = Math.max(0, c.totalValue - c.totalPaid)
                  const sc = getCaseStatusStyle(c.status)
                  return (
                    <tr key={c.id} onClick={() => router.push(`/cases/${c.id}`)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                            {c.client?.firstName?.[0]}{c.client?.lastName?.[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{c.client?.firstName} {c.client?.lastName}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.client?.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                        <span
                          className="badge"
                          onClick={e => { e.stopPropagation(); setStatusPopup(statusPopup === c.id ? null : c.id) }}
                          style={{ background: sc.bg, color: sc.color, cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title={t('change_status_hint')}
                        >
                          {caseStatusLabel(lang, c.status)} <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
                        </span>
                        {statusPopup === c.id && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, zIndex: 50,
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                            minWidth: 200, padding: '6px 0',
                          }}>
                            {statuses.map(s => {
                              const sColor = getCaseStatusStyle(s.name)
                              return (
                                <div key={s.id}
                                  onClick={e => quickChangeStatus(c.id, s.name, e)}
                                  style={{
                                    padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                                    background: c.status === s.name ? '#f9fafb' : 'transparent',
                                    fontWeight: c.status === s.name ? 600 : 400,
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                                  onMouseLeave={e => (e.currentTarget.style.background = c.status === s.name ? '#f9fafb' : 'transparent')}
                                >
                                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                                  <span style={{ fontSize: 13 }}>{caseStatusLabel(lang, s.name)}</span>
                                  {c.status === s.name && <span style={{ marginLeft: 'auto', color: s.color }}>✓</span>}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>
                      <td>
                        {c.service ? (
                          <span className="badge" style={{ background: (c.service.color||'#3b82f6')+'18', color: c.service.color||'#3b82f6' }}>
                            {c.service.name}
                          </span>
                        ) : <span style={{ color: 'var(--muted)', fontSize: 13 }}>—</span>}
                      </td>
                      <td style={{ fontSize: 13, color: responsibleName(c) ? 'var(--text)' : 'var(--muted)' }}>
                        {responsibleName(c) || '—'}
                      </td>
                      <td style={{ fontWeight: 500 }}>{c.totalValue.toFixed(2)} zł</td>
                      <td style={{ color: debt > 0 ? '#dc2626' : '#16a34a', fontWeight: debt > 0 ? 600 : 400 }}>
                        {debt > 0 ? `-${debt.toFixed(2)} zł` : '✓'}
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                        {new Date(c.createdAt).toLocaleDateString(locale)}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {canDeleteCases && isArchiveCaseStatus(c.status) && (
                          <button
                            onClick={e => deleteCase(c.id, e)}
                            title={t('delete_case')}
                            style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#dc2626', fontSize: 13 }}
                          >🗑</button>
                        )}
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
