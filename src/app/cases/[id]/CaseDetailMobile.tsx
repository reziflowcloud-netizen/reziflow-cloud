'use client'

import Link from 'next/link'
import { useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import CustomSectionsRenderer, { type CustomSectionsHandle } from '@/components/CustomSectionsRenderer'
import { MobileAccordion, MobileChipRail } from '@/components/mobile'
import { caseStatusLabel } from '@/lib/caseI18n'
import { selectNearestCaseEvent } from '@/lib/caseNearestEvent'
import { VOIVODESHIP_OFFICE_GROUPS } from '@/lib/voivodeshipOffices'
import styles from './CaseDetailMobile.module.css'

type Language = 'ru' | 'uk' | 'pl'

const COPY: Record<Language, Record<string, string>> = {
  ru: {
    more: 'Ещё', dashboard: 'Пульт', deleteCase: 'Удалить дело', client: 'Клиент', service: 'Услуга', responsible: 'Ответственный',
    nearestEvent: 'Ближайшее событие', details: 'Детали', payments: 'Оплаты', comments: 'Комментарии', documents: 'Документы',
    basic: 'Основные данные', importantDates: 'Важные даты', tasks: 'Задачи и напоминания', mainGoal: 'Данные пребывания',
    workContract: 'Трудовой договор', agencyContract: 'Договор с агентством', mos: 'MOS и корреспонденция', updates: 'Актуализация документов',
    notes: 'Заметки', customSections: 'Дополнительные разделы', noEvents: 'Событий не запланировано', noDate: 'Важные даты не указаны', noTasks: 'Нет связанных задач',
    openClient: 'Открыть клиента', addTask: 'Создать задачу', active: 'Активно', done: 'Готово', financialSummary: 'Финансовое состояние',
    planned: 'Запланировано', received: 'Получено', addPayment: 'Добавить оплату', paymentPlan: 'План оплат', noPayments: 'Оплат пока нет',
    noPlanned: 'Запланированных оплат нет', convertPaid: 'Отметить оплаченной', edit: 'Изменить', cancel: 'Отмена', send: 'Отправить',
    noComments: 'Комментариев пока нет', generate: 'Создать DOCX', upload: 'Загрузить файл', uploading: 'Загрузка…', noDocuments: 'Документов пока нет',
    open: 'Открыть', download: 'Скачать', delete: 'Удалить', fileHint: 'PDF, PNG, JPEG, GIF или WebP', close: 'Закрыть',
    submitted: 'Поданные документы', toDeliver: 'Документы к подаче', selectAll: 'Выбрать все', submitSelected: 'Отметить поданными',
    cabinet: 'Доступ к кабинету', showPassword: 'Показать пароль', hidePassword: 'Скрыть пароль', customDate: 'Добавить дату',
    addUpdate: 'Добавить запись', specialMethod: 'Специальный способ', status: 'Статус', save: 'Сохранить', saving: 'Сохранение…',
  },
  uk: {
    more: 'Ще', dashboard: 'Пульт', deleteCase: 'Видалити справу', client: 'Клієнт', service: 'Послуга', responsible: 'Відповідальний',
    nearestEvent: 'Найближча подія', details: 'Деталі', payments: 'Оплати', comments: 'Коментарі', documents: 'Документи',
    basic: 'Основні дані', importantDates: 'Важливі дати', tasks: 'Завдання та нагадування', mainGoal: 'Дані перебування',
    workContract: 'Трудовий договір', agencyContract: 'Договір з агенцією', mos: 'MOS і кореспонденція', updates: 'Актуалізація документів',
    notes: 'Нотатки', customSections: 'Додаткові розділи', noEvents: 'Подій не заплановано', noDate: 'Важливі дати не вказані', noTasks: 'Немає пов’язаних завдань',
    openClient: 'Відкрити клієнта', addTask: 'Створити завдання', active: 'Активно', done: 'Готово', financialSummary: 'Фінансовий стан',
    planned: 'Заплановано', received: 'Отримано', addPayment: 'Додати оплату', paymentPlan: 'План оплат', noPayments: 'Оплат поки немає',
    noPlanned: 'Запланованих оплат немає', convertPaid: 'Позначити оплаченою', edit: 'Змінити', cancel: 'Скасувати', send: 'Надіслати',
    noComments: 'Коментарів поки немає', generate: 'Створити DOCX', upload: 'Завантажити файл', uploading: 'Завантаження…', noDocuments: 'Документів поки немає',
    open: 'Відкрити', download: 'Завантажити', delete: 'Видалити', fileHint: 'PDF, PNG, JPEG, GIF або WebP', close: 'Закрити',
    submitted: 'Подані документи', toDeliver: 'Документи до подання', selectAll: 'Обрати всі', submitSelected: 'Позначити поданими',
    cabinet: 'Доступ до кабінету', showPassword: 'Показати пароль', hidePassword: 'Сховати пароль', customDate: 'Додати дату',
    addUpdate: 'Додати запис', specialMethod: 'Спеціальний спосіб', status: 'Статус', save: 'Зберегти', saving: 'Збереження…',
  },
  pl: {
    more: 'Więcej', dashboard: 'Pulpit', deleteCase: 'Usuń sprawę', client: 'Klient', service: 'Usługa', responsible: 'Odpowiedzialny',
    nearestEvent: 'Najbliższe wydarzenie', details: 'Szczegóły', payments: 'Płatności', comments: 'Komentarze', documents: 'Dokumenty',
    basic: 'Dane podstawowe', importantDates: 'Ważne daty', tasks: 'Zadania i przypomnienia', mainGoal: 'Dane pobytu',
    workContract: 'Umowa o pracę', agencyContract: 'Umowa z agencją', mos: 'MOS i korespondencja', updates: 'Aktualizacja dokumentów',
    notes: 'Notatki', customSections: 'Dodatkowe sekcje', noEvents: 'Brak zaplanowanych wydarzeń', noDate: 'Nie podano ważnych dat', noTasks: 'Brak powiązanych zadań',
    openClient: 'Otwórz klienta', addTask: 'Utwórz zadanie', active: 'Aktywne', done: 'Gotowe', financialSummary: 'Stan finansowy',
    planned: 'Zaplanowane', received: 'Otrzymano', addPayment: 'Dodaj płatność', paymentPlan: 'Plan płatności', noPayments: 'Brak płatności',
    noPlanned: 'Brak zaplanowanych płatności', convertPaid: 'Oznacz jako opłaconą', edit: 'Edytuj', cancel: 'Anuluj', send: 'Wyślij',
    noComments: 'Brak komentarzy', generate: 'Utwórz DOCX', upload: 'Prześlij plik', uploading: 'Przesyłanie…', noDocuments: 'Brak dokumentów',
    open: 'Otwórz', download: 'Pobierz', delete: 'Usuń', fileHint: 'PDF, PNG, JPEG, GIF lub WebP', close: 'Zamknij',
    submitted: 'Złożone dokumenty', toDeliver: 'Dokumenty do złożenia', selectAll: 'Wybierz wszystkie', submitSelected: 'Oznacz jako złożone',
    cabinet: 'Dostęp do konta', showPassword: 'Pokaż hasło', hidePassword: 'Ukryj hasło', customDate: 'Dodaj datę',
    addUpdate: 'Dodaj wpis', specialMethod: 'Metoda specjalna', status: 'Status', save: 'Zapisz', saving: 'Zapisywanie…',
  },
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    back: <path d="m15 18-6-6 6-6" />,
    client: <><circle cx="12" cy="8" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
    service: <><path d="M7 3h8l3 3v15H7z" /><path d="M15 3v4h4M10 12h5M10 16h5" /></>,
    employee: <><circle cx="12" cy="7" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
    money: <><ellipse cx="9" cy="6" rx="5" ry="2.5" /><path d="M4 6v5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V6M4 11v5c0 1.4 2.2 2.5 5 2.5 1.2 0 2.3-.2 3.1-.6" /><path d="M14 11.5c.8-.3 1.8-.5 3-.5 2.8 0 5 1.1 5 2.5S19.8 16 17 16s-5-1.1-5-2.5c0-.8.7-1.5 2-2zM12 13.5v5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-5" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    file: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 13h6M9 17h6" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function VoivodeshipOptions() {
  return <>{VOIVODESHIP_OFFICE_GROUPS.map(group => <optgroup key={group.voivodeship} label={group.voivodeship}>{group.offices.map(office => <option key={office} value={office}>{office}</option>)}</optgroup>)}</>
}

function money(value: unknown, locale: string) {
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)} zł`
}

function dateValue(value: unknown) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function localDateKey(value = new Date()) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function CaseDetailMobile(props: any) {
  const lang: Language = props.lang === 'uk' || props.lang === 'pl' ? props.lang : 'ru'
  const copy = COPY[lang]
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [showCabinetPassword, setShowCabinetPassword] = useState(false)
  const mobileFileInput = useRef<HTMLInputElement>(null)
  const c = props.caseData
  const form = props.form
  const statusConfig = props.statuses.find((status: any) => status.name === form.status)
  const statusColor = statusConfig?.color || '#64748b'
  const service = props.services.find((item: any) => String(item.id) === String(form.serviceId)) || c.service
  const serviceColor = service?.color || '#06b6d4'
  const employee = props.employees.find((item: any) => String(item.id) === String(form.employeeId))
  const clientName = `${c.client?.firstName || ''} ${c.client?.lastName || ''}`.trim() || '—'
  const debt = Math.max(0, Number(c.totalValue || 0) - Number(c.totalPaid || 0))
  const statusStyle = { '--case-detail-status': statusColor } as CSSProperties
  const serviceStyle = { '--case-detail-service': serviceColor } as CSSProperties
  const today = localDateKey()

  const importantDates = useMemo(() => {
    const fixed = [
      { label: props.t('personal_visit'), date: form.personalAppearDate, time: form.personalAppearTime, note: form.personalAppearLocation },
      { label: props.t('fingerprints_date'), date: form.fingerprintsDate },
      { label: props.t('predicted_decision_date'), date: form.predictedDecisionDate },
      { label: props.t('legal_stay_deadline'), date: form.legalStayDeadline },
      { label: props.t('card_pickup_date'), date: form.cardPickupDate, time: form.cardPickupTime, note: form.cardPickupLocation },
      { label: props.t('filing_date'), date: form.filingDate },
    ]
    const custom = props.customDates.map((item: any) => ({ label: item.label, date: dateValue(item.date) }))
    return [...fixed, ...custom]
      .filter(item => dateValue(item.date))
      .map(item => ({ ...item, date: dateValue(item.date) }))
      .sort((a, b) => {
        const aFuture = a.date >= today
        const bFuture = b.date >= today
        if (aFuture !== bFuture) return aFuture ? -1 : 1
        return aFuture ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
      })
  }, [form.personalAppearDate, form.personalAppearTime, form.personalAppearLocation, form.fingerprintsDate, form.predictedDecisionDate, form.legalStayDeadline, form.cardPickupDate, form.cardPickupTime, form.cardPickupLocation, form.filingDate, props.customDates, props.t, today])

  const nearestDate = importantDates[0]
  const nearestEvent = useMemo(() => selectNearestCaseEvent(importantDates, props.caseTasks), [importantDates, props.caseTasks])
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  const nearestTone = nearestEvent?.overdue ? styles.dateOverdue : nearestEvent && nearestEvent.timestamp <= nextWeek.getTime() ? styles.dateNear : ''
  const options = (type: string, fallback: string[]) => {
    const loaded = props.caseOptions.filter((item: any) => item.type === type).sort((a: any, b: any) => a.order - b.order)
    return (loaded.length ? loaded.map((item: any) => item.value) : fallback).map((value: string) => <option key={value} value={value}>{value}</option>)
  }
  const submittedMosDocuments = props.mosDocuments.filter((doc: any) => doc.status === 'done' || doc.sentAt)
  const availableMosDocuments = props.availableMosDocuments || []
  const selectedMosDocNames = new Set(props.selectedMosDocNames)

  return (
    <section className={styles.mobileOnly} data-mobile-case-detail aria-label={copy.details}>
      <header className={styles.header}>
        <button type="button" className={styles.circleButton} aria-label="Back" onClick={props.onBack}><Icon name="back" /></button>
        <div className={styles.identity}>
          {String(c.caseNumber || '').trim() && <h1>{c.caseNumber}</h1>}
          <div style={serviceStyle} className={styles.identityService}>{service?.name || props.t('service_not_selected')}</div>
          <div className={styles.identityClient}>{clientName}</div>
        </div>
        <div className={styles.overflowWrap}>
          <button type="button" className={styles.circleButton} aria-label={copy.more} aria-expanded={overflowOpen} onClick={() => setOverflowOpen(value => !value)}><Icon name="more" /></button>
          {overflowOpen && (
            <div className={styles.overflowMenu}>
              <Link href="/dashboard" onClick={() => setOverflowOpen(false)}>{copy.dashboard}</Link>
              {props.canDeleteCase && props.isArchived && <button type="button" className={styles.dangerAction} onClick={props.onDeleteCase}>{copy.deleteCase}</button>}
            </div>
          )}
        </div>
      </header>

      <div className={styles.primaryActions}>
        <label className={styles.statusControl} style={statusStyle} data-case-status-color={statusColor}>
          <span>{copy.status}</span>
          <select value={form.status || ''} onChange={event => props.setField('status', event.target.value)}>
            {props.statuses.map((status: any) => <option key={status.id || status.name} value={status.name}>{caseStatusLabel(lang, status.name)}</option>)}
          </select>
        </label>
        <button type="button" className={styles.saveButton} onClick={props.onSave} disabled={props.saving}><Icon name="check" />{props.saving ? copy.saving : copy.save}</button>
      </div>

      <section className={styles.summary}>
        <Link href={`/clients/${c.client?.id}?backTo=${encodeURIComponent(`/cases/${c.id}`)}`} className={styles.clientRow}>
          <span className={styles.avatar}>{c.client?.firstName?.[0]}{c.client?.lastName?.[0]}</span>
          <span><small>{copy.client}</small><strong>{clientName}</strong><em>{c.client?.phone || '—'}</em></span>
          <Icon name="chevron" />
        </Link>
        <div className={`${styles.summaryGrid} ${props.restrictedAccess ? styles.summaryGridRestricted : ''}`}>
          <div className={styles.summaryItem} style={serviceStyle}><Icon name="service" /><span><small>{copy.service}</small><strong title={service?.name}>{service?.name || '—'}</strong></span></div>
          {!props.restrictedAccess && <div className={styles.summaryItem} data-mobile-responsible><Icon name="employee" /><span><small>{copy.responsible}</small><strong title={employee?.name}>{employee?.name || props.t('not_assigned')}</strong></span></div>}
        </div>
        <div className={styles.financeGrid} aria-label={copy.financialSummary}>
          <div><Icon name="money" /><span><small>{props.t('cost')}</small><strong>{money(c.totalValue, props.locale)}</strong></span></div>
          <div className={styles.received}><Icon name="money" /><span><small>{copy.received}</small><strong>{money(c.totalPaid, props.locale)}</strong></span></div>
          <div className={debt > 0 ? styles.debt : styles.paid}><Icon name="card" /><span><small>{props.t('case_debt')}</small><strong>{debt > 0 ? money(debt, props.locale) : props.t('paid')}</strong></span></div>
        </div>
        <div className={`${styles.nearestDate} ${nearestTone}`} data-nearest-event-source={nearestEvent?.source || 'none'} data-nearest-event-state={nearestEvent?.overdue ? 'overdue' : nearestEvent ? 'upcoming' : 'empty'}>
          <Icon name="calendar" />
          <span><small>{copy.nearestEvent}</small>{nearestEvent ? <><strong>{nearestEvent.label} · {new Date(`${nearestEvent.date}T00:00:00`).toLocaleDateString(props.locale)}{nearestEvent.time ? ` · ${nearestEvent.time}` : ''}</strong>{nearestEvent.note && <em>{nearestEvent.note}</em>}</> : <strong>{copy.noEvents}</strong>}</span>
        </div>
      </section>

      <MobileChipRail label="Case detail sections" className={styles.tabs}>
        {[
          ['details', copy.details, ''],
          ['payments', copy.payments, String(c.payments?.length || 0)],
          ['comments', copy.comments, String(c.comments?.length || 0)],
          ['docs', copy.documents, String(props.documents.length)],
        ].map(([value, label, count]) => <button key={value} type="button" className={props.tab === value ? styles.tabActive : ''} onClick={() => props.setTab(value)}>{label}{count && <span>{count}</span>}</button>)}
      </MobileChipRail>

      {props.tab === 'details' && (
        <div className={styles.tabContent}>
          <div data-section-scope="case" data-section-key="case-basic">
            <MobileAccordion title={copy.basic} summary={`${form.stayType || props.t('not_specified')} · ${service?.name || props.t('service_not_selected')}`} defaultOpen>
              <div className={styles.formGrid}>
                <label>{props.t('case_number')}<input value={form.caseNumber || ''} onChange={event => props.setField('caseNumber', event.target.value)} /></label>
                <label>{copy.service}<select value={form.serviceId || ''} onChange={event => props.setField('serviceId', event.target.value)}><option value="">{props.t('choose_service')}</option>{props.services.map((item: any) => <option key={item.id} value={String(item.id)}>{item.name}{item.price ? ` · ${money(item.price, props.locale)}` : ''}</option>)}</select></label>
                <label>{props.t('cost')} (zł)<input type="number" value={form.totalValue ?? ''} onChange={event => props.setField('totalValue', event.target.value)} /></label>
                <label>{props.t('stay_type')}<select value={form.stayType || ''} onChange={event => props.setField('stayType', event.target.value)}><option value="">—</option>{options('stayType', ['Выконывание пацы (Работа)', 'Обучение', 'Воссоединение семьи', 'Бизнес', 'Другое'])}</select></label>
                <label>{props.t('trustee')}<select value={form.trustee || ''} onChange={event => props.setField('trustee', event.target.value)}><option value="">{props.t('not_specified')}</option>{props.employees.map((item: any) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
                {!props.restrictedAccess && <label data-mobile-responsible-field>{props.t('employee')}<select value={form.employeeId || ''} onChange={event => props.setField('employeeId', event.target.value)}><option value="">{props.t('not_assigned')}</option>{props.employees.map((item: any) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}</select></label>}
              </div>
              <div data-custom-fields-slot="case:case-basic" />
            </MobileAccordion>
          </div>

          <div data-section-scope="case" data-section-key="case-important-dates">
            <MobileAccordion title={`${copy.importantDates} · ${importantDates.length}`} summary={nearestDate ? `${nearestDate.label} · ${new Date(`${nearestDate.date}T00:00:00`).toLocaleDateString(props.locale)}` : copy.noDate} defaultOpen>
              <div className={styles.formGrid}>
                <label>{props.t('filing_date')}<input type="date" value={form.filingDate || ''} onChange={event => props.setField('filingDate', event.target.value)} /></label>
                <label>{props.t('legal_stay_deadline')}<input type="date" value={form.legalStayDeadline || ''} onChange={event => props.setField('legalStayDeadline', event.target.value)} /></label>
                <label>{props.t('fingerprints_date')}<input type="date" value={form.fingerprintsDate || ''} onChange={event => props.setField('fingerprintsDate', event.target.value)} /></label>
                <label>{props.t('predicted_decision_date')}<input type="date" value={form.predictedDecisionDate || ''} onChange={event => props.setField('predictedDecisionDate', event.target.value)} /></label>
                <label>{props.t('personal_visit')}<input type="date" value={form.personalAppearDate || ''} onChange={event => props.setField('personalAppearDate', event.target.value)} /></label>
                <label>{props.t('personal_visit_time')}<input type="time" value={form.personalAppearTime || ''} onChange={event => props.setField('personalAppearTime', event.target.value)} /></label>
                <label className={styles.fullField}>{props.t('personal_visit_location')}<select value={form.personalAppearLocation || ''} onChange={event => props.setField('personalAppearLocation', event.target.value)}><option value="">{props.t('select_office')}</option><VoivodeshipOptions /></select></label>
                <label>{props.t('card_pickup_date')}<input type="date" value={form.cardPickupDate || ''} onChange={event => props.setField('cardPickupDate', event.target.value)} /></label>
                <label>{props.t('card_pickup_time')}<input type="time" value={form.cardPickupTime || ''} onChange={event => props.setField('cardPickupTime', event.target.value)} /></label>
                <label className={styles.fullField}>{props.t('card_pickup_location')}<select value={form.cardPickupLocation || ''} onChange={event => props.setField('cardPickupLocation', event.target.value)}><option value="">{props.t('select_office')}</option><VoivodeshipOptions /></select></label>
              </div>
              {props.customDates.length > 0 && <div className={styles.compactList}>{props.customDates.map((item: any) => <div key={item.id}><span><strong>{item.label}</strong><small>{item.date ? new Date(item.date).toLocaleDateString(props.locale) : props.t('date_not_set')}</small></span><button type="button" className={styles.iconDanger} onClick={() => props.onRemoveCustomDate(item.id)} aria-label={copy.delete}>×</button></div>)}</div>}
              <div className={styles.inlineForm}><input value={props.newDateLabel} onChange={event => props.setNewDateLabel(event.target.value)} placeholder={props.t('date_name_placeholder')} /><input type="date" value={props.newDateValue} onChange={event => props.setNewDateValue(event.target.value)} /><button type="button" onClick={props.onAddCustomDate} disabled={!props.newDateLabel.trim()}>{copy.customDate}</button></div>
              <div data-custom-fields-slot="case:case-important-dates" />
            </MobileAccordion>
          </div>

          <MobileAccordion title={`${copy.tasks} · ${props.caseTasks.length}`} summary={props.caseTasks[0]?.title || copy.noTasks} defaultOpen>
            {props.caseTasks.length > 0 ? <div className={styles.taskList}>{props.caseTasks.map((task: any) => <div key={task.id}><Icon name="check" /><span><strong>{task.title}</strong>{task.dueDate && <small>{new Date(task.dueDate).toLocaleDateString(props.locale)}</small>}{task.note && <em>{task.note}</em>}</span><b className={task.status === 'done' ? styles.taskDone : styles.taskActive}>{task.status === 'done' ? copy.done : copy.active}</b></div>)}</div> : <div className={styles.emptyState}>{copy.noTasks}</div>}
            <div className={styles.inlineForm}><input value={props.taskTitle} onChange={event => props.setTaskTitle(event.target.value)} placeholder={props.t('task_placeholder')} /><input type="date" value={props.taskDueDate} onChange={event => props.setTaskDueDate(event.target.value)} /><button type="button" onClick={props.onCreateTask} disabled={!props.taskTitle.trim() || props.taskSaving}>{copy.addTask}</button></div>
          </MobileAccordion>

          <div data-section-scope="case" data-section-key="case-main-goal">
            <MobileAccordion title={copy.mainGoal} summary={form.stayPurpose || props.t('not_specified')}>
              <div className={styles.formGrid}>
                <label className={styles.fullField}>{props.t('stay_purpose')}<select value={form.stayPurpose || ''} onChange={event => { props.setField('stayPurpose', event.target.value); if (!event.target.value.includes('часовый') && !event.target.value.includes('Временный')) props.setField('staySubPurpose', '') }}><option value="">—</option>{options('stayPurpose', ['Побыт часовый (Временный)', 'Побыт сталый (Постоянный)', 'Побыт длуготорминовы (Долгосрочный)'])}</select></label>
                {(form.stayPurpose?.includes('часовый') || form.stayPurpose?.includes('Временный')) && <label className={styles.fullField}>{props.t('stay_basis')}<select value={form.staySubPurpose || ''} onChange={event => props.setField('staySubPurpose', event.target.value)}><option value="">{props.t('choose_basis')}</option>{props.staySubPurposeOptions.map((item: string) => <option key={item}>{item}</option>)}</select></label>}
              </div>
              <div data-custom-fields-slot="case:case-main-goal" />
            </MobileAccordion>
          </div>

          {props.isWorkType && <div data-section-scope="case" data-section-key="case-work-contract"><MobileAccordion title={copy.workContract} summary={form.workContractNumber || form.workContractType || props.t('not_specified')}><div className={styles.formGrid}><label>{props.t('contract_type')}<select value={form.workContractType || ''} onChange={event => props.setField('workContractType', event.target.value)}><option value="">—</option>{options('contractType', ['Умова злецения (Договор подряда)', 'Умова о працу (Трудовой)', 'Умова о дзело (Договор)'])}</select></label><label>{props.t('contract_number')}<input value={form.workContractNumber || ''} onChange={event => props.setField('workContractNumber', event.target.value)} /></label><label>{props.t('contract_date')}<input type="date" value={form.workContractDate || ''} onChange={event => props.setField('workContractDate', event.target.value)} /></label><label>{props.t('contract_end_date')}<input type="date" value={form.workContractEndDate || ''} onChange={event => props.setField('workContractEndDate', event.target.value)} /></label><label className={styles.checkField}><input type="checkbox" checked={form.workContractSigned === true} onChange={event => props.setField('workContractSigned', event.target.checked)} />{props.t('contract_signed')}</label></div><div data-custom-fields-slot="case:case-work-contract" /></MobileAccordion></div>}

          <div data-section-scope="case" data-section-key="case-agency-contract"><MobileAccordion title={copy.agencyContract} summary={form.contractNumber || form.contractType || props.t('not_specified')}><div className={styles.formGrid}><label>{props.t('contract_type')}<select value={form.contractType || ''} onChange={event => props.setField('contractType', event.target.value)}><option value="">—</option>{options('contractType', ['Умова злецения (Договор подряда)', 'Умова о працу (Трудовой)', 'Умова о дзело (Договор)'])}</select></label><label>{props.t('contract_number')}<input value={form.contractNumber || ''} onChange={event => props.setField('contractNumber', event.target.value)} /></label><label>{props.t('contract_date')}<input type="date" value={form.contractDate || ''} onChange={event => props.setField('contractDate', event.target.value)} /></label><label className={styles.checkField}><input type="checkbox" checked={form.contractSigned === true} onChange={event => props.setField('contractSigned', event.target.checked)} />{props.t('contract_signed')}</label></div><div data-custom-fields-slot="case:case-agency-contract" /></MobileAccordion></div>

          <div data-section-scope="case" data-section-key="case-mos"><MobileAccordion title={copy.mos} summary={[form.mosNumber, props.mosId, submittedMosDocuments.length ? `${copy.documents}: ${submittedMosDocuments.length}` : ''].filter(Boolean).join(' · ') || props.t('not_specified')}>
            <div className={styles.formGrid}><label>{props.t('mos_number')}<input value={form.mosNumber || ''} onChange={event => props.setField('mosNumber', event.target.value)} /></label><label>ID<input value={props.mosId} onChange={event => props.setMosId(event.target.value)} /></label><label>{props.t('mos_sent_date')}<input type="date" value={form.mosSentAt || ''} onChange={event => props.setField('mosSentAt', event.target.value)} /></label>{props.mosEmailFieldEnabled && <label>{props.t('mos_email_address')}<input type="email" value={form.mosEmail || ''} onChange={event => props.setField('mosEmail', event.target.value)} /></label>}</div>
            <div className={styles.subsection}><h3>{copy.submitted}</h3>{submittedMosDocuments.length ? <div className={styles.compactList}>{submittedMosDocuments.map((doc: any) => <div key={doc.id}><span><strong>{String(doc.title || '').replace(/^MOS:\s*/, '')}</strong><small>{doc.sentAt ? new Date(doc.sentAt).toLocaleDateString(props.locale) : props.t('date_not_set')}</small></span><button type="button" className={styles.iconDanger} onClick={() => props.onDeleteMosDocument(doc.id)}>×</button></div>)}</div> : <div className={styles.emptyState}>{props.t('click_doc_when_submitted')}</div>}</div>
            <div className={styles.subsection}><div className={styles.subsectionHeading}><h3>{copy.toDeliver}</h3>{availableMosDocuments.length > 0 && <label className={styles.smallCheck}><input type="checkbox" checked={props.allAvailableMosDocumentsSelected} onChange={props.onToggleAllMosDocuments} />{copy.selectAll}</label>}</div>{availableMosDocuments.length ? <div className={styles.choiceList}>{availableMosDocuments.map((item: any, index: number) => <button type="button" key={item.id} className={selectedMosDocNames.has(item.value) ? styles.choiceSelected : ''} onClick={event => props.onToggleMosDocument(item.value, index, event.shiftKey)}><input type="checkbox" readOnly checked={selectedMosDocNames.has(item.value)} />{item.value}</button>)}</div> : <div className={styles.emptyState}>{props.t('all_mos_documents_submitted')}</div>}{props.selectedMosDocNames.length > 0 && <div className={styles.inlineForm}><input type="date" max={today} value={props.newMosDocDueDate} onChange={event => props.setNewMosDocDueDate(event.target.value)} /><button type="button" onClick={props.onClearMosSelection}>{copy.cancel}</button><button type="button" onClick={props.onSubmitMosDocuments} disabled={!props.newMosDocDueDate || props.submittingMosDocuments}>{copy.submitSelected}</button></div>}</div>
            <div className={styles.subsection}><h3>{copy.cabinet}</h3><div className={styles.formGrid}><label>{props.t('cabinet_login')}<input value={form.cabinetLogin || ''} onChange={event => props.setField('cabinetLogin', event.target.value)} autoComplete="off" /></label><label>{props.t('cabinet_password')}<span className={styles.passwordField}><input type={showCabinetPassword ? 'text' : 'password'} value={form.cabinetPassword || ''} onChange={event => props.setField('cabinetPassword', event.target.value)} autoComplete="new-password" /><button type="button" onClick={() => setShowCabinetPassword(value => !value)}>{showCabinetPassword ? copy.hidePassword : copy.showPassword}</button></span></label></div></div>
            <div className={styles.subsection}><h3>{props.t('additional_reminder')}</h3><div className={styles.inlineForm}><input value={props.customReminderTitle} onChange={event => props.setCustomReminderTitle(event.target.value)} placeholder={props.t('remind_about')} /><input type="date" value={props.customReminderDate} onChange={event => props.setCustomReminderDate(event.target.value)} /><button type="button" onClick={props.onCreateCustomReminder} disabled={!props.customReminderTitle.trim() || !props.customReminderDate || props.customReminderSaving}>{props.t('remind')}</button></div></div>
            <div data-custom-fields-slot="case:case-mos" />
          </MobileAccordion></div>

          <div data-section-scope="case" data-section-key="case-doc-updates"><MobileAccordion title={copy.updates} summary={props.docUpdates.length ? `${props.docUpdates.length}` : props.t('no_doc_updates')}>
            {props.docUpdates.length > 0 && <div className={styles.compactList}>{[...props.docUpdates].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item: any) => <div key={item.id}><span><strong>{new Date(item.date).toLocaleDateString(props.locale)}</strong><small>{item.description}</small></span><button type="button" className={styles.iconDanger} onClick={() => props.onRemoveDocUpdate(item.id)}>×</button></div>)}</div>}
            <div className={styles.inlineForm}><input type="date" value={props.newDocDate} onChange={event => props.setNewDocDate(event.target.value)} /><input value={props.newDocDesc} onChange={event => props.setNewDocDesc(event.target.value)} placeholder={props.t('doc_update_placeholder')} /><button type="button" onClick={props.onAddDocUpdate} disabled={!props.newDocDate || !props.newDocDesc.trim()}>{copy.addUpdate}</button></div><div data-custom-fields-slot="case:case-doc-updates" />
          </MobileAccordion></div>

          <div data-section-scope="case" data-section-key="case-notes"><MobileAccordion title={copy.notes} summary={form.notes || props.t('not_specified')}><textarea className={styles.textarea} value={form.notes || ''} onChange={event => props.setField('notes', event.target.value)} rows={5} placeholder={props.t('notes_placeholder')} /><div data-custom-fields-slot="case:case-notes" /></MobileAccordion></div>

          {props.mobileActive && <MobileAccordion title={copy.customSections}>
            <div className={styles.customSections}><CustomSectionsRenderer ref={props.customSectionsRef as RefObject<CustomSectionsHandle>} scope="case" recordId={String(props.id)} standaloneSave={false} /></div>
          </MobileAccordion>}
        </div>
      )}

      {props.tab === 'payments' && <div className={styles.tabContent}>
        <section className={styles.financeRepeat}><h2>{copy.financialSummary}</h2><div><span>{props.t('cost')}<strong>{money(c.totalValue, props.locale)}</strong></span><span>{copy.received}<strong className={styles.green}>{money(c.totalPaid, props.locale)}</strong></span><span>{props.t('case_debt')}<strong className={debt > 0 ? styles.red : styles.green}>{debt > 0 ? money(debt, props.locale) : props.t('paid')}</strong></span></div></section>
        <section className={styles.mobileCard}><h2>{copy.addPayment}</h2><div className={styles.formGrid}><label>{props.t('amount')} (zł)<input type="number" value={props.payAmount} onChange={event => props.setPayAmount(event.target.value)} step="0.01" /></label><label>{props.t('note')}<input value={props.payNote} onChange={event => props.setPayNote(event.target.value)} /></label><label className={styles.checkField}><input type="checkbox" checked={props.paySpecialMethod} onChange={event => props.setPaySpecialMethod(event.target.checked)} />{copy.specialMethod}</label><button type="button" className={styles.primaryWide} onClick={props.onAddPayment} disabled={!props.payAmount}>{copy.addPayment}</button></div></section>
        <MobileAccordion title={copy.paymentPlan} summary={`${props.plannedPayments.length} ${copy.planned.toLowerCase()}`}>
          <div className={styles.planRows}>{props.paymentPlan.map((row: any, index: number) => <div key={index}><input type="number" value={row.amount} onChange={event => props.onUpdatePlanRow(index, 'amount', event.target.value)} placeholder={`${props.t('amount')} (zł)`} /><input type="date" value={row.dueDate} onChange={event => props.onUpdatePlanRow(index, 'dueDate', event.target.value)} /><button type="button" onClick={() => props.setPaymentPlan((rows: any[]) => rows.length === 1 ? rows : rows.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}</div><div className={styles.rowActions}><button type="button" onClick={() => props.setPaymentPlan((rows: any[]) => [...rows, { amount: '', dueDate: '' }])}>+ {props.t('payment')}</button><button type="button" onClick={props.onCreatePaymentPlan} disabled={props.creatingPlan}>{props.t('add_to_calendar')}</button></div>
        </MobileAccordion>
        <section className={styles.mobileCard}><h2>{props.t('planned_payments')}</h2>{props.plannedPayments.length ? <div className={styles.paymentList}>{props.plannedPayments.map((plan: any) => <article key={plan.id}><div><strong>{money(plan.amount, props.locale)}</strong><span className={styles.paymentState}>{copy.planned}</span></div><small>{plan.dueDate ? new Date(plan.dueDate).toLocaleDateString(props.locale) : '—'}</small><p>{plan.note || plan.title}</p><div className={styles.cardActions}><button type="button" onClick={() => props.onConvertPlannedPayment(plan)}>{copy.convertPaid}</button><button type="button" className={styles.dangerText} onClick={() => props.onDeletePlannedPayment(plan.id)}>{copy.delete}</button></div></article>)}</div> : <div className={styles.emptyState}>{copy.noPlanned}</div>}</section>
        <section className={styles.mobileCard}><h2>{props.t('received_payments')}</h2>{(c.payments || []).length ? <div className={styles.paymentList}>{(c.payments || []).map((payment: any) => <article key={payment.id}>{props.editingPayment?.id === payment.id ? <div className={styles.editPayment}><input type="date" value={props.editingPayment.date} onChange={event => props.setEditingPayment((value: any) => ({ ...value, date: event.target.value }))} /><input type="number" value={props.editingPayment.amount} onChange={event => props.setEditingPayment((value: any) => ({ ...value, amount: event.target.value }))} /><input value={props.editingPayment.note} onChange={event => props.setEditingPayment((value: any) => ({ ...value, note: event.target.value }))} /><label className={styles.smallCheck}><input type="checkbox" checked={props.editingPayment.specialMethod === true} onChange={event => props.setEditingPayment((value: any) => ({ ...value, specialMethod: event.target.checked }))} />{copy.specialMethod}</label><div className={styles.cardActions}><button type="button" onClick={props.onSavePaymentEdit}>{copy.save}</button><button type="button" onClick={() => props.setEditingPayment(null)}>{copy.cancel}</button></div></div> : <><div><strong className={styles.green}>+{money(payment.amount, props.locale)}</strong>{payment.specialMethod && <span className={styles.specialBadge}>$</span>}</div><small>{new Date(payment.date).toLocaleDateString(props.locale)}</small><p>{payment.note || '—'}</p><div className={styles.cardActions}><button type="button" onClick={() => props.onStartEditPayment(payment)}>{copy.edit}</button><button type="button" className={styles.dangerText} onClick={() => props.onDeletePayment(payment.id)}>{copy.delete}</button></div></>}</article>)}</div> : <div className={styles.emptyState}>{copy.noPayments}</div>}</section>
      </div>}

      {props.tab === 'comments' && <div className={styles.tabContent}><section className={styles.mobileCard}><h2>{copy.comments}</h2><div className={styles.commentForm}><textarea value={props.comment} onChange={event => props.setComment(event.target.value)} placeholder={props.t('write_comment')} rows={3} /><button type="button" onClick={props.onAddComment} disabled={!props.comment.trim()}>{copy.send}</button></div></section>{(c.comments || []).length ? <div className={styles.commentList}>{(c.comments || []).map((item: any) => <article key={item.id}><header><strong>{item.author}</strong><time>{new Date(item.createdAt).toLocaleString(props.locale)}</time></header><p>{item.text}</p></article>)}</div> : <div className={styles.emptyStateCard}>{copy.noComments}</div>}</div>}

      {props.tab === 'docs' && <div className={styles.tabContent}><section className={styles.mobileCard}><h2>{copy.generate}</h2>{props.documentTemplates.length ? <div className={styles.templateList}>{props.documentTemplates.map((template: any) => <button type="button" key={template.id} onClick={() => props.onGenerateDocument(template)} disabled={props.generatingTemplate === template.id}>{template.name}</button>)}</div> : <div className={styles.emptyState}>{props.t('template_upload_hint')}</div>}</section><section className={styles.mobileCard}><div className={styles.documentsHeader}><div><h2>{copy.documents} · {props.documents.length}</h2><small>{copy.fileHint}</small></div><input ref={mobileFileInput} type="file" accept="application/pdf,image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={async event => { for (const file of Array.from(event.target.files || [])) await props.onUploadFile(file); event.currentTarget.value = '' }} /><button type="button" onClick={() => mobileFileInput.current?.click()} disabled={props.uploading}>{props.uploading ? copy.uploading : copy.upload}</button></div>{props.documents.length ? <div className={styles.documentList}>{props.documents.map((doc: any) => <article key={doc.id}><button type="button" className={styles.documentOpen} onClick={() => props.setPreviewDoc(doc)}><Icon name="file" /><span title={doc.name}><strong>{doc.name}</strong><small>{String(doc.fileType || '').toUpperCase()}</small></span></button><details><summary aria-label={copy.more}>•••</summary><div><button type="button" onClick={() => props.setPreviewDoc(doc)}>{copy.open}</button><button type="button" onClick={() => props.onDownloadFile(doc.url, doc.name)}>{copy.download}</button><button type="button" className={styles.dangerText} onClick={() => props.onDeleteDocument(doc.id)}>{copy.delete}</button></div></details></article>)}</div> : <div className={styles.emptyState}>{copy.noDocuments}</div>}</section></div>}

      {props.previewDoc && <div className={styles.previewBackdrop} role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && props.setPreviewDoc(null)}><div className={styles.previewPanel}><header><strong title={props.previewDoc.name}>{props.previewDoc.name}</strong><button type="button" onClick={() => props.setPreviewDoc(null)} aria-label={copy.close}>×</button></header>{props.previewDoc.fileType === 'image' ? <img src={props.previewDoc.url} alt={props.previewDoc.name} /> : <object data={`${props.previewDoc.url}#toolbar=1&navpanes=0`} type="application/pdf" aria-label={props.previewDoc.name}><a href={props.previewDoc.url} target="_blank" rel="noreferrer">{copy.open}</a></object>}<div className={styles.previewActions}><a href={props.previewDoc.url} target="_blank" rel="noreferrer">{copy.open}</a><button type="button" onClick={() => props.onDownloadFile(props.previewDoc.url, props.previewDoc.name)}>{copy.download}</button></div></div></div>}
    </section>
  )
}
