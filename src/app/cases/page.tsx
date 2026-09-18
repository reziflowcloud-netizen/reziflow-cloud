'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'
import { caseStatusLabel, isActiveCaseStatus, isArchiveCaseStatus } from '@/lib/caseI18n'
import TutorialVideoButton from '@/components/TutorialVideoButton'
import BulkActionsBar, { type BulkActionPayload } from '@/components/BulkActionsBar'
import CasesMobile from './CasesMobile'
import { useCaseMobileAccess } from './CaseMobileAccessContext'
import StaffScopeControl from '@/components/StaffScopeControl'
import type { StaffScopeValue } from '@/lib/staffScope'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Новый':               { bg: '#eff6ff', color: '#1d4ed8' },
  'В работе':            { bg: '#fef3c7', color: '#92400e' },
  'Ожидание документов': { bg: '#ede9fe', color: '#5b21b6' },
  'Решение получено':    { bg: '#dcfce7', color: '#14532d' },
  'Архив':               { bg: '#f3f4f6', color: '#374151' },
  'Отказ':               { bg: '#fef2f2', color: '#991b1b' },
}

const ALL_FILTER = 'all'
const CASE_PAGE_SIZE = 50
const LOCALES = { ru: 'ru-RU', uk: 'uk-UA', pl: 'pl-PL' } as const

type SortKey = 'client' | 'status' | 'service' | 'responsible' | 'value' | 'debt' | 'date'
type SortDir = 'asc' | 'desc'

