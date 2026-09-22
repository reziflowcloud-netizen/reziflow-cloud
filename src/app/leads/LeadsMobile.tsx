'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import BulkActionsBar, { type BulkActionPayload } from '@/components/BulkActionsBar'
import MobileEntityIcon from '@/components/mobile/MobileEntityIcon'
import { LEAD_TEMPERATURES, leadDisplayName, type LeadSourceOption } from '@/lib/leads'
import { leadStatusLabel, leadTemperatureLabel } from '@/lib/leadI18n'
import type { Lang } from '@/lib/translations'
import styles from './LeadsMobile.module.css'
import StaffScopeControl from '@/components/StaffScopeControl'
import type { StaffScopeValue } from '@/lib/staffScope'

type QuickFilter = 'all' | 'today' | 'overdue' | 'unassigned' | 'no_next_contact'
type DatePreset = 'all' | 'today' | 'last7' | 'last30' | 'this_month' | 'last_month' | 'custom'

const COPY = {
  ru: {
    total: 'Всего', active: 'Активных', add: 'Добавить лид', select: 'Выбрать', cancel: 'Отмена',
    search: 'Поиск по имени, телефону, Instagram…', filters: 'Фильтры', results: 'результатов', leads: 'Лиды',
    source: 'Источник', interest: 'Интерес', next: 'Следующий контакт', responsible: 'Ответственный',
    noValue: 'Не указано', noContact: 'Нет следующего контакта', notAssigned: 'Не назначен',
    selected: 'Выбрано', selectPage: 'Выбрать текущую страницу', clearPage: 'Снять выбор со страницы',
    dashboard: 'Dashboard', calendar: 'Календарь лидов', apply: 'Показать', reset: 'Сбросить',
    status: 'Статус', temperature: 'Температура', period: 'Период создания', allStatuses: 'Все статусы',
    allSources: 'Все источники', allInterests: 'Все интересы', allTemperatures: 'Все температуры',
    allPeriod: 'За всё время', todayPeriod: 'Сегодня', last7: 'Последние 7 дней', last30: 'Последние 30 дней',
    thisMonth: 'Этот месяц', lastMonth: 'Прошлый месяц', custom: 'Свой период', from: 'От', to: 'До',
    loading: 'Загрузка лидов…', empty: 'Лиды не найдены', addFirst: 'Добавить первый лид',
    overdue: 'Просрочено', today: 'Сегодня', tomorrow: 'Завтра', dayShort: 'дн.',
    quick: { all: 'Все', today: 'Сегодня', overdue: 'Просроченные', unassigned: 'Без ответственного', no_next_contact: 'Без контакта' },
  },
  uk: {
    total: 'Усього', active: 'Активних', add: 'Додати лід', select: 'Вибрати', cancel: 'Скасувати',
    search: 'Пошук за ім’ям, телефоном, Instagram…', filters: 'Фільтри', results: 'результатів', leads: 'Ліди',
    source: 'Джерело', interest: 'Інтерес', next: 'Наступний контакт', responsible: 'Відповідальний',
    noValue: 'Не вказано', noContact: 'Немає наступного контакту', notAssigned: 'Не призначено',
    selected: 'Вибрано', selectPage: 'Вибрати поточну сторінку', clearPage: 'Зняти вибір зі сторінки',
    dashboard: 'Пульт', calendar: 'Календар лідів', apply: 'Показати', reset: 'Скинути',
    status: 'Статус', temperature: 'Температура', period: 'Період створення', allStatuses: 'Усі статуси',
    allSources: 'Усі джерела', allInterests: 'Усі інтереси', allTemperatures: 'Усі температури',
    allPeriod: 'За весь час', todayPeriod: 'Сьогодні', last7: 'Останні 7 днів', last30: 'Останні 30 днів',
    thisMonth: 'Цей місяць', lastMonth: 'Минулий місяць', custom: 'Свій період', from: 'Від', to: 'До',
    loading: 'Завантаження лідів…', empty: 'Лідів не знайдено', addFirst: 'Додати перший лід',
    overdue: 'Прострочено', today: 'Сьогодні', tomorrow: 'Завтра', dayShort: 'дн.',
    quick: { all: 'Усі', today: 'Сьогодні', overdue: 'Прострочені', unassigned: 'Без відповідального', no_next_contact: 'Без контакту' },
  },
  pl: {
    total: 'Wszystkie', active: 'Aktywne', add: 'Dodaj lead', select: 'Wybierz', cancel: 'Anuluj',
    search: 'Szukaj po nazwie, telefonie, Instagramie…', filters: 'Filtry', results: 'wyników', leads: 'Leady',
    source: 'Źródło', interest: 'Zainteresowanie', next: 'Następny kontakt', responsible: 'Odpowiedzialny',
    noValue: 'Nie podano', noContact: 'Brak następnego kontaktu', notAssigned: 'Nie przypisano',
    selected: 'Wybrano', selectPage: 'Wybierz bieżącą stronę', clearPage: 'Odznacz bieżącą stronę',
    dashboard: 'Pulpit', calendar: 'Kalendarz leadów', apply: 'Pokaż', reset: 'Wyczyść',
    status: 'Status', temperature: 'Temperatura', period: 'Okres utworzenia', allStatuses: 'Wszystkie statusy',
    allSources: 'Wszystkie źródła', allInterests: 'Wszystkie zainteresowania', allTemperatures: 'Wszystkie temperatury',
    allPeriod: 'Cały okres', todayPeriod: 'Dzisiaj', last7: 'Ostatnie 7 dni', last30: 'Ostatnie 30 dni',
    thisMonth: 'Ten miesiąc', lastMonth: 'Poprzedni miesiąc', custom: 'Własny okres', from: 'Od', to: 'Do',
    loading: 'Ładowanie leadów…', empty: 'Nie znaleziono leadów', addFirst: 'Dodaj pierwszy lead',
    overdue: 'Zaległe', today: 'Dzisiaj', tomorrow: 'Jutro', dayShort: 'd.',
    quick: { all: 'Wszystkie', today: 'Dzisiaj', overdue: 'Zaległe', unassigned: 'Bez opiekuna', no_next_contact: 'Bez kontaktu' },
  },
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function nextContactPresentation(value: string | undefined, locale: string, copy: typeof COPY.ru) {
  if (!value) return { label: copy.noContact, tone: 'neutral' as const }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { label: copy.noContact, tone: 'neutral' as const }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (date.getTime() < now.getTime()) {
    const overdueDays = Math.max(0, -days)
    return { label: overdueDays > 0 ? `${copy.overdue} ${overdueDays} ${copy.dayShort} · ${time}` : `${copy.overdue} · ${time}`, tone: 'overdue' as const }
  }
  if (dateKey(date) === dateKey(now)) return { label: `${copy.today} · ${time}`, tone: 'today' as const }
  if (days === 1) return { label: `${copy.tomorrow} · ${time}`, tone: 'today' as const }
  return { label: date.toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), tone: 'neutral' as const }
}

