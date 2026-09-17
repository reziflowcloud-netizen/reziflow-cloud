'use client'

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import Link from 'next/link'
import BulkActionsBar, { type BulkActionPayload } from '@/components/BulkActionsBar'
import MobileEntityIcon from '@/components/mobile/MobileEntityIcon'
import TutorialVideoButton from '@/components/TutorialVideoButton'
import { caseStatusLabel } from '@/lib/caseI18n'
import type { Lang } from '@/lib/translations'
import styles from './CasesMobile.module.css'

export type CaseSortKey = 'client' | 'status' | 'service' | 'responsible' | 'value' | 'debt' | 'date'
export type CaseSortDir = 'asc' | 'desc'

const ALL_FILTER = 'all'

const COPY = {
  ru: {
    cases: 'Дела', total: 'Всего', add: 'Новое дело', select: 'Выбрать', cancel: 'Отмена', all: 'Все',
    filters: 'Фильтры', results: 'результатов', loading: 'Загрузка дел…', empty: 'Дел не найдено',
    search: 'Поиск по клиенту или телефону...', selected: 'Выбрано', selectPage: 'Выбрать текущую страницу',
    responsible: 'Ответственный', value: 'Стоимость', debt: 'Долг', paid: 'Оплачено', created: 'Создано',
    notAssigned: 'Не назначен', noService: 'Без услуги', show: 'Показывать', active: 'Активные дела',
    noPay: 'Договоры без оплаты', sort: 'Сортировка', direction: 'Направление', ascending: 'По возрастанию',
    descending: 'По убыванию', reset: 'Сбросить', apply: 'Применить', changeStatus: 'Изменить статус',
    dashboard: 'Пульт', calendar: 'Календарь', clientSort: 'Клиент', statusSort: 'Статус',
    serviceSort: 'Услуга', responsibleSort: 'Ответственный', valueSort: 'Стоимость', debtSort: 'Долг', dateSort: 'Дата создания',
  },
  uk: {
    cases: 'Справи', total: 'Усього', add: 'Нова справа', select: 'Вибрати', cancel: 'Скасувати', all: 'Усі',
    filters: 'Фільтри', results: 'результатів', loading: 'Завантаження справ…', empty: 'Справ не знайдено',
    search: 'Пошук за клієнтом або телефоном...', selected: 'Вибрано', selectPage: 'Вибрати поточну сторінку',
    responsible: 'Відповідальний', value: 'Вартість', debt: 'Борг', paid: 'Оплачено', created: 'Створено',
    notAssigned: 'Не призначено', noService: 'Без послуги', show: 'Показувати', active: 'Активні справи',
    noPay: 'Договори без оплати', sort: 'Сортування', direction: 'Напрямок', ascending: 'За зростанням',
    descending: 'За спаданням', reset: 'Скинути', apply: 'Застосувати', changeStatus: 'Змінити статус',
    dashboard: 'Пульт', calendar: 'Календар', clientSort: 'Клієнт', statusSort: 'Статус',
    serviceSort: 'Послуга', responsibleSort: 'Відповідальний', valueSort: 'Вартість', debtSort: 'Борг', dateSort: 'Дата створення',
  },
  pl: {
    cases: 'Sprawy', total: 'Łącznie', add: 'Nowa sprawa', select: 'Wybierz', cancel: 'Anuluj', all: 'Wszystkie',
    filters: 'Filtry', results: 'wyników', loading: 'Ładowanie spraw…', empty: 'Nie znaleziono spraw',
    search: 'Szukaj po kliencie lub telefonie...', selected: 'Wybrano', selectPage: 'Wybierz bieżącą stronę',
    responsible: 'Odpowiedzialny', value: 'Wartość', debt: 'Dług', paid: 'Opłacono', created: 'Utworzono',
    notAssigned: 'Nie przypisano', noService: 'Bez usługi', show: 'Pokaż', active: 'Aktywne sprawy',
    noPay: 'Umowy bez płatności', sort: 'Sortowanie', direction: 'Kierunek', ascending: 'Rosnąco',
    descending: 'Malejąco', reset: 'Wyczyść', apply: 'Zastosuj', changeStatus: 'Zmień status',
    dashboard: 'Pulpit', calendar: 'Kalendarz', clientSort: 'Klient', statusSort: 'Status',
    serviceSort: 'Usługa', responsibleSort: 'Odpowiedzialny', valueSort: 'Wartość', debtSort: 'Dług', dateSort: 'Data utworzenia',
  },
} as const

type StatusColors = { bg: string; color: string }

