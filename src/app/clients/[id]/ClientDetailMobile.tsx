'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import CustomSectionsRenderer, { type CustomSectionsHandle } from '@/components/CustomSectionsRenderer'
import PhoneListEditor, { ensurePhoneRows } from '@/components/PhoneListEditor'
import { MobileAccordion } from '@/components/mobile'
import { caseStatusLabel } from '@/lib/caseI18n'
import { clientAccentColor, clientInitials } from '../ClientsMobile'
import styles from './ClientDetailMobile.module.css'

type Language = 'ru' | 'uk' | 'pl'
type DateTone = 'danger' | 'warning' | 'neutral'

const COPY = {
  ru: {
    more: 'Ещё', save: 'Сохранить', saving: 'Сохранение…', newCase: 'Новое дело', delete: 'Удалить клиента',
    client: 'Клиент', summary: 'Кратко о клиенте', citizenship: 'Гражданство', passport: 'Паспорт', stay: 'Пребывание',
    phone: 'Основной телефон', email: 'E-mail', activeCases: 'Активные дела', closedCases: 'Закрытые дела', noActiveCases: 'Активных дел нет',
    personal: 'Личные данные', family: 'Семья / связанные клиенты', addresses: 'Адреса', physical: 'Физические данные',
    residence: 'Карта побыту', fines: 'Штрафы', travel: 'История путешествий', previousStays: 'Предыдущие пребывания в Польше',
    custom: 'Дополнительные разделы', validUntil: 'Действителен до', expired: 'Просрочен', expiresSoon: 'Истекает менее чем через 90 дней',
    rentalUntil: 'Аренда до', residenceUntil: 'Карта побыту до', debt: 'Долг', paid: 'Оплачено', caseFallback: 'Дело', add: 'Добавить', remove: 'Удалить',
    originAddress: 'В стране происхождения', previousAddress: 'В предыдущей стране проживания', relatedClients: 'Связанные клиенты',
    familyDetails: 'Семейные данные', editFamily: 'Изменить состав семьи', done: 'Готово', noFamily: 'Связанные клиенты не выбраны',
    noTravel: 'Записей о путешествиях нет', currentStay: 'Текущее пребывание', statusAndProfile: 'Статус и профиль',
    danger: 'Опасная зона', deleteHint: 'Доступно только администратору или владельцу', firstCard: 'Первая карта пребывания',
    personalFields: 'PESEL · дата рождения · контакты', familyFields: 'гражданство · семейное положение',
  },
  uk: {
    more: 'Ще', save: 'Зберегти', saving: 'Збереження…', newCase: 'Нова справа', delete: 'Видалити клієнта',
    client: 'Клієнт', summary: 'Коротко про клієнта', citizenship: 'Громадянство', passport: 'Паспорт', stay: 'Перебування',
    phone: 'Основний телефон', email: 'E-mail', activeCases: 'Активні справи', closedCases: 'Закриті справи', noActiveCases: 'Активних справ немає',
    personal: 'Особисті дані', family: 'Сім’я / пов’язані клієнти', addresses: 'Адреси', physical: 'Фізичні дані',
    residence: 'Карта побиту', fines: 'Штрафи', travel: 'Історія подорожей', previousStays: 'Попередні перебування в Польщі',
    custom: 'Додаткові розділи', validUntil: 'Дійсний до', expired: 'Прострочений', expiresSoon: 'Закінчується менш ніж за 90 днів',
    rentalUntil: 'Оренда до', residenceUntil: 'Карта побиту до', debt: 'Борг', paid: 'Сплачено', caseFallback: 'Справа', add: 'Додати', remove: 'Видалити',
    originAddress: 'У країні походження', previousAddress: 'У попередній країні проживання', relatedClients: 'Пов’язані клієнти',
    familyDetails: 'Сімейні дані', editFamily: 'Змінити склад сім’ї', done: 'Готово', noFamily: 'Пов’язаних клієнтів не вибрано',
    noTravel: 'Записів про подорожі немає', currentStay: 'Поточне перебування', statusAndProfile: 'Статус і профіль',
    danger: 'Небезпечна зона', deleteHint: 'Доступно лише адміністратору або власнику', firstCard: 'Перша карта перебування',
    personalFields: 'PESEL · дата народження · контакти', familyFields: 'громадянство · сімейний стан',
  },
  pl: {
    more: 'Więcej', save: 'Zapisz', saving: 'Zapisywanie…', newCase: 'Nowa sprawa', delete: 'Usuń klienta',
    client: 'Klient', summary: 'Podsumowanie klienta', citizenship: 'Obywatelstwo', passport: 'Paszport', stay: 'Pobyt',
    phone: 'Główny telefon', email: 'E-mail', activeCases: 'Aktywne sprawy', closedCases: 'Zamknięte sprawy', noActiveCases: 'Brak aktywnych spraw',
    personal: 'Dane osobowe', family: 'Rodzina / powiązani klienci', addresses: 'Adresy', physical: 'Dane fizyczne',
    residence: 'Karta pobytu', fines: 'Mandaty', travel: 'Historia podróży', previousStays: 'Poprzednie pobyty w Polsce',
    custom: 'Dodatkowe sekcje', validUntil: 'Ważny do', expired: 'Nieważny', expiresSoon: 'Wygasa za mniej niż 90 dni',
    rentalUntil: 'Najem do', residenceUntil: 'Karta pobytu do', debt: 'Dług', paid: 'Opłacono', caseFallback: 'Sprawa', add: 'Dodaj', remove: 'Usuń',
    originAddress: 'W kraju pochodzenia', previousAddress: 'W poprzednim kraju pobytu', relatedClients: 'Powiązani klienci',
    familyDetails: 'Dane rodziny', editFamily: 'Zmień skład rodziny', done: 'Gotowe', noFamily: 'Nie wybrano powiązanych klientów',
    noTravel: 'Brak zapisów podróży', currentStay: 'Aktualny pobyt', statusAndProfile: 'Status i profil',
    danger: 'Strefa niebezpieczna', deleteHint: 'Dostępne tylko dla administratora lub właściciela', firstCard: 'Pierwsza karta pobytu',
    personalFields: 'PESEL · data urodzenia · kontakt', familyFields: 'obywatelstwo · stan cywilny',
  },
} as const

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    back: <><path d="m14 5-7 7 7 7" /><path d="M7 12h11" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    person: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    file: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h4" /><path d="M10 13h5M10 17h5" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10M10 21v-7h4v7" /></>,
    family: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 20a5.5 5.5 0 0 1 11 0M13 20a4 4 0 0 1 8 0" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    plane: <><path d="m3 11 18-8-8 18-2-8-8-2Z" /><path d="m11 13 4-4" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    warning: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v5M12 17h.01" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.file}</g></svg>
}