function contactLine(lead: any, fallback: string) {
  if (lead.phone) return `☎ ${lead.phone}`
  if (lead.instagram) return `◎ ${lead.instagram.startsWith('@') ? lead.instagram : `@${lead.instagram}`}`
  if (lead.email) return `✉ ${lead.email}`
  if (lead.facebook) return `f ${lead.facebook}`
  return fallback
}

export type LeadsMobileProps = {
  lang: Lang
  locale: string
  loading: boolean
  leads: any[]
  pagedLeads: any[]
  filteredCount: number
  activeCount: number
  quickFilter: QuickFilter
  setQuickFilter: Dispatch<SetStateAction<QuickFilter>>
  quickCounts: Record<QuickFilter, number>
  status: string
  setStatus: Dispatch<SetStateAction<string>>
  statusReasonFilter: string
  setStatusReasonFilter: Dispatch<SetStateAction<string>>
  source: string
  setSource: Dispatch<SetStateAction<string>>
  interest: string
  setInterest: Dispatch<SetStateAction<string>>
  temperature: string
  setTemperature: Dispatch<SetStateAction<string>>
  datePreset: DatePreset
  setDatePreset: Dispatch<SetStateAction<DatePreset>>
  createdFrom: string
  setCreatedFrom: Dispatch<SetStateAction<string>>
  createdTo: string
  setCreatedTo: Dispatch<SetStateAction<string>>
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  statuses: any[]
  statusCounts: Record<string, number>
  statusReasons: string[]
  showStatusReasons: boolean
  sources: LeadSourceOption[]
  interests: string[]
  temperatureCounts: Record<string, number>
  sourceLabel: (value?: string | null) => string
  normalizedStatus: (value?: string) => string
  statusColors: (status: any) => { bg: string; color: string }
  responsibleName: (lead: any) => string
  restrictedAccess: boolean
  staffScope: StaffScopeValue
  setStaffScope: (value: StaffScopeValue) => void
  selectedCount: number
  currentPageCount: number
  allVisibleSelected: boolean
  allFilteredSelected: boolean
  isSelected: (id: string) => boolean
  toggleSelection: (id: string) => void
  toggleVisibleSelection: () => void
  selectAllFiltered: () => void
  clearSelection: () => void
  selectionDescription: string
  employees: any[]
  onBulkApply: (payload: BulkActionPayload) => Promise<{ updated: number }>
  onOpenLead: (id: string) => void
  currentPage: number
  totalPages: number
  onPreviousPage: () => void
  onNextPage: () => void
}

