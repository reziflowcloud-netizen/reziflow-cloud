'use client'

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TutorialVideoButton from '@/components/TutorialVideoButton'
import { useLanguage } from '@/context/LanguageContext'
import { caseStatusLabel, isActiveCaseStatus } from '@/lib/caseI18n'
import styles from './ClientsMobile.module.css'

const CLIENT_ACCENT_PALETTE = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']
const NEUTRAL_SERVICE_COLOR = '#64748b'

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3.5h6.5L18 8v12.5H7V3.5Z" />
      <path d="M13 3.5V8h5" />
      <path d="M9.5 12h6M9.5 15.5h6" />
    </svg>
  )
}

function slavicCaseWord(count: number, words: [string, string, string]) {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod10 === 1 && mod100 !== 11) return words[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return words[1]
  return words[2]
}

const COPY = {
  ru: {
    results: 'результатов',
    cases: 'Дела',
    caseFallback: 'Дело',
    responsible: 'Ответственный',
    notAssigned: 'Не назначен',
    noPhone: 'Телефон не указан',
    noCases: 'Нет дел',
    moreCases: (count: number) => `Ещё ${count} ${slavicCaseWord(count, ['дело', 'дела', 'дел'])}`,
    closedCases: (count: number) => `Закрыто: ${count} ${slavicCaseWord(count, ['дело', 'дела', 'дел'])}`,
    loadError: 'Не удалось загрузить клиентов',
  },
  uk: {
    results: 'результатів',
    cases: 'Справи',
    caseFallback: 'Справа',
    responsible: 'Відповідальний',
    notAssigned: 'Не призначено',
    noPhone: 'Телефон не вказано',
    noCases: 'Справ немає',
    moreCases: (count: number) => `Ще ${count} ${slavicCaseWord(count, ['справа', 'справи', 'справ'])}`,
    closedCases: (count: number) => `Закрито: ${count} ${slavicCaseWord(count, ['справа', 'справи', 'справ'])}`,
    loadError: 'Не вдалося завантажити клієнтів',
  },
  pl: {
    results: 'wyników',
    cases: 'Sprawy',
    caseFallback: 'Sprawa',
    responsible: 'Odpowiedzialny',
    notAssigned: 'Nie przypisano',
    noPhone: 'Brak numeru telefonu',
    noCases: 'Brak spraw',
    moreCases: (count: number) => `Jeszcze ${count} ${slavicCaseWord(count, ['sprawa', 'sprawy', 'spraw'])}`,
    closedCases: (count: number) => `Zamknięto: ${count} ${slavicCaseWord(count, ['sprawa', 'sprawy', 'spraw'])}`,
    loadError: 'Nie udało się załadować klientów',
  },
}

type ClientsMobileProps = {
  clients: any[]
  filteredClients: any[]
  loading: boolean
  loadError: boolean
  search: string
  setSearch: (value: string) => void
  restrictedAccess: boolean
}

function clientName(client: any) {
  return `${client.firstName || ''} ${client.lastName || ''}`.trim() || '—'
}

function clientInitials(client: any) {
  return [client.firstName, client.lastName]
    .filter(Boolean)
    .slice(0, 2)
    .map(value => String(value).trim()[0])
    .join('')
    .toUpperCase() || '•'
}

function clientAccentColor(client: any) {
  const stableKey = String(client.id || clientName(client))
  let hash = 0
  for (let index = 0; index < stableKey.length; index += 1) {
    hash = ((hash * 31) + stableKey.charCodeAt(index)) >>> 0
  }
  return CLIENT_ACCENT_PALETTE[hash % CLIENT_ACCENT_PALETTE.length]
}