function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) {
  return <label className={full ? styles.fullField : undefined}><span>{label}</span>{children}</label>
}

function dateValue(value: unknown) {
  return String(value || '').slice(0, 10)
}

function dateAtNoon(value: string) {
  return new Date(`${value}T12:00:00`)
}

function formatDate(value: unknown, locale: string) {
  const date = dateValue(value)
  return date ? dateAtNoon(date).toLocaleDateString(locale) : ''
}

function money(value: unknown, locale: string) {
  return `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 2 })} zł`
}

export default function ClientDetailMobile(props: any) {
  const lang: Language = props.lang === 'uk' || props.lang === 'pl' ? props.lang : 'ru'
  const copy = COPY[lang]
  const client = props.client
  const form = props.form
  const name = `${form.firstName || client.firstName || ''} ${form.lastName || client.lastName || ''}`.trim()
  const avatarAccent = clientAccentColor(client)
  const avatarStyle = { '--client-detail-accent': avatarAccent } as CSSProperties
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [hasStandaloneCustomSections, setHasStandaloneCustomSections] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(event: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) setOverflowOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const passportDate = dateValue(form.passportExpiresAt)
  const today = dateAtNoon(new Date().toISOString().slice(0, 10))
  const soon = new Date(today)
  soon.setDate(soon.getDate() + 90)
  function dateTone(value: unknown): DateTone | undefined {
    const date = dateValue(value)
    if (!date) return undefined
    const deadline = dateAtNoon(date)
    if (deadline < today) return 'danger'
    if (deadline <= soon) return 'warning'
    return 'neutral'
  }

  function deadlineSummary(value: unknown, tone: DateTone | undefined) {
    const date = dateValue(value)
    if (!date || !tone) return ''
    const formatted = formatDate(date, props.locale)
    if (tone === 'danger') return `${copy.expired} · ${formatted}`
    if (tone === 'warning') return `${copy.expiresSoon} · ${formatted}`
    return `${copy.validUntil} ${formatted}`
  }

  function coloredSummary(value: string, tone?: DateTone) {
    return value ? <span className={styles.dateSummary} data-tone={tone || 'neutral'}>{value}</span> : undefined
  }

  const passportExpiry = passportDate ? dateAtNoon(passportDate) : null
  const passportTone = dateTone(passportDate)
  const passportSummary = passportExpiry ? deadlineSummary(passportDate, passportTone) : ''
  const rentalDate = dateValue(form.rentalEndDate)
  const rentalTone = dateTone(rentalDate)
  const residenceDate = dateValue(form.residenceCardExpiry)
  const residenceTone = dateTone(residenceDate)
  const staySummary = rentalDate
    ? `${copy.rentalUntil} ${formatDate(rentalDate, props.locale)}`
    : form.stayBasis || form.legalTitle || (residenceDate ? `${copy.residenceUntil} ${formatDate(residenceDate, props.locale)}` : '')
  const stayTone = rentalDate ? rentalTone : !form.stayBasis && !form.legalTitle && residenceDate ? residenceTone : undefined
  const residenceSummary = form.firstResidenceCard
    ? copy.firstCard
    : residenceDate ? deadlineSummary(residenceDate, residenceTone) : ''
  const summaryItems = [
    form.pesel && { icon: 'file', label: 'PESEL', value: form.pesel },
    form.citizenship && { icon: 'globe', label: copy.citizenship, value: form.citizenship },
    passportSummary && { icon: 'file', label: copy.passport, value: passportSummary, tone: passportTone },
    staySummary && { icon: 'calendar', label: copy.stay, value: staySummary, tone: stayTone },
  ].filter(Boolean) as Array<{ icon: string; label: string; value: string; tone?: string }>

  const familyRows = Array.isArray(props.selectedFamilyClients) ? props.selectedFamilyClients : []
  const previousStays = Array.isArray(form.previousPolandStays) ? form.previousPolandStays : []

  function caseRow(caseItem: any, closed = false) {
    const status = props.statuses.find((item: any) => item.name === caseItem.status)
    const statusColor = status?.color || '#64748b'
    const serviceColor = caseItem.service?.color || '#64748b'
    const style = { '--case-status': statusColor, '--case-service': serviceColor } as CSSProperties
    const title = caseItem.service?.name || caseItem.caseNumber || copy.caseFallback
    const debt = Math.max(0, Number(caseItem.totalValue || 0) - Number(caseItem.totalPaid || 0))
    return (
      <Link key={caseItem.id} href={`/cases/${caseItem.id}`} className={`${styles.caseRow} ${closed ? styles.closedCase : ''}`} style={style}>
        <span className={styles.serviceDot} aria-hidden="true" />
        <span className={styles.caseCopy}>
          <strong title={title}>{title}</strong>
          {caseItem.caseNumber && caseItem.caseNumber !== title && <small>{caseItem.caseNumber}</small>}
          {debt > 0 && <em>{copy.debt}: {money(debt, props.locale)}</em>}
        </span>
        <span className={styles.caseStatus} title={caseStatusLabel(lang, caseItem.status)}>{caseStatusLabel(lang, caseItem.status)}</span>
        <span className={styles.caseChevron} aria-hidden="true">›</span>
      </Link>
    )
  }

  return (
    <section className={styles.mobileOnly} data-mobile-client-detail aria-label={copy.client}>
      <header className={styles.header}>
        <button type="button" className={styles.circleButton} aria-label="Back" onClick={props.onBack}><Icon name="back" /></button>
        <div className={styles.avatar} style={avatarStyle}>{clientInitials(client)}</div>
        <div className={styles.identity}>
          <h1 title={name}>{name}</h1>
          <div className={styles.contactLine}>
            {(form.phone || client.phone) && <a href={`tel:${form.phone || client.phone}`}>{form.phone || client.phone}</a>}
            {(form.phone || client.phone) && form.email && <span>·</span>}
            {form.email && <a href={`mailto:${form.email}`}>{form.email}</a>}
          </div>
        </div>
        {props.canDeleteClient && (
          <div className={styles.overflowWrap} ref={overflowRef}>
            <button type="button" className={styles.circleButton} aria-label={copy.more} aria-expanded={overflowOpen} onClick={() => setOverflowOpen((value: boolean) => !value)}><Icon name="more" /></button>
            {overflowOpen && <div className={styles.overflowMenu}><button type="button" className={styles.dangerAction} onClick={props.onDeleteClient}>{copy.delete}</button></div>}
          </div>
        )}
      </header>

      <div className={styles.primaryActions}>
        <button type="button" className={styles.saveButton} onClick={props.onSave} disabled={props.saving}><Icon name="check" />{props.saving ? copy.saving : copy.save}</button>
        <Link href={`/cases/new?clientId=${props.id}`} className={styles.newCaseButton}><Icon name="plus" />{copy.newCase}</Link>
      </div>

      {summaryItems.length > 0 && (
        <section className={styles.summaryCard} aria-label={copy.summary}>
          <h2><Icon name="person" />{copy.client}</h2>
          <div className={styles.summaryGrid}>
            {summaryItems.map(item => (
              <div key={item.label} className={styles.summaryItem} data-tone={item.tone || 'neutral'}>
                <span className={styles.summaryIcon}><Icon name={item.icon} /></span>
                <span><small>{item.label}</small><strong>{item.value}</strong></span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.casesCard}>
        <h2><Icon name="file" />{copy.activeCases} <span>· {props.activeCases.length}</span></h2>
        {props.activeCases.length > 0 ? <div className={styles.caseList}>{props.activeCases.map((item: any) => caseRow(item))}</div> : <div className={styles.emptyState}>{copy.noActiveCases}</div>}
      </section>

      <div className={styles.sections}>
        <div data-section-scope="client" data-section-key="client-personal">
          <MobileAccordion title={copy.personal} summary={copy.personalFields} defaultOpen>
            <div className={styles.formGrid}>
              <Field label={props.text.firstName}><input value={form.firstName || ''} onChange={event => props.setField('firstName', event.target.value)} /></Field>
              <Field label={props.text.lastName}><input value={form.lastName || ''} onChange={event => props.setField('lastName', event.target.value)} /></Field>
              <Field label={props.text.previousFirstName}><input value={form.previousFirstName || ''} onChange={event => props.setField('previousFirstName', event.target.value)} /></Field>
              <Field label={props.text.previousLastName}><input value={form.previousLastName || ''} onChange={event => props.setField('previousLastName', event.target.value)} /></Field>
              <Field label={props.text.maidenName}><input value={form.maidenName || ''} onChange={event => props.setField('maidenName', event.target.value)} /></Field>
              <Field label={props.text.birthDate}><input type="date" value={form.birthDate || ''} onChange={event => props.setField('birthDate', event.target.value)} /></Field>
              <Field label={props.text.birthPlace}><input value={form.birthPlace || ''} onChange={event => props.setField('birthPlace', event.target.value)} /></Field>
              <Field label="PESEL"><input value={form.pesel || ''} onChange={event => props.setField('pesel', event.target.value)} inputMode="numeric" /></Field>
              <Field label={`${props.text.gender} (Płeć)`}><select value={form.gender || ''} onChange={event => props.setField('gender', event.target.value)}><option value="">—</option>{props.genders.map((item: string) => <option key={item}>{item}</option>)}</select></Field>
              <Field label={props.text.phone} full><PhoneListEditor phones={form.phones || ensurePhoneRows([], form.phone || '')} onChange={phones => { const primary = phones.find((item: any) => item.isPrimary)?.phone || phones[0]?.phone || ''; props.setForm((current: any) => ({ ...current, phones, phone: primary })) }} /></Field>
              <Field label="E-mail" full><input type="email" value={form.email || ''} onChange={event => props.setField('email', event.target.value)} /></Field>
            </div>
            <div data-custom-fields-slot="client:client-personal" />
          </MobileAccordion>
        </div>

        <div data-section-scope="client" data-section-key="client-passport">
          <MobileAccordion title={props.text.passportTitle} summary={coloredSummary(passportSummary, passportTone)}>
            <div className={styles.formGrid}>
              <Field label={props.text.passportSeries}><input value={form.passportSeries || ''} onChange={event => props.setField('passportSeries', event.target.value)} /></Field>
              <Field label={props.text.passportIssuedBy}><input value={form.passportIssuedBy || ''} onChange={event => props.setField('passportIssuedBy', event.target.value)} /></Field>
              <Field label={props.text.passportIssuedAt}><input type="date" value={form.passportIssuedAt || ''} onChange={event => props.setField('passportIssuedAt', event.target.value)} /></Field>
              <Field label={props.text.passportExpiresAt}><input type="date" value={form.passportExpiresAt || ''} onChange={event => props.setField('passportExpiresAt', event.target.value)} /></Field>
            </div>
            {passportSummary && <div className={styles.semanticNotice} data-tone={passportTone}><Icon name={passportTone === 'neutral' ? 'check' : 'warning'} />{passportSummary}</div>}
            <div data-custom-fields-slot="client:client-passport" />
          </MobileAccordion>
        </div>

        <div data-section-scope="client" data-section-key="client-poland-stay">
          <MobileAccordion title={props.text.polandStayTitle} summary={rentalDate ? coloredSummary(staySummary, rentalTone) : staySummary}>
            <div className={styles.formGrid}>
              <Field label={props.text.addressInPoland} full><textarea rows={2} value={form.addressInPoland || ''} onChange={event => props.setField('addressInPoland', event.target.value)} /></Field>
              <Field label={props.text.legalTitle}><select value={form.legalTitle || ''} onChange={event => { props.setField('legalTitle', event.target.value); if (!['Najem', 'Wynajem'].some(value => event.target.value.includes(value))) props.setField('rentalEndDate', '') }}><option value="">—</option>{props.legalTitleOptions.map((item: string) => <option key={item}>{item}</option>)}</select></Field>
              {['Najem', 'Wynajem'].some(value => form.legalTitle?.includes(value)) && <Field label={props.text.rentalEndDate}><input type="date" value={form.rentalEndDate || ''} onChange={event => props.setField('rentalEndDate', event.target.value)} /></Field>}
              <Field label={props.text.stayBasis}><select value={form.stayBasis || ''} onChange={event => props.setField('stayBasis', event.target.value)}><option value="">—</option>{props.stayBasisOptions.map((item: string) => <option key={item}>{item}</option>)}</select></Field>
              <Field label={props.text.lastEntryDate}><input type="date" value={form.lastEntryDate || ''} onChange={event => props.setField('lastEntryDate', event.target.value)} /></Field>
            </div>
            {rentalDate && <div className={styles.semanticNotice} data-tone={rentalTone}><Icon name="calendar" />{copy.rentalUntil} {formatDate(rentalDate, props.locale)}</div>}
            <div data-custom-fields-slot="client:client-poland-stay" />
          </MobileAccordion>
        </div>

        <div data-section-scope="client" data-section-key="client-poland-stay">
          <MobileAccordion title={copy.residence} summary={form.firstResidenceCard ? residenceSummary : coloredSummary(residenceSummary, residenceTone)}>
            <label className={styles.checkCard}><input type="checkbox" checked={!!form.firstResidenceCard} onChange={() => { props.setField('firstResidenceCard', !form.firstResidenceCard); if (!form.firstResidenceCard) props.setField('residenceCardExpiry', '') }} /><span>{props.text.firstResidenceCard}</span></label>
            {!form.firstResidenceCard && <div className={styles.formGrid}><Field label={props.text.residenceCardExpiry} full><input type="date" value={form.residenceCardExpiry || ''} onChange={event => props.setField('residenceCardExpiry', event.target.value)} /></Field></div>}
            {!form.firstResidenceCard && residenceSummary && <div className={styles.semanticNotice} data-tone={residenceTone}><Icon name={residenceTone === 'neutral' ? 'check' : 'warning'} />{residenceSummary}</div>}
          </MobileAccordion>
        </div>

        <div data-section-scope="client" data-section-key="client-status-family">
          <MobileAccordion title={copy.family} summary={familyRows.length ? `${copy.relatedClients}: ${familyRows.length}` : copy.familyFields}>
            <h3 className={styles.subheading}>{copy.statusAndProfile}</h3>
            <div className={styles.formGrid}>
              <Field label={props.text.citizenship}><select value={form.citizenship || ''} onChange={event => props.setField('citizenship', event.target.value)}><option value="">—</option>{props.countries.map((item: string) => <option key={item}>{item}</option>)}</select></Field>
              <Field label={props.text.nationality}><select value={form.nationality || ''} onChange={event => props.setField('nationality', event.target.value)}><option value="">—</option>{props.countries.map((item: string) => <option key={item}>{item}</option>)}</select></Field>
              <Field label={props.text.maritalStatus}><select value={form.maritalStatus || ''} onChange={event => props.setField('maritalStatus', event.target.value)}><option value="">—</option>{props.maritalStatuses.map((item: string) => <option key={item}>{item}</option>)}</select></Field>
              <Field label={props.text.education}><select value={form.education || ''} onChange={event => props.setField('education', event.target.value)}><option value="">—</option>{props.educationOptions.map((item: string) => <option key={item}>{item}</option>)}</select></Field>
              <Field label={props.text.profession} full><select value={form.profession || ''} onChange={event => props.setField('profession', event.target.value)}><option value="">—</option>{props.professionOptions.map((item: string) => <option key={item}>{item}</option>)}</select></Field>
              <label className={`${styles.checkCard} ${styles.fullField}`}><input type="checkbox" checked={!!form.statusUKR} onChange={() => props.setField('statusUKR', !form.statusUKR)} /><span>Status UKR<small>{props.text.statusUkrHint}</small></span></label>
            </div>
            <h3 className={styles.subheading}>{copy.familyDetails}</h3>
            <div className={styles.formGrid}>
              <Field label={props.text.fatherName}><input value={form.fatherName || ''} onChange={event => props.setField('fatherName', event.target.value)} /></Field>
              <Field label={props.text.motherName}><input value={form.motherName || ''} onChange={event => props.setField('motherName', event.target.value)} /></Field>
              <Field label={props.text.motherMaidenName} full><input value={form.motherMaidenName || ''} onChange={event => props.setField('motherMaidenName', event.target.value)} /></Field>
              <Field label={props.text.dependents} full><textarea rows={2} value={form.dependents || ''} onChange={event => props.setField('dependents', event.target.value)} /></Field>
            </div>
            <h3 className={styles.subheading}>{copy.relatedClients}</h3>
            {familyRows.length > 0 ? <div className={styles.relatedList}>{familyRows.map((item: any) => <Link key={item.id} href={`/clients/${item.id}`}><span className={styles.smallAvatar}>{clientInitials(item)}</span><span><strong>{item.firstName} {item.lastName}</strong><small>{item.phone || item.email || ''}</small></span><b>›</b></Link>)}</div> : <div className={styles.emptyState}>{copy.noFamily}</div>}
            <label className={styles.checkCard}><input type="checkbox" checked={!!form.hasFamilyClients} onChange={event => { props.setField('hasFamilyClients', event.target.checked); props.setShowFamilyPicker(event.target.checked); if (!event.target.checked) props.setField('familyClientIds', []) }} /><span>{props.text.familyCheckbox}</span></label>
            {form.hasFamilyClients && <div className={styles.familyPicker}>
              {!props.showFamilyPicker && <button type="button" onClick={() => props.setShowFamilyPicker(true)}>{copy.editFamily}</button>}
              {props.showFamilyPicker && <><input value={props.familySearch} onChange={event => props.setFamilySearch(event.target.value)} placeholder={props.text.familySearch} /><div className={styles.familyOptions}>{props.filteredFamilyClients.map((item: any) => <label key={item.id}><input type="checkbox" checked={props.familySelectedIds.includes(item.id)} onChange={() => props.toggleFamilyClient(item.id)} /><span>{item.firstName} {item.lastName}<small>{item.phone || item.email || ''}</small></span></label>)}</div><button type="button" onClick={() => props.setShowFamilyPicker(false)}>{copy.done}</button></>}
            </div>}
            <div data-custom-fields-slot="client:client-status-family" />
          </MobileAccordion>
        </div>

        <MobileAccordion title={copy.addresses} summary={[form.originCountryAddress, form.previousResidenceAddress].filter(Boolean).length ? `${[form.originCountryAddress, form.previousResidenceAddress].filter(Boolean).length}` : undefined}>
          <div className={styles.stackFields}>
            <div data-section-scope="client" data-section-key="client-origin-address"><Field label={copy.originAddress}><textarea rows={3} value={form.originCountryAddress || ''} onChange={event => props.setField('originCountryAddress', event.target.value)} /></Field><div data-custom-fields-slot="client:client-origin-address" /></div>
            <div data-section-scope="client" data-section-key="client-previous-residence-address"><Field label={copy.previousAddress}><textarea rows={3} value={form.previousResidenceAddress || ''} onChange={event => props.setField('previousResidenceAddress', event.target.value)} /></Field><div data-custom-fields-slot="client:client-previous-residence-address" /></div>
          </div>
        </MobileAccordion>

        <div data-section-scope="client" data-section-key="client-physical">
          <MobileAccordion title={props.text.physicalTitle} summary={[form.height && `${form.height} cm`, form.eyeColor].filter(Boolean).join(' · ')}>
            <div className={styles.formGrid}>
              <Field label={props.text.height}><input type="number" value={form.height || ''} onChange={event => props.setField('height', event.target.value)} /></Field>
              <Field label={props.text.eyeColor}><select value={form.eyeColor || ''} onChange={event => props.setField('eyeColor', event.target.value)}><option value="">—</option>{props.eyeColors.map((item: string) => <option key={item}>{item}</option>)}</select></Field>
              <Field label={props.text.specialSigns} full><textarea rows={3} value={form.specialSigns || ''} onChange={event => props.setField('specialSigns', event.target.value)} /></Field>
            </div>
            <div data-custom-fields-slot="client:client-physical" />
          </MobileAccordion>
        </div>

        <div data-section-scope="client" data-section-key="client-poland-stay">
          <MobileAccordion title={copy.fines} summary={form.finesInPoland ? props.text.finesInPoland : undefined}>
            <label className={styles.checkCard}><input type="checkbox" checked={!!form.finesInPoland} onChange={() => props.setField('finesInPoland', !form.finesInPoland)} /><span>{props.text.finesInPoland}</span></label>
            {form.finesInPoland && <textarea className={styles.singleTextarea} rows={3} value={form.finesDescription || ''} onChange={event => props.setField('finesDescription', event.target.value)} placeholder={props.text.finesDescription} />}
          </MobileAccordion>
        </div>

        <div data-section-scope="client" data-section-key="client-travel-history">
          <MobileAccordion title={copy.travel} summary={props.travelHistory.length ? `${props.travelHistory.length}` : undefined}>
            {props.travelHistory.length > 0 ? <div className={styles.travelList}>{props.travelHistory.map((item: any) => <div key={item.id}><span className={styles.rowIcon}><Icon name="plane" /></span><span><strong>{item.country}</strong><small>{[item.entryDate && `${props.text.entry}: ${formatDate(item.entryDate, props.locale)}`, item.exitDate && `${props.text.exit}: ${formatDate(item.exitDate, props.locale)}`].filter(Boolean).join(' → ')}</small></span><button type="button" aria-label={copy.remove} onClick={() => props.onRemoveTravel(item.id)}>×</button></div>)}</div> : <div className={styles.emptyState}>{copy.noTravel}</div>}
            {props.showAddTravel ? <div className={styles.formGrid}><Field label={props.text.country} full><input value={props.newTravel.country} onChange={event => props.setNewTravel((current: any) => ({ ...current, country: event.target.value }))} /></Field><Field label={props.text.entryDate}><input type="date" value={props.newTravel.entryDate} onChange={event => props.setNewTravel((current: any) => ({ ...current, entryDate: event.target.value }))} /></Field><Field label={props.text.exitDate}><input type="date" value={props.newTravel.exitDate} onChange={event => props.setNewTravel((current: any) => ({ ...current, exitDate: event.target.value }))} /></Field><div className={`${styles.rowActions} ${styles.fullField}`}><button type="button" onClick={() => props.setShowAddTravel(false)}>{props.text.cancel}</button><button type="button" onClick={props.onAddTravel} disabled={!props.newTravel.country.trim()}>{copy.add}</button></div></div> : <button type="button" className={styles.secondaryWide} onClick={() => props.setShowAddTravel(true)}>+ {copy.add}</button>}
            <div data-custom-fields-slot="client:client-travel-history" />
          </MobileAccordion>
        </div>

        <div data-section-scope="client" data-section-key="client-previous-poland-stays">
          <MobileAccordion title={copy.previousStays} summary={previousStays.filter((item: any) => item.entryDate || item.exitDate || item.basis).length ? `${previousStays.filter((item: any) => item.entryDate || item.exitDate || item.basis).length}` : undefined}>
            <div className={styles.previousStayList}>{previousStays.map((stay: any, index: number) => <div key={index} className={styles.previousStayCard}><div className={styles.formGrid}><Field label={props.text.previousPolandEntryDate}><input type="date" value={stay.entryDate || ''} onChange={event => props.onUpdatePreviousPolandStay(index, 'entryDate', event.target.value)} /></Field><Field label={props.text.previousPolandExitDate}><input type="date" value={stay.exitDate || ''} onChange={event => props.onUpdatePreviousPolandStay(index, 'exitDate', event.target.value)} /></Field><Field label={props.text.previousPolandBasis} full><select value={stay.basis || ''} onChange={event => props.onUpdatePreviousPolandStay(index, 'basis', event.target.value)}><option value="">—</option>{props.previousPolandBasisOptions.map((item: string) => <option key={item}>{item}</option>)}</select></Field></div><button type="button" className={styles.removeRow} onClick={() => props.onRemovePreviousPolandStay(index)}>{copy.remove}</button></div>)}</div>
            <button type="button" className={styles.secondaryWide} onClick={props.onAddPreviousPolandStay}>+ {copy.add}</button>
            <div data-custom-fields-slot="client:client-previous-poland-stays" />
          </MobileAccordion>
        </div>

        <div className={hasStandaloneCustomSections ? undefined : styles.hiddenCustomSections}>
          <MobileAccordion title={copy.custom}>
            <div className={styles.customSections}><CustomSectionsRenderer ref={props.customSectionsRef as RefObject<CustomSectionsHandle>} scope="client" recordId={String(props.id)} standaloneSave={false} onStandalonePresenceChange={setHasStandaloneCustomSections} /></div>
          </MobileAccordion>
        </div>

        {props.closedCases.length > 0 && <MobileAccordion title={`${copy.closedCases} · ${props.closedCases.length}`}><div className={styles.caseList}>{props.closedCases.map((item: any) => caseRow(item, true))}</div></MobileAccordion>}
      </div>
    </section>
  )
}