type CasesMobileProps = {
  lang: Lang
  locale: string
  loading: boolean
  cases: any[]
  pagedCases: any[]
  filteredCount: number
  statuses: any[]
  statusCounts: Record<string, number>
  activeCasesCount: number
  noPayCount: number
  activeFilter: string
  setActiveFilter: (value: string) => void
  search: string
  setSearch: (value: string) => void
  sortKey: CaseSortKey
  setSortKey: (value: CaseSortKey) => void
  sortDir: CaseSortDir
  setSortDir: (value: CaseSortDir) => void
  statusColors: (status: any) => StatusColors
  responsibleName: (record: any) => string
  restrictedAccess: boolean
  selectedCount: number
  currentPageCount: number
  allCurrentPageSelected: boolean
  allFilteredSelected: boolean
  isSelected: (id: string) => boolean
  toggleSelection: (id: string) => void
  toggleCurrentPage: () => void
  selectAllFiltered: () => void
  clearSelection: () => void
  selectionDescription: string
  employees: any[]
  onBulkApply: (payload: BulkActionPayload) => Promise<{ updated: number }>
  onOpenCase: (id: string) => void
  onQuickChangeStatus: (caseId: string, status: string, event: MouseEvent) => Promise<void>
  currentPage: number
  totalPages: number
  onPreviousPage: () => void
  onNextPage: () => void
}

function clientName(record: any) {
  return [record?.client?.firstName, record?.client?.lastName].filter(Boolean).join(' ').trim() || '—'
}

function serviceList(record: any) {
  const values = Array.isArray(record?.services)
    ? record.services
    : record?.service
      ? [record.service]
      : []
  return values.filter((service: any) => service?.name)
}