export default function ClientsMobile({
  clients,
  filteredClients,
  loading,
  loadError,
  search,
  setSearch,
  restrictedAccess,
}: ClientsMobileProps) {
  const { lang, t } = useLanguage()
  const router = useRouter()
  const copy = COPY[lang]
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(event: globalThis.MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) setOverflowOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function openClient(id: string) {
    router.push(`/clients/${id}`)
  }

  function openClientFromKeyboard(event: KeyboardEvent<HTMLElement>, id: string) {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openClient(id)
  }

  function openCase(event: MouseEvent<HTMLButtonElement>, id: string) {
    event.stopPropagation()
    router.push(`/cases/${id}`)
  }

  return (
    <section className={`${styles.mobileOnly} ${styles.shell}`} aria-label={t('clients_title')} data-mobile-clients>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('clients_title')}</h1>
          <div className={styles.subtitle}>{t('total')}: {clients.length}</div>
        </div>
        <div className={styles.overflowWrap} ref={overflowRef}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Menu"
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen(value => !value)}
          >•••</button>
          {overflowOpen && (
            <div className={styles.overflowMenu}>
              <TutorialVideoButton videoKey="clients" className={styles.overflowVideo} />
            </div>
          )}
        </div>
      </div>

      <Link href="/clients/new" className={styles.primaryAction}>＋ {t('add_client').replace(/^\+\s*/, '')}</Link>

      <label className={styles.searchBox}>
        <span className={styles.searchIcon} aria-hidden="true">⌕</span>
        <span className={styles.srOnly}>{t('search_clients_full')}</span>
        <input
          className={styles.searchInput}
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder={t('search_clients_full')}
        />
      </label>

      <div className={styles.resultsHeader}>
        <h2>{t('clients_title')}</h2>
        <span>{filteredClients.length} {copy.results}</span>
      </div>

      {loading ? (
        <div className={styles.state}>{t('loading')}</div>
      ) : loadError ? (
        <div className={styles.state} role="alert">{copy.loadError}</div>
      ) : filteredClients.length === 0 ? (
        <div className={styles.state}>
          <div>{search ? t('not_found') : t('no_clients')}</div>
          {!search && <Link href="/clients/new" className={styles.stateAction}>{t('add_client')}</Link>}
        </div>
      ) : (
        <div className={styles.cards}>
          {filteredClients.map(client => {
            const cases = Array.isArray(client.cases) ? client.cases : []
            const activeCases = cases.filter((item: any) => isActiveCaseStatus(item.status))
            const previewCases = activeCases.slice(0, 2)
            const remainingCases = Math.max(0, cases.length - previewCases.length)
            const responsible = client.assignedTo?.name || client.assignedTo?.email || copy.notAssigned
            const name = clientName(client)
            const avatarAccent = clientAccentColor(client)
            const avatarStyle = { '--client-accent': avatarAccent } as CSSProperties

            return (
              <article
                key={client.id}
                className={styles.card}
                data-mobile-client-card
                role="link"
                tabIndex={0}
                aria-label={name}
                onClick={() => openClient(client.id)}
                onKeyDown={event => openClientFromKeyboard(event, client.id)}
              >
                <div className={styles.identity}>
                  <div className={styles.avatar} style={avatarStyle} data-client-avatar-color={avatarAccent}>
                    {clientInitials(client)}
                  </div>
                  <div className={styles.person}>
                    <div className={styles.name} title={name}>{name}</div>
                    <div className={styles.phone} title={client.phone || copy.noPhone}>
                      <span aria-hidden="true">☎</span> {client.phone || copy.noPhone}
                    </div>
                  </div>
                  <span className={styles.chevron} aria-hidden="true">›</span>
                </div>

                <div className={`${styles.metaGrid} ${restrictedAccess ? styles.metaGridRestricted : ''}`}>
                  {!restrictedAccess && (
                    <div className={styles.metric} data-client-responsible>
                      <span className={styles.metricIcon} aria-hidden="true">
                        <PersonIcon className={styles.metricSvg} />
                      </span>
                      <span className={styles.metricCopy}>
                        <span className={styles.metricLabel}>{copy.responsible}</span>
                        <span className={styles.metricValue} title={responsible}>{responsible}</span>
                      </span>
                    </div>
                  )}
                  <div className={styles.metric}>
                    <span className={styles.metricIcon} aria-hidden="true">
                      <DocumentIcon className={styles.metricSvg} />
                    </span>
                    <span className={styles.metricCopy}>
                      <span className={styles.metricLabel}>{copy.cases}</span>
                      <span className={styles.metricValue}>{cases.length}</span>
                    </span>
                  </div>
                </div>

                {previewCases.length > 0 ? (
                  <div className={styles.caseList}>
                    {previewCases.map((caseItem: any) => {
                      const statusColor = caseItem.statusColor || '#64748b'
                      const statusStyle = { '--case-status-color': statusColor } as CSSProperties
                      const serviceColor = caseItem.service?.color || NEUTRAL_SERVICE_COLOR
                      const serviceStyle = { '--service-color': serviceColor } as CSSProperties
                      const caseTitle = caseItem.service?.name || caseItem.caseNumber || copy.caseFallback
                      return (
                        <button
                          key={caseItem.id}
                          type="button"
                          className={styles.caseRow}
                          data-mobile-case-row
                          data-service-color={serviceColor}
                          style={serviceStyle}
                          onClick={event => openCase(event, caseItem.id)}
                          aria-label={`${caseTitle}, ${caseStatusLabel(lang, caseItem.status)}`}
                        >
                          <span className={styles.caseTitle} title={caseTitle}>
                            <span className={styles.caseIcon} aria-hidden="true">
                              <DocumentIcon className={styles.caseIconSvg} />
                            </span>
                            <span>{caseTitle}</span>
                          </span>
                          <span className={styles.statusBadge} style={statusStyle} title={caseStatusLabel(lang, caseItem.status)} data-case-status-color={statusColor}>
                            {caseStatusLabel(lang, caseItem.status)}
                          </span>
                          <span className={styles.caseChevron} aria-hidden="true">›</span>
                        </button>
                      )
                    })}
                    {remainingCases > 0 && <div className={styles.moreCases}>＋ {copy.moreCases(remainingCases)}</div>}
                  </div>
                ) : (
                  <div className={styles.caseSummary}>
                    {cases.length > 0 ? copy.closedCases(cases.length) : copy.noCases}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