export default function LeadsMobile(props: LeadsMobileProps) {
  const copy = COPY[props.lang] || COPY.ru
  const [selectionMode, setSelectionMode] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) setOverflowOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    if (!filtersOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [filtersOpen])

  const activeFilterCount = [props.status, props.statusReasonFilter, props.source, props.interest, props.temperature, props.datePreset !== 'all' ? props.datePreset : '', props.staffScope !== (props.restrictedAccess ? 'mine' : 'all') ? props.staffScope : ''].filter(Boolean).length

  function cancelSelection() {
    props.clearSelection()
    setSelectionMode(false)
  }

  function resetFilters() {
    props.setStatus('')
    props.setStatusReasonFilter('')
    props.setSource('')
    props.setInterest('')
    props.setTemperature('')
    props.setDatePreset('all')
    props.setCreatedFrom('')
    props.setCreatedTo('')
  }

  function activateCard(lead: any) {
    if (selectionMode) props.toggleSelection(lead.id)
    else props.onOpenLead(lead.id)
  }

  async function applyBulk(payload: BulkActionPayload) {
    const result = await props.onBulkApply(payload)
    setSelectionMode(false)
    return result
  }

  return (
    <section className={`${styles.mobileOnly} ${styles.shell}`} aria-label={copy.leads}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{copy.leads}</h1>
          <div className={styles.subtitle}>{copy.total}: {props.leads.length} · {copy.active}: {props.activeCount}</div>
        </div>
        <div className={styles.overflowWrap} ref={overflowRef}>
          <button type="button" className={styles.iconButton} aria-label="Menu" aria-expanded={overflowOpen} onClick={() => setOverflowOpen(value => !value)}>•••</button>
          {overflowOpen && (
            <div className={styles.overflowMenu}>
              <Link href="/dashboard">⌂ {copy.dashboard}</Link>
              <Link href="/calendar">◷ {copy.calendar}</Link>
            </div>
          )}
        </div>
      </div>

      <div className={styles.primaryActions}>
        <Link href="/leads/new" className={styles.primaryAction}>＋ {copy.add}</Link>
        <button type="button" className={styles.secondaryAction} onClick={() => selectionMode ? cancelSelection() : setSelectionMode(true)}>
          {selectionMode ? copy.cancel : copy.select}
        </button>
      </div>

      <div className={styles.rail} aria-label="Lead filters">
        {(Object.keys(copy.quick) as QuickFilter[]).map(key => (
          <button key={key} type="button" className={`${styles.chip} ${props.quickFilter === key ? styles.chipActive : ''}`} onClick={() => props.setQuickFilter(key)}>
            {copy.quick[key]} <span className={styles.chipCount}>{props.quickCounts[key]}</span>
          </button>
        ))}
        {props.statuses.map(item => {
          const colors = props.statusColors(item)
          const selected = props.status === item.name
          const statusChipStyle = { '--mobile-status-color': colors.color } as CSSProperties
          return (
            <button
              key={item.id || item.name}
              type="button"
              className={`${styles.chip} ${styles.statusChip} ${selected ? styles.statusChipActive : ''}`}
              style={statusChipStyle}
              aria-pressed={selected}
              onClick={() => props.setStatus(current => current === item.name ? '' : item.name)}
            >
              {leadStatusLabel(props.lang, item.name)} <span className={styles.chipCount}>{props.statusCounts[item.name] || 0}</span>
            </button>
          )
        })}
        {LEAD_TEMPERATURES.map(item => (
          <button key={item.value} type="button" className={`${styles.chip} ${props.temperature === item.value ? styles.chipActive : ''}`} onClick={() => props.setTemperature(current => current === item.value ? '' : item.value)}>
            <span className={styles.tempDot} style={{ background: item.color }} />
            {leadTemperatureLabel(props.lang, item.value)} <span className={styles.chipCount}>{props.temperatureCounts[item.value] || 0}</span>
          </button>
        ))}
      </div>

      <div className={styles.searchRow}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>⌕</span>
          <input className={styles.searchInput} value={props.search} onChange={event => props.setSearch(event.target.value)} placeholder={copy.search} />
        </div>
        <button type="button" className={`${styles.iconButton} ${styles.filterButton}`} aria-label={copy.filters} onClick={() => setFiltersOpen(true)}>
          ☷
          {activeFilterCount > 0 && <span className={styles.filterCount}>{activeFilterCount}</span>}
        </button>
      </div>

      <div className={styles.resultsHeader}>
        <h2>{copy.leads}</h2>
        <span>{props.filteredCount} {copy.results}</span>
      </div>

      {selectionMode && props.selectedCount === 0 && (
        <div className={styles.selectionHint}>
          <strong>0 {copy.selected.toLowerCase()}</strong>
          <button type="button" onClick={props.toggleVisibleSelection}>{copy.selectPage}</button>
        </div>
      )}

      {selectionMode && props.selectedCount > 0 && (
        <div className={styles.bulkWrap}>
          <BulkActionsBar
            entity="leads"
            lang={props.lang}
            selectedCount={props.selectedCount}
            currentPageCount={props.currentPageCount}
            filteredCount={props.filteredCount}
            allCurrentPageSelected={props.allVisibleSelected}
            allFilteredSelected={props.allFilteredSelected}
            selectionDescription={props.selectionDescription}
            employees={props.employees}
            statuses={props.statuses}
            statusLabel={name => leadStatusLabel(props.lang, name)}
            onSelectAllFiltered={props.selectAllFiltered}
            onClear={cancelSelection}
            onApply={applyBulk}
          />
        </div>
      )}

      {selectionMode && props.selectedCount > 0 && !props.allVisibleSelected && (
        <div className={styles.selectionHint}>
          <span />
          <button type="button" onClick={props.toggleVisibleSelection}>{copy.selectPage}</button>
        </div>
      )}

      {props.loading ? (
        <div className={styles.state}>{copy.loading}</div>
      ) : props.pagedLeads.length === 0 ? (
        <div className={styles.state}>
          <div>{copy.empty}</div>
          <Link href="/leads/new" className={styles.primaryAction}>{copy.addFirst}</Link>
        </div>
      ) : (
        <div className={styles.cards}>
          {props.pagedLeads.map(lead => {
            const statusName = props.normalizedStatus(lead.status)
            const statusConfig = props.statuses.find(item => item.name === statusName)
            const colors = props.statusColors(statusConfig)
            const temp = LEAD_TEMPERATURES.find(item => item.value === lead.urgency)
            const nextContact = nextContactPresentation(lead.nextContactAt, props.locale, copy)
            const selected = props.isSelected(lead.id)
            const overdue = nextContact.tone === 'overdue'
            const responsible = props.responsibleName(lead)
            const statusStyle = { '--mobile-status-bg': colors.bg, '--mobile-status-color': colors.color } as CSSProperties
            return (
              <article
                key={lead.id}
                className={`${styles.card} ${selected ? styles.cardSelected : ''} ${overdue ? styles.cardOverdue : ''}`}
                onClick={() => activateCard(lead)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    activateCard(lead)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={leadDisplayName(lead)}
              >
                <div className={styles.cardTop}>
                  <div className={styles.avatar}>{leadDisplayName(lead).slice(0, 2).toUpperCase()}</div>
                  <div className={styles.person}>
                    <div className={styles.name}>{leadDisplayName(lead)}</div>
                    <div className={styles.contact}>{contactLine(lead, copy.noValue)}</div>
                  </div>
                  <span className={styles.status} style={{ ...statusStyle, background: colors.bg, color: colors.color }}>{leadStatusLabel(props.lang, statusName)}</span>
                  {selectionMode ? (
                    <input className={styles.cardCheckbox} type="checkbox" checked={selected} onChange={() => props.toggleSelection(lead.id)} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} aria-label={leadDisplayName(lead)} />
                  ) : <span className={styles.chevron}>›</span>}
                </div>

                <div className={styles.facts}>
                  <div className={styles.fact}>
                    <span className={styles.factLabel}>◖ {copy.source}</span>
                    <span className={styles.factValue} title={props.sourceLabel(lead.source)}>{props.sourceLabel(lead.source)}</span>
                  </div>
                  <div className={styles.fact}>
                    <span className={styles.factLabel}>▤ {copy.interest}</span>
                    <span className={styles.factValue} title={lead.serviceInterest || copy.noValue}>{lead.serviceInterest || copy.noValue}</span>
                  </div>
                </div>

                <div className={styles.cardBottom}>
                  <div className={styles.nextContact}>
                    <span className={styles.factLabel}>◷ {copy.next}</span>
                    <span className={`${styles.nextValue} ${nextContact.tone === 'overdue' ? styles.nextOverdue : nextContact.tone === 'today' ? styles.nextToday : ''}`} title={nextContact.label}>{nextContact.label}</span>
                  </div>
                  <div className={styles.temperature} title={temp ? leadTemperatureLabel(props.lang, temp.value) : copy.noValue}>
                    <span className={styles.tempDot} style={{ background: temp?.color || 'var(--muted)' }} />
                    {temp ? leadTemperatureLabel(props.lang, temp.value) : copy.noValue}
                  </div>
                </div>
                {props.staffScope === 'all' && responsible && (
                  <div className={styles.responsibleFooter} title={`${copy.responsible}: ${responsible}`} aria-label={`${copy.responsible}: ${responsible}`}>
                    <MobileEntityIcon type="person" />
                    <span>{responsible}</span>
                  </div>
                )}
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
        <div className={styles.backdrop} onMouseDown={event => event.target === event.currentTarget && setFiltersOpen(false)}>
          <section className={styles.sheet} role="dialog" aria-modal="true" aria-label={copy.filters}>
            <div className={styles.handle} />
            <div className={styles.sheetHead}>
              <h2>{copy.filters}</h2>
              <button type="button" className={styles.closeButton} aria-label={copy.cancel} onClick={() => setFiltersOpen(false)}>×</button>
            </div>
            <div className={styles.filterFields}>
              <StaffScopeControl value={props.staffScope} onChange={props.setStaffScope} employees={props.employees} restricted={props.restrictedAccess} lang={props.lang} compact />
              <label>{copy.status}
                <select className="select" value={props.status} onChange={event => props.setStatus(event.target.value)}>
                  <option value="">{copy.allStatuses}</option>
                  {props.statuses.map(item => <option key={item.id || item.name} value={item.name}>{leadStatusLabel(props.lang, item.name)}</option>)}
                </select>
              </label>
              {props.showStatusReasons && props.statusReasons.length > 0 && (
                <div className={styles.reasonRail}>
                  {props.statusReasons.map(reason => (
                    <button key={reason} type="button" className={`${styles.chip} ${props.statusReasonFilter === reason ? styles.chipActive : ''}`} onClick={() => props.setStatusReasonFilter(current => current === reason ? '' : reason)}>{reason}</button>
                  ))}
                </div>
              )}
              <label>{copy.source}
                <select className="select" value={props.source} onChange={event => props.setSource(event.target.value)}>
                  <option value="">{copy.allSources}</option>
                  {props.sources.map(item => <option key={item.value} value={item.value}>{props.sourceLabel(item.value)}</option>)}
                </select>
              </label>
              <label>{copy.interest}
                <select className="select" value={props.interest} onChange={event => props.setInterest(event.target.value)}>
                  <option value="">{copy.allInterests}</option>
                  {props.interests.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>{copy.temperature}
                <select className="select" value={props.temperature} onChange={event => props.setTemperature(event.target.value)}>
                  <option value="">{copy.allTemperatures}</option>
                  {LEAD_TEMPERATURES.map(item => <option key={item.value} value={item.value}>{leadTemperatureLabel(props.lang, item.value)}</option>)}
                </select>
              </label>
              <label>{copy.period}
                <select className="select" value={props.datePreset} onChange={event => props.setDatePreset(event.target.value as DatePreset)}>
                  <option value="all">{copy.allPeriod}</option>
                  <option value="today">{copy.todayPeriod}</option>
                  <option value="last7">{copy.last7}</option>
                  <option value="last30">{copy.last30}</option>
                  <option value="this_month">{copy.thisMonth}</option>
                  <option value="last_month">{copy.lastMonth}</option>
                  <option value="custom">{copy.custom}</option>
                </select>
              </label>
              {props.datePreset === 'custom' && (
                <div className={styles.dateGrid}>
                  <label>{copy.from}<input className="input" type="date" value={props.createdFrom} onChange={event => props.setCreatedFrom(event.target.value)} /></label>
                  <label>{copy.to}<input className="input" type="date" value={props.createdTo} onChange={event => props.setCreatedTo(event.target.value)} /></label>
                </div>
              )}
            </div>
            <div className={styles.sheetActions}>
              <button type="button" className={styles.resetButton} onClick={resetFilters}>{copy.reset}</button>
              <button type="button" className={styles.applyButton} onClick={() => setFiltersOpen(false)}>{copy.apply} · {props.filteredCount}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
