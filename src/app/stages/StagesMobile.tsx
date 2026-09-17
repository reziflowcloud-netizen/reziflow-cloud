'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import TutorialVideoButton from '@/components/TutorialVideoButton'
import { useLanguage } from '@/context/LanguageContext'
import styles from './StagesMobile.module.css'

export type StageStatusItem = {
  id: number
  name: string
  color: string
  order: number
}

export type StageCaseItem = {
  id: string
  caseNumber?: string | null
  status: string
  service?: { name: string; color?: string | null } | null
  totalValue: number
  totalPaid: number
}

export type StageClientItem = {
  id: string
  firstName: string
  lastName: string
  phone?: string | null
  cases: StageCaseItem[]
}

type StagesMobileProps = {
  columns: StageStatusItem[]
  clients: StageClientItem[]
  filteredClients: StageClientItem[]
  canConfigureStatuses: boolean
  clientQuery: string
  onClientQueryChange: (value: string) => void
}

function clientName(client: StageClientItem) {
  return `${client.firstName || ''} ${client.lastName || ''}`.trim() || '—'
}

function clientInitials(client: StageClientItem) {
  return [client.firstName, client.lastName]
    .filter(Boolean)
    .slice(0, 2)
    .map(value => String(value).trim()[0])
    .join('')
    .toUpperCase() || '•'
}

function amount(value: number) {
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(Number(value || 0))
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

export default function StagesMobile({
  columns,
  clients,
  filteredClients,
  canConfigureStatuses,
  clientQuery,
  onClientQueryChange,
}: StagesMobileProps) {
  const { t } = useLanguage()
  const [selectedStageName, setSelectedStageName] = useState(columns[0]?.name || '')
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!columns.some(stage => stage.name === selectedStageName)) {
      setSelectedStageName(columns[0]?.name || '')
    }
  }, [columns, selectedStageName])

  useEffect(() => {
    function close(event: globalThis.MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) setOverflowOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const selectedStage = columns.find(stage => stage.name === selectedStageName) || columns[0]

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const stage of columns) {
      counts.set(stage.name, filteredClients.reduce(
        (sum, client) => sum + client.cases.filter(item => item.status === stage.name).length,
        0,
      ))
    }
    return counts
  }, [columns, filteredClients])

  const selectedClients = useMemo(() => {
    if (!selectedStage) return []
    return filteredClients.flatMap(client => {
      const primaryCases = client.cases.filter(item => item.status === selectedStage.name)
      if (primaryCases.length === 0) return []
      const contextCases = client.cases.filter(item => item.status !== selectedStage.name).slice(0, 1)
      return [{ client, primaryCases, contextCases }]
    })
  }, [filteredClients, selectedStage])

  const selectedCount = selectedClients.reduce((sum, item) => sum + item.primaryCases.length, 0)
  const stageColorByName = useMemo(
    () => new Map(columns.map(stage => [stage.name, stage.color || '#64748b'])),
    [columns],
  )

  return (
    <section className={styles.mobileOnly} aria-label={t('stages_title')} data-mobile-stages>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h1>{t('stages_title')}</h1>
            <p>{t('clients_count')}: {clients.length} · {t('statuses_count')}: {columns.length}</p>
          </div>
          <div className={styles.overflowWrap} ref={overflowRef}>
            <button
              type="button"
              className={styles.overflowButton}
              aria-label={t('mobile_actions')}
              aria-expanded={overflowOpen}
              onClick={() => setOverflowOpen(value => !value)}
            >•••</button>
            {overflowOpen && (
              <div className={styles.overflowMenu}>
                <TutorialVideoButton videoKey="stages" className={styles.overflowAction} />
                {canConfigureStatuses && <Link href="/settings/statuses" className={styles.overflowAction}>{t('configure_statuses')}</Link>}
              </div>
            )}
          </div>
        </header>

        <div className={styles.railLabel}>{t('case_stage')}</div>
        <div className={styles.stageRail} role="tablist" aria-label={t('case_stage')}>
          {columns.map(stage => {
            const active = stage.name === selectedStage?.name
            const color = stage.color || '#64748b'
            const stageStyle = { '--stage-color': color } as CSSProperties
            return (
              <button
                key={stage.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${styles.stageChip} ${active ? styles.stageChipActive : ''}`}
                style={stageStyle}
                data-stage-color={color}
                onClick={() => setSelectedStageName(stage.name)}
              >
                <span className={styles.stageName} title={stage.name}>{stage.name}</span>
                <span className={styles.stageCount}>{stageCounts.get(stage.name) || 0}</span>
              </button>
            )
          })}
        </div>

        <label className={styles.searchBox}>
          <span className={styles.searchIcon}><SearchIcon /></span>
          <span className={styles.srOnly}>{t('client_search')}</span>
          <input
            value={clientQuery}
            onChange={event => onClientQueryChange(event.target.value)}
            placeholder={t('stage_search_placeholder')}
          />
        </label>

        <div className={styles.summary}>
          <h2 title={selectedStage?.name}>{selectedStage?.name || t('stages_title')}</h2>
          <span>{selectedCount} {t('cases_count_label')}</span>
        </div>

        {!selectedStage || selectedClients.length === 0 ? (
          <div className={styles.emptyState} role="status">
            <strong>{clientQuery ? t('clients_not_found') : t('no_cases_in_stage')}</strong>
            {!clientQuery && selectedStage && <span>{selectedStage.name}</span>}
          </div>
        ) : (
          <div className={styles.cards}>
            {selectedClients.map(({ client, primaryCases, contextCases }) => (
              <article className={styles.clientCard} key={client.id}>
                <Link href={`/clients/${client.id}`} className={styles.clientLink}>
                  <span className={styles.avatar}>{clientInitials(client)}</span>
                  <span className={styles.identity}>
                    <strong title={clientName(client)}>{clientName(client)}</strong>
                    <span title={client.phone || t('phone_not_specified')}>{client.phone || t('phone_not_specified')}</span>
                  </span>
                  <span className={styles.chevron} aria-hidden="true">›</span>
                </Link>

                <div className={styles.caseList}>
                  {[...primaryCases, ...contextCases].map(caseItem => {
                    const isPrimary = caseItem.status === selectedStage.name
                    const serviceColor = caseItem.service?.color || '#64748b'
                    const statusColor = stageColorByName.get(caseItem.status) || '#64748b'
                    const rowStyle = {
                      '--service-color': serviceColor,
                      '--case-status-color': statusColor,
                    } as CSSProperties
                    const paid = Number(caseItem.totalPaid || 0)
                    const value = Number(caseItem.totalValue || 0)
                    const fullyPaid = value > 0 && paid >= value
                    const title = caseItem.service?.name || caseItem.caseNumber || t('no_service')
                    return (
                      <Link
                        key={caseItem.id}
                        href={`/cases/${caseItem.id}`}
                        className={`${styles.caseRow} ${!isPrimary ? styles.contextCase : ''}`}
                        style={rowStyle}
                        data-service-color={serviceColor}
                        data-case-status-color={statusColor}
                      >
                        <span className={styles.serviceMarker} aria-hidden="true" />
                        <span className={styles.caseCopy}>
                          <strong title={title}>{title}</strong>
                          <span className={fullyPaid ? styles.paid : undefined}>
                            {value > 0 ? `${amount(paid)} / ${amount(value)} zł` : (caseItem.caseNumber || t('other_case'))}
                          </span>
                        </span>
                        <span className={styles.statusBadge} title={caseItem.status}>{caseItem.status}</span>
                        <span className={styles.caseChevron} aria-hidden="true">›</span>
                      </Link>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