export default function CasesMobile(props: CasesMobileProps) {
  const copy = COPY[props.lang] || COPY.ru
  const [selectionMode, setSelectionMode] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [statusCaseId, setStatusCaseId] = useState<string | null>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (event: globalThis.MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) setOverflowOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    if (!filtersOpen && !statusCaseId) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [filtersOpen, statusCaseId])

  const activeFilterCount = (props.activeFilter !== ALL_FILTER && props.activeFilter !== 'Все' ? 1 : 0)
    + (props.sortKey !== 'date' || props.sortDir !== 'desc' ? 1 : 0)

  function cancelSelection() {
    props.clearSelection()
    setSelectionMode(false)
  }

  function resetFilters() {
    props.setActiveFilter(ALL_FILTER)
    props.setSortKey('date')
    props.setSortDir('desc')
  }

  function activateCard(record: any) {
    if (selectionMode) props.toggleSelection(record.id)
    else props.onOpenCase(record.id)
  }

  async function applyBulk(payload: BulkActionPayload) {
    const result = await props.onBulkApply(payload)
    setSelectionMode(false)
    return result
  }

  function money(value: unknown) {
    const amount = Number(value) || 0
    return `${new Intl.NumberFormat(props.locale, { maximumFractionDigits: 2 }).format(amount)} zł`
  }

  return (
    <section className={`${styles.mobileOnly} ${styles.shell}`} aria-label={copy.cases}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{copy.cases}</h1>
          <div className={styles.subtitle}>{copy.total}: {props.cases.length}</div>
        </div>
        <div className={styles.overflowWrap} ref={overflowRef}>
          <button type="button" className={styles.iconButton} aria-label="Menu" aria-expanded={overflowOpen} onClick={() => setOverflowOpen(value => !value)}>•••</button>
          {overflowOpen && (
            <div className={styles.overflowMenu}>
              <TutorialVideoButton videoKey="cases" className={styles.overflowVideo} />
              <Link href="/dashboard">⌂ {copy.dashboard}</Link>
              <Link href="/calendar">◷ {copy.calendar}</Link>
            </div>
          )}
        </div>
      </div>

      <div className={styles.primaryActions}>
        <Link href="/cases/new" className={styles.primaryAction}>＋ {copy.add}</Link>
        <button type="button" className={styles.secondaryAction} onClick={() => selectionMode ? cancelSelection() : setSelectionMode(true)}>
          {selectionMode ? copy.cancel : copy.select}
        </button>
      </div>

      <div className={styles.rail} aria-label="Case status filters">
        <button type="button" className={`${styles.chip} ${(props.activeFilter === ALL_FILTER || props.activeFilter === 'Все') ? styles.chipActive : ''}`} onClick={() => props.setActiveFilter(ALL_FILTER)}>
          {copy.all} <span className={styles.chipCount}>{props.cases.length}</span>
        </button>
        {props.statuses.map(status => {
          const colors = props.statusColors(status)
          const selected = props.activeFilter === status.name
          const statusStyle = { '--case-status-color': colors.color } as CSSProperties
          return (
            <button
              key={status.id || status.name}
              type="button"
              className={`${styles.chip} ${styles.statusChip} ${selected ? styles.statusChipActive : ''}`}
              style={statusStyle}
              aria-pressed={selected}
              onClick={() => props.setActiveFilter(selected ? ALL_FILTER : status.name)}
            >
              {caseStatusLabel(props.lang, status.name)} <span className={styles.chipCount}>{props.statusCounts[status.name] || 0}</span>
            </button>
          )
        })}
      </div>

      <div className={styles.searchRow}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>⌕</span>
          <input className={styles.searchInput} value={props.search} onChange={event => props.setSearch(event.target.value)} placeholder={copy.search} />
        </div>
        <button type="button" className={`${styles.filterButton} ${styles.filterButtonWide}`} aria-label={copy.filters} onClick={() => setFiltersOpen(true)}>
          <span aria-hidden="true">☷</span><span className={styles.filterLabel}>{copy.filters}</span>
          {activeFilterCount > 0 && <span className={styles.filterCount}>{activeFilterCount}</span>}
        </button>
      </div>

      <div className={styles.resultsHeader}>
        <h2>{copy.cases}</h2>
        <span>{props.filteredCount} {copy.results}</span>
      </div>

      {selectionMode && props.selectedCount === 0 && (
        <div className={styles.selectionHint}>
          <strong>0 {copy.selected.toLowerCase()}</strong>
          <button type="button" onClick={props.toggleCurrentPage}>{copy.selectPage}</button>
        </div>
      )}

      {selectionMode && props.selectedCount > 0 && (
        <div className={styles.bulkWrap}>
          <BulkActionsBar
            entity="cases"
            lang={props.lang}
            selectedCount={props.selectedCount}
            currentPageCount={props.currentPageCount}
            filteredCount={props.filteredCount}
            allCurrentPageSelected={props.allCurrentPageSelected}
            allFilteredSelected={props.allFilteredSelected}
            selectionDescription={props.selectionDescription}
            employees={props.employees}
            statuses={props.statuses}
            statusLabel={name => caseStatusLabel(props.lang, name)}
            allowedActions={props.restrictedAccess ? ['change_status'] : undefined}
            onSelectAllFiltered={props.selectAllFiltered}
            onClear={cancelSelection}
            onApply={applyBulk}
          />
        </div>
      )}

      {selectionMode && props.selectedCount > 0 && !props.allCurrentPageSelected && (
        <div className={styles.selectionHint}>
          <span />
          <button type="button" onClick={props.toggleCurrentPage}>{copy.selectPage}</button>
        </div>
      )}

      {props.loading ? (
        <div className={styles.state}>{copy.loading}</div>
      ) : props.pagedCases.length === 0 ? (
        <div className={styles.state}>
          <div>{copy.empty}</div>
          <Link href="/cases/new" className={styles.primaryAction}>{copy.add}</Link>
        </div>
      ) : (
        <div className={styles.cards}>
          {props.pagedCases.map(record => {
            const name = clientName(record)
            const services = serviceList(record)
            const primaryService = services[0]
            const remainingServices = Math.max(0, services.length - 1)
            const statusConfig = props.statuses.find(status => status.name === record.status)
            const colors = props.statusColors(statusConfig)
            const statusStyle = { '--case-status-color': colors.color, background: colors.bg, color: colors.color } as CSSProperties
            const debt = Math.max(0, (Number(record.totalValue) || 0) - (Number(record.totalPaid) || 0))
            const selected = props.isSelected(record.id)
            const responsible = props.responsibleName(record)
            return (
              <article
                key={record.id}
                className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
                role="button"
                tabIndex={0}
                aria-label={name}
                onClick={() => activateCard(record)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    activateCard(record)
                  }
                }}
              >
                <div className={styles.cardTop}>
                  <div className={styles.avatar}>{name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</div>
                  <div className={styles.person}>
                    <div className={styles.name}>{name}</div>
                    <div className={styles.phone}>{record.client?.phone ? `☎ ${record.client.phone}` : '—'}</div>
                  </div>
                  <button
                    type="button"
                    className={styles.status}
                    style={statusStyle}
                    title={caseStatusLabel(props.lang, record.status)}
                    onClick={event => { event.stopPropagation(); setStatusCaseId(record.id) }}
                  >
                    <span>{caseStatusLabel(props.lang, record.status)}</span><span aria-hidden="true">⌄</span>
                  </button>
                  {selectionMode ? (
                    <input className={styles.cardCheckbox} type="checkbox" checked={selected} onChange={() => props.toggleSelection(record.id)} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} aria-label={name} />
                  ) : <span className={styles.chevron}>›</span>}
                </div>

                <div className={styles.services}>
                  {primaryService ? (
                    <span className={styles.serviceChip} style={{ '--service-color': primaryService.color || 'var(--brand)' } as CSSProperties} title={primaryService.name}>{primaryService.name}</span>
                  ) : <span className={styles.serviceChip}>{copy.noService}</span>}
                  {remainingServices > 0 && <span className={styles.moreServices}>+{remainingServices}</span>}
                </div>

                <div className={`${styles.financeGrid} ${props.restrictedAccess ? styles.financeGridRestricted : ''}`}>
                  {!props.restrictedAccess && (
                    <div className={styles.metric}>
                      <span className={styles.metricLabel}><MobileEntityIcon type="person" /> {copy.responsible}</span>
                      <span className={styles.metricValue} title={responsible || copy.notAssigned}>{responsible || copy.notAssigned}</span>
                    </div>
                  )}
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>◎ {copy.value}</span>
                    <span className={styles.metricValue}>{money(record.totalValue)}</span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>▣ {copy.debt}</span>
                    <span className={`${styles.metricValue} ${debt > 0 ? styles.debt : styles.paid}`}>{debt > 0 ? money(debt) : copy.paid}</span>
                  </div>
                </div>

                <div className={styles.created}>▦ {copy.created} {new Date(record.createdAt).toLocaleDateString(props.locale)}</div>
              </article>
            )
          })}
        </div>
      )}

      {props.totalPages > 1 && (
        <div className={styles.pagination}>
          <button type="button" disabled={props.currentPage <= 1} onClick={props.onPreviousPage}>‹</button>
          <span>{props.currentPage} / {props.totalPages}</span>
          <button type="button" disabled={props.currentPage >= props.totalPages} onClick={props.onNextPage}>›</button>
        </div>
      )}

      {filtersOpen && (
        <div className={styles.backdrop} role="presentation" onMouseDown={event => event.target === event.currentTarget && setFiltersOpen(false)}>
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="case-mobile-filter-title">
            <div className={styles.handle} />
            <div className={styles.sheetHead}>
              <h2 id="case-mobile-filter-title">{copy.filters}</h2>
              <button type="button" className={styles.closeButton} aria-label={copy.cancel} onClick={() => setFiltersOpen(false)}>×</button>
            </div>
            <div className={styles.filterFields}>
              <label>{copy.show}
                <select className="select" value={props.activeFilter} onChange={event => props.setActiveFilter(event.target.value)}>
                  <option value={ALL_FILTER}>{copy.all}</option>
                  <option value="active">{copy.active} ({props.activeCasesCount})</option>
                  <option value="no_pay">{copy.noPay} ({props.noPayCount})</option>
                  {props.statuses.map(status => <option key={status.id || status.name} value={status.name}>{caseStatusLabel(props.lang, status.name)} ({props.statusCounts[status.name] || 0})</option>)}
                </select>
              </label>
              <label>{copy.sort}
                <select className="select" value={props.sortKey} onChange={event => props.setSortKey(event.target.value as CaseSortKey)}>
                  <option value="client">{copy.clientSort}</option>
                  <option value="status">{copy.statusSort}</option>
                  <option value="service">{copy.serviceSort}</option>
                  {!props.restrictedAccess && <option value="responsible">{copy.responsibleSort}</option>}
                  <option value="value">{copy.valueSort}</option>
                  <option value="debt">{copy.debtSort}</option>
                  <option value="date">{copy.dateSort}</option>
                </select>
              </label>
              <label>{copy.direction}
                <select className="select" value={props.sortDir} onChange={event => props.setSortDir(event.target.value as CaseSortDir)}>
                  <option value="asc">{copy.ascending}</option>
                  <option value="desc">{copy.descending}</option>
                </select>
              </label>
            </div>
            <div className={styles.sheetActions}>
              <button type="button" className={styles.resetButton} onClick={resetFilters}>{copy.reset}</button>
              <button type="button" className={styles.applyButton} onClick={() => setFiltersOpen(false)}>{copy.apply}</button>
            </div>
          </div>
        </div>
      )}

      {statusCaseId && (
        <div className={styles.backdrop} role="presentation" onMouseDown={event => event.target === event.currentTarget && setStatusCaseId(null)}>
          <div className={`${styles.sheet} ${styles.statusSheet}`} role="dialog" aria-modal="true" aria-labelledby="case-mobile-status-title">
            <div className={styles.handle} />
            <div className={styles.sheetHead}>
              <h2 id="case-mobile-status-title">{copy.changeStatus}</h2>
              <button type="button" className={styles.closeButton} aria-label={copy.cancel} onClick={() => setStatusCaseId(null)}>×</button>
            </div>
            <div className={styles.statusChoices}>
              {props.statuses.map(status => {
                const colors = props.statusColors(status)
                const itemStyle = { '--case-status-color': colors.color } as CSSProperties
                return (
                  <button key={status.id || status.name} type="button" style={itemStyle} onClick={async event => {
                    await props.onQuickChangeStatus(statusCaseId, status.name, event)
                    setStatusCaseId(null)
                  }}>
                    <span className={styles.statusDot} />
                    <span>{caseStatusLabel(props.lang, status.name)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