export default function CasesPage() {
  const router = useRouter()
  const { restrictedAccess } = useCaseMobileAccess()
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
  const [employees, setEmployees] = useState<any[]>([])
  const [staffScope, setStaffScope] = useState<StaffScopeValue>(restrictedAccess ? 'mine' : 'all')
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([])
  const [allFilteredSelected, setAllFilteredSelected] = useState(false)
  const [excludedCaseIds, setExcludedCaseIds] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  // Читаем фильтр из URL параметра
  // filter=active → активные дела
  // filter=no_pay → договора без оплаты
  // filter=Новый  → конкретный статус
  const urlFilter = searchParams.get('filter') || ALL_FILTER
  const [activeFilter, setActiveFilter] = useState(urlFilter)

  useEffect(() => {
    setActiveFilter(urlFilter)
  }, [urlFilter])

  function loadCases() {
    setLoading(true)
    return Promise.all([
      fetch(`/api/cases?view=list&staffScope=${encodeURIComponent(staffScope)}`).then(r => r.json()),
      fetch('/api/statuses').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
    ]).then(([c, s, e]) => {
      setCases(Array.isArray(c) ? c : [])
      setStatuses(Array.isArray(s) ? s : [])
      setEmployees(Array.isArray(e) ? e.filter((employee: any) => employee.active) : [])
      setLoading(false)
    })
  }

  useEffect(() => {
    loadCases()
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => setCurrentUser(data))
  }, [staffScope])

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

  function getConfiguredCaseStatusStyle(status: any) {
    const color = status?.color || '#64748b'
    return { bg: `${color}18`, color }
  }

  function responsibleName(record: any) {
    return record?.employee?.name || ''
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
    .filter(c => search === '' || [
      c.client?.firstName,
      c.client?.lastName,
      c.client?.phone,
      responsibleName(c),
    ].some(value => String(value || '').toLowerCase().includes(search.toLowerCase())))
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / CASE_PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pagedCases = useMemo(
    () => filtered.slice((safeCurrentPage - 1) * CASE_PAGE_SIZE, safeCurrentPage * CASE_PAGE_SIZE),
    [filtered, safeCurrentPage],
  )
  const currentPageCaseIds = useMemo(() => pagedCases.map(item => item.id), [pagedCases])
  const filteredCaseIdSet = useMemo(() => new Set(filtered.map(item => item.id)), [filtered])
  const isCaseSelected = (id: string) => allFilteredSelected
    ? filteredCaseIdSet.has(id) && !excludedCaseIds.includes(id)
    : selectedCaseIds.includes(id)
  const selectedCaseCount = allFilteredSelected
    ? Math.max(0, filtered.length - excludedCaseIds.filter(id => filteredCaseIdSet.has(id)).length)
    : selectedCaseIds.length
  const allCurrentPageSelected = currentPageCaseIds.length > 0 && currentPageCaseIds.every(isCaseSelected)

  const bulkFilterKey = useMemo(
    () => JSON.stringify({ activeFilter, search: search.trim() }),
    [activeFilter, search],
  )

  useEffect(() => {
    setCurrentPage(1)
    setSelectedCaseIds([])
    setAllFilteredSelected(false)
    setExcludedCaseIds([])
  }, [bulkFilterKey])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  function toggleCaseSelection(id: string) {
    if (allFilteredSelected) {
      setExcludedCaseIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
      return
    }
    setSelectedCaseIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  function toggleCurrentCasePage() {
    if (allFilteredSelected) {
      setExcludedCaseIds(current => allCurrentPageSelected
        ? Array.from(new Set([...current, ...currentPageCaseIds]))
        : current.filter(id => !currentPageCaseIds.includes(id)))
      return
    }
    setSelectedCaseIds(current => allCurrentPageSelected
      ? current.filter(id => !currentPageCaseIds.includes(id))
      : Array.from(new Set([...current, ...currentPageCaseIds])))
  }

  function clearCaseSelection() {
    setSelectedCaseIds([])
    setAllFilteredSelected(false)
    setExcludedCaseIds([])
  }

  function selectAllFilteredCases() {
    setSelectedCaseIds([])
    setExcludedCaseIds([])
    setAllFilteredSelected(true)
  }

  function caseSelectionDescription() {
    const parts: string[] = []
    if (activeFilter === 'active') parts.push(t('active_cases_title'))
    else if (activeFilter === 'no_pay') parts.push(t('contracts_without_payment_title'))
    else if (activeFilter !== ALL_FILTER && activeFilter !== 'Все') parts.push(caseStatusLabel(lang, activeFilter))
    if (search.trim()) parts.push(`“${search.trim()}”`)
    const prefix = lang === 'uk' ? 'Фільтр' : lang === 'pl' ? 'Filtr' : 'Фильтр'
    return parts.length ? `${prefix}: ${parts.join(' · ')}` : ''
  }

  async function applyCaseBulkAction(payload: BulkActionPayload) {
    if (!selectedCaseCount) return { updated: 0 }
    const response = await fetch('/api/cases/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        staffScope,
        selection: allFilteredSelected
          ? { mode: 'filtered', filters: { activeFilter, search: search.trim() }, excludedIds: excludedCaseIds }
          : { mode: 'ids', ids: selectedCaseIds },
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Bulk update failed')
    await loadCases()
    clearCaseSelection()
    return { updated: Number(data.updated) || selectedCaseCount }
  }

  function pageCopy(key: 'previous' | 'next' | 'page') {
    if (lang === 'uk') return key === 'previous' ? 'Попередня' : key === 'next' ? 'Наступна' : `Сторінка ${safeCurrentPage} з ${totalPages}`
    if (lang === 'pl') return key === 'previous' ? 'Poprzednia' : key === 'next' ? 'Następna' : `Strona ${safeCurrentPage} z ${totalPages}`
    return key === 'previous' ? 'Предыдущая' : key === 'next' ? 'Следующая' : `Страница ${safeCurrentPage} из ${totalPages}`
  }

  const activeCasesCount = cases.filter(c => isActiveCaseStatus(c.status)).length
  const noPayCount = cases.filter(c => c.contractSigned && c.totalPaid === 0 && c.totalValue > 0).length
  const canDeleteCases = currentUser?.role === 'admin' || currentUser?.role === 'owner'
  const statusCounts = Object.fromEntries(statuses.map(status => [
    status.name,
    cases.filter(item => caseMatchesStatus(item.status, status.name)).length,
  ]))

  // Заголовок активного фильтра
  const filterTitle = activeFilter === 'active' ? `${t('active_cases_title')} (${activeCasesCount})`
    : activeFilter === 'no_pay' ? `${t('contracts_without_payment_title')} (${noPayCount})`
    : activeFilter === ALL_FILTER || activeFilter === 'Все' ? `${t('all_cases_title')} (${cases.length})`
    : `${activeFilter} (${cases.filter(c => caseMatchesStatus(c.status, activeFilter)).length})`

  return (
    <div className="fade-in cases-page" onClick={() => setStatusPopup(null)}>
      <style suppressHydrationWarning>{`
        @media (max-width: 768px) {
          .cases-page .case-desktop-presentation {
            display: none !important;
          }
        }
      `}</style>
      <CasesMobile
        lang={lang}
        locale={locale}
        loading={loading}
        cases={cases}
        pagedCases={pagedCases}
        filteredCount={filtered.length}
        statuses={statuses}
        statusCounts={statusCounts}
        activeCasesCount={activeCasesCount}
        noPayCount={noPayCount}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        search={search}
        setSearch={setSearch}
        sortKey={sortKey}
        setSortKey={setSortKey}
        sortDir={sortDir}
        setSortDir={setSortDir}
        statusColors={getConfiguredCaseStatusStyle}
        responsibleName={responsibleName}
        restrictedAccess={restrictedAccess}
        staffScope={staffScope}
        setStaffScope={setStaffScope}
        selectedCount={selectedCaseCount}
        currentPageCount={currentPageCaseIds.length}
        allCurrentPageSelected={allCurrentPageSelected}
        allFilteredSelected={allFilteredSelected}
        isSelected={isCaseSelected}
        toggleSelection={toggleCaseSelection}
        toggleCurrentPage={toggleCurrentCasePage}
        selectAllFiltered={selectAllFilteredCases}
        clearSelection={clearCaseSelection}
        selectionDescription={caseSelectionDescription()}
        employees={employees}
        onBulkApply={applyCaseBulkAction}
        onOpenCase={id => router.push(`/cases/${id}`)}
        onQuickChangeStatus={quickChangeStatus}
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        onPreviousPage={() => setCurrentPage(page => Math.max(1, page - 1))}
        onNextPage={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
      />
      <div className="page-header case-desktop-presentation">
        <div>
          <div className="page-title">{t('cases_title')}</div>
          <div className="page-subtitle">{filterTitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TutorialVideoButton videoKey="cases" />
          <Link href="/cases/new" className="btn btn-primary">{t('new_case')}</Link>
        </div>
      </div>
      <div className="page-body case-desktop-presentation">
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

        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input className="input" placeholder={`🔍 ${t('search_cases_phone')}`}
            value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 380 }} />
          <StaffScopeControl value={staffScope} onChange={setStaffScope} employees={employees} restricted={restrictedAccess} lang={lang} />
        </div>

        <BulkActionsBar
          entity="cases"
          lang={lang}
          selectedCount={selectedCaseCount}
          currentPageCount={currentPageCaseIds.length}
          filteredCount={filtered.length}
          allCurrentPageSelected={allCurrentPageSelected}
          allFilteredSelected={allFilteredSelected}
          selectionDescription={caseSelectionDescription()}
          employees={employees}
          statuses={statuses}
          statusLabel={name => caseStatusLabel(lang, name)}
          onSelectAllFiltered={selectAllFilteredCases}
          onClear={clearCaseSelection}
          onApply={applyCaseBulkAction}
        />

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
                  <th style={{ width: 38, minWidth: 38, paddingInline: 8, textAlign: 'center' }}>
                    <input
                      className="case-bulk-checkbox"
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={toggleCurrentCasePage}
                      aria-label="Select current page"
                      style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                    <div>{t('no_cases')}</div>
                  </td></tr>
                ) : pagedCases.map(c => {
                  const debt = Math.max(0, c.totalValue - c.totalPaid)
                  const sc = getCaseStatusStyle(c.status)
                  return (
                    <tr key={c.id} onClick={() => router.push(`/cases/${c.id}`)} style={{ cursor: 'pointer', background: isCaseSelected(c.id) ? 'color-mix(in srgb, var(--brand) 8%, var(--surface))' : undefined }}>
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
                      <td
                        onClick={e => e.stopPropagation()}
                        style={{ width: 38, minWidth: 38, paddingInline: 8, textAlign: 'center' }}
                      >
                        <input
                          className="case-bulk-checkbox"
                          type="checkbox"
                          checked={isCaseSelected(c.id)}
                          onChange={() => toggleCaseSelection(c.id)}
                          aria-label={`${c.client?.firstName || ''} ${c.client?.lastName || ''}`.trim() || c.id}
                          style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, paddingTop: 12 }}>
            <button type="button" className="btn btn-secondary" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(page => Math.max(1, page - 1))}>← {pageCopy('previous')}</button>
            <strong style={{ fontSize: 13, color: 'var(--muted)' }}>{pageCopy('page')}</strong>
            <button type="button" className="btn btn-secondary" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}>{pageCopy('next')} →</button>
          </div>
        )}
        <style jsx global>{`
          .case-bulk-checkbox { opacity: .46; transition: opacity .16s ease, transform .16s ease; }
          tr:hover .case-bulk-checkbox,
          .case-bulk-checkbox:focus-visible,
          .case-bulk-checkbox:checked { opacity: 1; }
          .case-bulk-checkbox:hover { transform: scale(1.08); }
        `}</style>
      </div>
    </div>
  )
}
