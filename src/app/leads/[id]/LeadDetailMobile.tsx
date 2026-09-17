'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import Link from 'next/link'
import { DEFAULT_LEAD_STATUSES, LEAD_TEMPERATURES, POLISH_VOIVODESHIPS, leadDisplayName, type LeadSourceOption } from '@/lib/leads'
import { leadSourceOptionLabel, leadStatusLabel, leadTemperatureLabel, leadText } from '@/lib/leadI18n'
import type { ContactPhoneInput } from '@/lib/phones'
import styles from './LeadDetailMobile.module.css'

type MobileTab = 'overview' | 'contacts' | 'dialog' | 'qualification' | 'reminders'
type Lang = 'ru' | 'uk' | 'pl'

type LeadDetailMobileProps = {
  lead: any
  form: any
  setForm: Dispatch<SetStateAction<any>>
  lang: Lang
  locale: string
  services: any[]
  employees: any[]
  leadStatuses: any[]
  leadSources: LeadSourceOption[]
  messages: any[]
  reminders: any[]
  messageSources: LeadSourceOption[]
  messageForm: any
  setMessageForm: Dispatch<SetStateAction<any>>
  quickNote: string
  setQuickNote: Dispatch<SetStateAction<string>>
  quickNextContactAt: string
  setQuickNextContactAt: Dispatch<SetStateAction<string>>
  quickNextContactNote: string
  setQuickNextContactNote: Dispatch<SetStateAction<string>>
  reminderForm: { reminderAt: string; note: string }
  setReminderForm: Dispatch<SetStateAction<{ reminderAt: string; note: string }>>
  saving: boolean
  savingMessage: boolean
  savingReminder: boolean
  quickSaving: boolean
  converting: boolean
  error: string
  restrictedAccess: boolean
  sourceLabel: (value?: string | null) => string
  instagramHref: (value?: string | null) => string
  facebookHref: (value?: string | null) => string
  onBack: () => void
  onSave: () => void
  onOpenConvert: () => void
  onDelete: () => void
  onQuickAction: (actionKey: string) => void
  onScheduleQuickContact: () => void
  onAddMessage: () => void
  onAddReminder: () => void
  onCompleteReminder: (reminder: any) => void
}

const COPY: Record<Lang, {
  tabs: Record<MobileTab, string>
  more: string
  back: string
  save: string
  overviewFields: string
  contactDetails: string
  messageComposer: string
  qualificationFields: string
  reminderForm: string
  convert: string
  openClient: string
  dashboard: string
  deleteLead: string
  close: string
  phoneType: string
  phoneTypes: Record<string, string>
  primary: string
  note: string
  addPhone: string
  removePhone: string
}> = {
  ru: {
    tabs: { overview: 'Обзор', contacts: 'Контакты', dialog: 'Диалог', qualification: 'Квалификация', reminders: 'Напоминания' },
    more: 'Ещё', back: 'Назад', save: 'Сохранить', overviewFields: 'Основные данные', contactDetails: 'Контактные данные', messageComposer: 'Новое сообщение', qualificationFields: 'Данные квалификации', reminderForm: 'Новое напоминание', convert: 'Перевести в клиента', openClient: 'Открыть клиента', dashboard: 'Пульт', deleteLead: 'Удалить лид', close: 'Закрыть', phoneType: 'Тип телефона', phoneTypes: { '': 'Тип', main: 'Основной', polish: 'Польский', ukrainian: 'Украинский', work: 'Рабочий', other: 'Другой' }, primary: 'Основной', note: 'Примечание', addPhone: 'Добавить телефон', removePhone: 'Удалить',
  },
  uk: {
    tabs: { overview: 'Огляд', contacts: 'Контакти', dialog: 'Діалог', qualification: 'Кваліфікація', reminders: 'Нагадування' },
    more: 'Ще', back: 'Назад', save: 'Зберегти', overviewFields: 'Основні дані', contactDetails: 'Контактні дані', messageComposer: 'Нове повідомлення', qualificationFields: 'Дані кваліфікації', reminderForm: 'Нове нагадування', convert: 'Перевести в клієнта', openClient: 'Відкрити клієнта', dashboard: 'Пульт', deleteLead: 'Видалити лід', close: 'Закрити', phoneType: 'Тип телефону', phoneTypes: { '': 'Тип', main: 'Основний', polish: 'Польський', ukrainian: 'Український', work: 'Робочий', other: 'Інший' }, primary: 'Основний', note: 'Примітка', addPhone: 'Додати телефон', removePhone: 'Видалити',
  },
  pl: {
    tabs: { overview: 'Przegląd', contacts: 'Kontakty', dialog: 'Dialog', qualification: 'Kwalifikacja', reminders: 'Przypomnienia' },
    more: 'Więcej', back: 'Wstecz', save: 'Zapisz', overviewFields: 'Dane podstawowe', contactDetails: 'Dane kontaktowe', messageComposer: 'Nowa wiadomość', qualificationFields: 'Dane kwalifikacji', reminderForm: 'Nowe przypomnienie', convert: 'Przenieś do klienta', openClient: 'Otwórz klienta', dashboard: 'Pulpit', deleteLead: 'Usuń leada', close: 'Zamknij', phoneType: 'Typ telefonu', phoneTypes: { '': 'Typ', main: 'Główny', polish: 'Polski', ukrainian: 'Ukraiński', work: 'Służbowy', other: 'Inny' }, primary: 'Główny', note: 'Notatka', addPhone: 'Dodaj telefon', removePhone: 'Usuń',
  },
}

function MobileIcon({ name, className }: { name: string; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (name === 'back') return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>
  if (name === 'check') return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>
  if (name === 'phone') return <svg {...common}><path d="M6.6 3.5 9 8l-2 2c1.4 3 3.8 5.4 6.8 6.8l2-2 4.5 2.4c.4.2.6.6.5 1-.4 2-2 3.3-4 3.3C9 21.5 2.5 15 2.5 7.2c0-2 1.4-3.6 3.3-4 .4-.1.7.1.8.3Z" /></svg>
  if (name === 'source') return <svg {...common}><path d="M4 13v-2l13-5v12L4 13Z" /><path d="M7 14v5h4l-1-4" /><path d="M19 9v6" /></svg>
  if (name === 'document') return <svg {...common}><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></svg>
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  if (name === 'person') return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></svg>
  if (name === 'temperature') return <svg {...common}><path d="M10 14.8V5a2 2 0 0 1 4 0v9.8a4 4 0 1 1-4 0Z" /><path d="M12 9v7" /></svg>
  if (name === 'message') return <svg {...common}><path d="M4 5h16v12H8l-4 4V5Z" /><path d="M8 9h8M8 13h5" /></svg>
  if (name === 'blocked') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></svg>
  if (name === 'bell') return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 21h4" /></svg>
  return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></svg>
}

function dateTimeLabel(value: string | null | undefined, locale: string, empty: string) {
  if (!value) return empty
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return empty
  return date.toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function nextContactTone(value?: string | null) {
  if (!value) return 'neutral'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'neutral'
  const now = new Date()
  if (date.getTime() < now.getTime()) return 'overdue'
  if (date.toDateString() === now.toDateString()) return 'today'
  return 'neutral'
}

export default function LeadDetailMobile(props: LeadDetailMobileProps) {
  const copy = COPY[props.lang]
  const lt = (key: string) => leadText(props.lang, key)
  const [activeTab, setActiveTab] = useState<MobileTab>('overview')
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)
  const messageListRef = useRef<HTMLDivElement>(null)
  const statuses = props.leadStatuses.length ? props.leadStatuses : DEFAULT_LEAD_STATUSES
  const statusConfig = statuses.find(status => status.name === props.form.status)
  const statusColor = statusConfig?.color || '#64748b'
  const serviceConfig = props.services.find(service => service.name === props.form.serviceInterest)
  const serviceColor = serviceConfig?.color || '#64748b'
  const temperature = LEAD_TEMPERATURES.find(item => item.value === props.form.urgency)
  const responsible = props.employees.find(employee => String(employee.id) === String(props.form.employeeId))?.name
    || props.lead.employee?.name
    || props.lead.assignedTo?.name
    || lt('not_assigned')
  const selectedStatusReasons = Array.isArray(statusConfig?.reasons)
    ? statusConfig.reasons.map((item: any) => String(item || '').trim()).filter(Boolean)
    : []
  const phoneRows: ContactPhoneInput[] = Array.isArray(props.form.phones) && props.form.phones.length
    ? props.form.phones
    : [{ phone: props.form.phone || '', label: '', note: '', isPrimary: true, whatsapp: false, telegram: false, viber: false }]
  const statusStyle = { '--mobile-lead-status': statusColor } as CSSProperties
  const serviceStyle = { '--mobile-service-color': serviceColor } as CSSProperties
  const temperatureStyle = { '--mobile-temperature-color': temperature?.color || '#64748b' } as CSSProperties
  const nextTone = nextContactTone(props.form.nextContactAt)

  useEffect(() => {
    function close(event: globalThis.MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) setOverflowOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    if (activeTab === 'dialog' && messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    }
  }, [activeTab, props.messages])

  function updateForm(key: string, value: any) {
    props.setForm((current: any) => ({ ...current, [key]: value }))
  }

  function changeStatus(value: string) {
    props.setForm((current: any) => ({ ...current, status: value, statusReason: '', statusReasonComment: '' }))
  }

  function updatePhone(index: number, patch: Partial<ContactPhoneInput>) {
    const next = phoneRows.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : { ...item })
    if (patch.isPrimary) next.forEach((item, itemIndex) => { item.isPrimary = itemIndex === index })
    if (!next.some(item => item.isPrimary)) next[0].isPrimary = true
    const primary = next.find(item => item.isPrimary)?.phone || next[0]?.phone || ''
    props.setForm((current: any) => ({ ...current, phones: next, phone: primary }))
  }

  function removePhone(index: number) {
    const next = phoneRows.filter((_, itemIndex) => itemIndex !== index)
    const rows = next.length ? next : [{ phone: '', label: '', note: '', isPrimary: true, whatsapp: false, telegram: false, viber: false }]
    if (!rows.some(item => item.isPrimary)) rows[0].isPrimary = true
    const primary = rows.find(item => item.isPrimary)?.phone || rows[0]?.phone || ''
    props.setForm((current: any) => ({ ...current, phones: rows, phone: primary }))
  }

  function addPhone() {
    props.setForm((current: any) => ({
      ...current,
      phones: [...phoneRows, { phone: '', label: '', note: '', isPrimary: false, whatsapp: false, telegram: false, viber: false }],
    }))
  }

  const tabs = useMemo(() => (Object.keys(copy.tabs) as MobileTab[]).map(id => ({ id, label: copy.tabs[id] })), [copy])

  return (
    <section className={`${styles.mobileOnly} ${styles.shell}`} data-mobile-lead-detail data-active-tab={activeTab}>
      <header className={styles.header}>
        <button type="button" className={styles.circleButton} aria-label={copy.back} onClick={props.onBack}>
          <MobileIcon name="back" className={styles.headerIcon} />
        </button>
        <div className={styles.identity}>
          <h1 title={leadDisplayName(props.lead)}>{leadDisplayName(props.lead)}</h1>
          <div title={props.form.phone || props.lead.phone || props.lead.email || props.lead.instagram || lt('contact_not_set')}>
            <MobileIcon name="phone" className={styles.identityIcon} />
            <span>{props.form.phone || props.lead.phone || props.lead.email || props.lead.instagram || lt('contact_not_set')}</span>
          </div>
        </div>
        <div className={styles.overflowWrap} ref={overflowRef}>
          <button type="button" className={styles.circleButton} aria-label={copy.more} aria-expanded={overflowOpen} onClick={() => setOverflowOpen(value => !value)}>
            <MobileIcon name="more" className={styles.headerIcon} />
          </button>
          {overflowOpen && (
            <div className={styles.overflowMenu}>
              <Link href="/dashboard" onClick={() => setOverflowOpen(false)}>{copy.dashboard}</Link>
              {props.lead.convertedClientId ? (
                <Link href={`/clients/${props.lead.convertedClientId}`} onClick={() => setOverflowOpen(false)}>{copy.openClient}</Link>
              ) : (
                <button type="button" onClick={() => { setOverflowOpen(false); props.onOpenConvert() }} disabled={props.converting}>{copy.convert}</button>
              )}
              <button type="button" className={styles.destructiveAction} onClick={() => { setOverflowOpen(false); props.onDelete() }}>{copy.deleteLead}</button>
            </div>
          )}
        </div>
      </header>

      <div className={styles.primaryActions}>
        <label className={styles.statusControl} style={statusStyle} data-lead-status-color={statusColor}>
          <span className={styles.srOnly}>{lt('status')}</span>
          <select value={props.form.status || ''} onChange={event => changeStatus(event.target.value)}>
            {statuses.map(status => <option key={status.id || status.name} value={status.name}>{leadStatusLabel(props.lang, status.name)}</option>)}
          </select>
        </label>
        <button type="button" className={styles.saveButton} onClick={props.onSave} disabled={props.saving}>
          <MobileIcon name="check" className={styles.actionIcon} />
          {props.saving ? lt('saving') : copy.save}
        </button>
      </div>

      {props.error && <div className={styles.error} role="alert">{props.error}</div>}

      <section className={styles.summary} aria-label={copy.tabs.overview}>
        <div className={styles.summaryPair}>
          <div className={styles.summaryItem}>
            <MobileIcon name="source" className={styles.summaryIcon} />
            <span><small>{lt('source')}</small><strong>{props.sourceLabel(props.form.source)}</strong></span>
          </div>
          <div className={styles.summaryItem} style={serviceStyle} data-service-color={serviceColor}>
            <MobileIcon name="document" className={`${styles.summaryIcon} ${styles.serviceIcon}`} />
            <span><small>{lt('interest')}</small><strong title={props.form.serviceInterest || lt('no_value')}>{props.form.serviceInterest || lt('no_value')}</strong></span>
          </div>
        </div>
        <div className={styles.summaryWide}>
          <MobileIcon name="clock" className={styles.summaryIcon} />
          <span>
            <small>{lt('next_contact')}</small>
            <strong className={`${styles.dateBadge} ${nextTone === 'overdue' ? styles.dateOverdue : nextTone === 'today' ? styles.dateToday : ''}`}>
              {dateTimeLabel(props.form.nextContactAt, props.locale, lt('no_value'))}
            </strong>
            {props.form.nextContactNote && <em title={props.form.nextContactNote}>{props.form.nextContactNote}</em>}
          </span>
        </div>
        <div className={styles.summaryWide}>
          <MobileIcon name="clock" className={styles.summaryIcon} />
          <span><small>{lt('last_contact')}</small><strong>{dateTimeLabel(props.form.lastContactAt, props.locale, lt('no_value'))}</strong>{props.form.lastContactNote && <em title={props.form.lastContactNote}>{props.form.lastContactNote}</em>}</span>
        </div>
        <div className={`${styles.summaryPair} ${props.restrictedAccess ? styles.summaryPairRestricted : ''}`}>
          {!props.restrictedAccess && (
            <div className={styles.summaryItem} data-mobile-responsible>
              <MobileIcon name="person" className={styles.summaryIcon} />
              <span><small>{lt('responsible')}</small><strong title={responsible}>{responsible}</strong></span>
            </div>
          )}
          <div className={styles.summaryItem} style={temperatureStyle}>
            <MobileIcon name="temperature" className={styles.summaryIcon} />
            <span><small>{lt('urgency')}</small><strong><i className={styles.temperatureDot} />{props.form.urgency ? leadTemperatureLabel(props.lang, props.form.urgency) : lt('temperature_empty')}</strong></span>
          </div>
        </div>
      </section>

      <nav className={styles.tabRail} aria-label="Lead detail sections">
        {tabs.map(tab => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? styles.tabActive : ''} aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={styles.tabContent}>
        {activeTab === 'overview' && (
          <>
            <section className={styles.card}>
              <h2>{copy.overviewFields}</h2>
              <div className={styles.fields}>
                <label>{lt('source')}<select value={props.form.source || ''} onChange={event => updateForm('source', event.target.value)}>{props.leadSources.map(source => <option key={source.value} value={source.value}>{leadSourceOptionLabel(props.lang, source)}</option>)}</select></label>
                {!props.restrictedAccess && <label data-mobile-responsible-field>{lt('responsible')}<select value={props.form.employeeId || ''} onChange={event => updateForm('employeeId', event.target.value)}><option value="">{lt('not_assigned')}</option>{props.employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>}
                <label>{lt('interested_service')}<select value={props.form.serviceInterest || ''} onChange={event => updateForm('serviceInterest', event.target.value)}><option value="">{lt('choose_service')}</option>{props.services.map(service => <option key={service.id} value={service.name}>{service.name}</option>)}</select></label>
                {statusConfig?.requireReason && <label>{lt('status_reason')}<select value={props.form.statusReason || ''} onChange={event => updateForm('statusReason', event.target.value)}><option value="">{lt('choose_reason')}</option>{selectedStatusReasons.map((reason: string) => <option key={reason} value={reason}>{reason}</option>)}</select></label>}
                {statusConfig?.requireReason && <label>{lt('reason_comment')}<textarea rows={3} value={props.form.statusReasonComment || ''} onChange={event => updateForm('statusReasonComment', event.target.value)} placeholder={lt('comment_placeholder')} /></label>}
                <label>{lt('last_contact')}<input type="datetime-local" value={props.form.lastContactAt || ''} onChange={event => updateForm('lastContactAt', event.target.value)} /></label>
                <label>{lt('last_contact_about')}<textarea rows={3} value={props.form.lastContactNote || ''} onChange={event => updateForm('lastContactNote', event.target.value)} placeholder={lt('last_contact_note_placeholder')} /></label>
                <label>{lt('next_contact')}<input type="datetime-local" value={props.form.nextContactAt || ''} onChange={event => updateForm('nextContactAt', event.target.value)} /></label>
                <label>{lt('next_contact_about')}<textarea rows={3} value={props.form.nextContactNote || ''} onChange={event => updateForm('nextContactNote', event.target.value)} placeholder={lt('next_contact_note_placeholder')} /></label>
              </div>
            </section>

            <section className={styles.card}>
              <h2>{lt('quick_actions')}</h2>
              <div className={styles.quickActions}>
                <button type="button" onClick={() => props.onQuickAction('quick_called')} disabled={props.quickSaving}><MobileIcon name="phone" className={styles.quickIcon} />{lt('quick_called')}</button>
                <button type="button" onClick={() => props.onQuickAction('quick_wrote')} disabled={props.quickSaving}><MobileIcon name="message" className={styles.quickIcon} />{lt('quick_wrote')}</button>
                <button type="button" onClick={() => props.onQuickAction('quick_no_answer')} disabled={props.quickSaving}><MobileIcon name="blocked" className={styles.quickIcon} />{lt('quick_no_answer')}</button>
              </div>
              <label className={styles.standaloneField}>{lt('quick_contact_note')}<textarea rows={3} value={props.quickNote} onChange={event => props.setQuickNote(event.target.value)} placeholder={lt('quick_note_placeholder')} /></label>
              <div className={styles.scheduleBlock}>
                <h3><MobileIcon name="clock" className={styles.sectionIcon} />{lt('schedule_next_contact')}</h3>
                <label>{lt('next_contact')}<input type="datetime-local" value={props.quickNextContactAt} onChange={event => props.setQuickNextContactAt(event.target.value)} /></label>
                <label>{lt('next_contact_note')}<textarea rows={3} value={props.quickNextContactNote} onChange={event => props.setQuickNextContactNote(event.target.value)} placeholder={lt('next_contact_note_placeholder')} /></label>
                <button type="button" className={styles.fullPrimary} onClick={props.onScheduleQuickContact} disabled={props.quickSaving || (!props.quickNextContactAt && !props.quickNextContactNote.trim())}>{props.quickSaving ? lt('saving') : lt('quick_schedule')}</button>
              </div>
            </section>
          </>
        )}

        {activeTab === 'contacts' && (
          <section className={styles.card}>
            <h2>{copy.contactDetails}</h2>
            <div className={styles.fields}>
              <label>{lt('first_name')}<input value={props.form.firstName || ''} onChange={event => updateForm('firstName', event.target.value)} /></label>
              <label>{lt('last_name')}<input value={props.form.lastName || ''} onChange={event => updateForm('lastName', event.target.value)} /></label>
            </div>
            <div className={styles.phoneList}>
              <h3>{lt('phone')}</h3>
              {phoneRows.map((phone, index) => (
                <div key={phone.id || index} className={styles.phoneCard} data-mobile-phone-row>
                  <label>{lt('phone')}<input type="tel" value={phone.phone || ''} onChange={event => updatePhone(index, { phone: event.target.value })} placeholder="+48..." /></label>
                  <label>{copy.phoneType}<select value={phone.label || ''} onChange={event => updatePhone(index, { label: event.target.value })}>{Object.entries(copy.phoneTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className={styles.primaryPhone}><input type="radio" checked={Boolean(phone.isPrimary)} onChange={() => updatePhone(index, { isPrimary: true })} />{copy.primary}</label>
                  <div className={styles.channelChecks}>{(['whatsapp', 'telegram', 'viber'] as const).map(channel => <label key={channel}><input type="checkbox" checked={Boolean(phone[channel])} onChange={event => updatePhone(index, { [channel]: event.target.checked } as Partial<ContactPhoneInput>)} />{channel === 'whatsapp' ? 'WhatsApp' : channel === 'telegram' ? 'Telegram' : 'Viber'}</label>)}</div>
                  <label>{copy.note}<input value={phone.note || ''} onChange={event => updatePhone(index, { note: event.target.value })} /></label>
                  <button type="button" className={styles.secondaryButton} onClick={() => removePhone(index)} disabled={phoneRows.length === 1 && !phone.phone}>{copy.removePhone}</button>
                </div>
              ))}
              <button type="button" className={styles.secondaryButton} onClick={addPhone}>＋ {copy.addPhone}</button>
            </div>
            <div className={styles.fields}>
              <label>{lt('email')}<input type="email" value={props.form.email || ''} onChange={event => updateForm('email', event.target.value)} /></label>
              <label>Instagram<input value={props.form.instagram || ''} onChange={event => updateForm('instagram', event.target.value)} />{props.instagramHref(props.form.instagram) && <a href={props.instagramHref(props.form.instagram)} target="_blank" rel="noreferrer">{lt('open_instagram')}</a>}</label>
              <label>Facebook<input value={props.form.facebook || ''} onChange={event => updateForm('facebook', event.target.value)} />{props.facebookHref(props.form.facebook) && <a href={props.facebookHref(props.form.facebook)} target="_blank" rel="noreferrer">{lt('open_facebook')}</a>}</label>
            </div>
          </section>
        )}

        {activeTab === 'dialog' && (
          <section className={styles.card}>
            <h2>{lt('dialog')}</h2>
            <div className={styles.messageList} ref={messageListRef}>
              {props.messages.length === 0 ? <div className={styles.emptyState}>{lt('no_messages')}</div> : props.messages.map(message => {
                const outgoing = message.direction === 'outgoing'
                const sender = message.senderType === 'bot' ? lt('bot') : message.senderType === 'employee' ? (message.author?.name || lt('employee')) : (message.senderName || lt('lead'))
                return (
                  <div key={message.id} className={`${styles.messageRow} ${outgoing ? styles.messageOutgoing : ''}`}>
                    <div className={styles.messageBubble}>
                      <small>{sender} · {props.sourceLabel(message.channel || 'manual')} · {dateTimeLabel(message.sentAt, props.locale, '')}</small>
                      <div>{message.text}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <h3>{copy.messageComposer}</h3>
            <div className={styles.fields}>
              <label>{lt('message_type')}<select value={props.messageForm.direction} onChange={event => props.setMessageForm((current: any) => ({ ...current, direction: event.target.value, senderType: event.target.value === 'outgoing' ? 'employee' : 'lead' }))}><option value="outgoing">{lt('company_reply')}</option><option value="incoming">{lt('lead_message')}</option></select></label>
              <label>{lt('author')}<select value={props.messageForm.senderType} onChange={event => props.setMessageForm((current: any) => ({ ...current, senderType: event.target.value }))}><option value="employee">{lt('employee')}</option><option value="lead">{lt('lead')}</option><option value="bot">{lt('bot')}</option><option value="system">{lt('system')}</option></select></label>
              <label>{lt('channel')}<select value={props.messageForm.channel} onChange={event => props.setMessageForm((current: any) => ({ ...current, channel: event.target.value }))}>{props.messageSources.map(source => <option key={source.value} value={source.value}>{leadSourceOptionLabel(props.lang, source)}</option>)}</select></label>
              <label>{lt('message')}<textarea rows={4} value={props.messageForm.text} onChange={event => props.setMessageForm((current: any) => ({ ...current, text: event.target.value }))} placeholder={lt('message_placeholder')} /></label>
            </div>
            <button type="button" className={styles.fullPrimary} onClick={props.onAddMessage} disabled={props.savingMessage || !props.messageForm.text.trim()}>{props.savingMessage ? lt('saving') : lt('add_message')}</button>
          </section>
        )}

        {activeTab === 'qualification' && (
          <section className={styles.card}>
            <h2>{copy.qualificationFields}</h2>
            <div className={styles.fields}>
              <label>{lt('city')}<input value={props.form.city || ''} onChange={event => updateForm('city', event.target.value)} /></label>
              <label>{lt('voivodeship')}<select value={props.form.voivodeship || ''} onChange={event => updateForm('voivodeship', event.target.value)}><option value="">{lt('no_value')}</option>{POLISH_VOIVODESHIPS.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
              <label>{lt('country')}<input value={props.form.country || ''} onChange={event => updateForm('country', event.target.value)} /></label>
              <label>{lt('language')}<input value={props.form.language || ''} onChange={event => updateForm('language', event.target.value)} /></label>
              <label>{lt('budget')}<input value={props.form.budget || ''} onChange={event => updateForm('budget', event.target.value)} /></label>
              <label>{lt('urgency')}<select value={props.form.urgency || ''} onChange={event => updateForm('urgency', event.target.value)}><option value="">{lt('temperature_empty')}</option>{LEAD_TEMPERATURES.map(item => <option key={item.value} value={item.value}>{leadTemperatureLabel(props.lang, item.value)}</option>)}</select></label>
              <label>{lt('deadline_at')}<input type="date" value={props.form.deadlineAt || ''} onChange={event => updateForm('deadlineAt', event.target.value)} /></label>
              <label>{lt('notes')}<textarea rows={7} value={props.form.notes || ''} onChange={event => updateForm('notes', event.target.value)} /></label>
            </div>
          </section>
        )}

        {activeTab === 'reminders' && (
          <section className={styles.card}>
            <h2>{copy.reminderForm}</h2>
            <div className={styles.fields}>
              <label>{lt('date_time')}<input type="datetime-local" value={props.reminderForm.reminderAt} onChange={event => props.setReminderForm(current => ({ ...current, reminderAt: event.target.value }))} /></label>
              <label>{lt('remind_about')}<textarea rows={3} value={props.reminderForm.note} onChange={event => props.setReminderForm(current => ({ ...current, note: event.target.value }))} placeholder={lt('reminder_placeholder')} /></label>
            </div>
            <button type="button" className={styles.fullPrimary} onClick={props.onAddReminder} disabled={props.savingReminder || !props.reminderForm.reminderAt || !props.reminderForm.note.trim()}>{props.savingReminder ? lt('saving') : lt('add_reminder')}</button>
            <div className={styles.reminderList}>
              <h3>{lt('all_reminders')}</h3>
              {props.reminders.length === 0 ? <div className={styles.emptyState}>{lt('no_reminders')}</div> : props.reminders.map(reminder => {
                const reminderDate = reminder.reminderAt || reminder.dueDate
                const done = reminder.status === 'done'
                return (
                  <article key={reminder.id} className={`${styles.reminderCard} ${done ? styles.reminderDone : ''}`}>
                    <div><strong>{dateTimeLabel(reminderDate, props.locale, lt('no_date'))}</strong><span>{done ? lt('reminder_done') : lt('reminder_active')}</span></div>
                    <p>{reminder.reminderNote || reminder.title}</p>
                    <small>{reminder.assignedTo?.name || lt('no_value')}</small>
                    {!done && !reminder.synthetic && <button type="button" className={styles.secondaryButton} onClick={() => props.onCompleteReminder(reminder)}>{lt('mark_completed')}</button>}
                  </article>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </section>
  )
}
