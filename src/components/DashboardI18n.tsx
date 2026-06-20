'use client'

import { useLanguage } from '@/context/LanguageContext'
import type { Lang } from '@/lib/translations'

const LOCALES: Record<Lang, string> = {
  ru: 'ru-RU',
  uk: 'uk-UA',
  pl: 'pl-PL',
}

const DASHBOARD_TEXT: Record<Lang, Record<string, string>> = {
  ru: {
    back: 'Назад',
    months: 'Месяцы',
    month: 'месяц',
    date: 'Дата',
    client: 'Клиент',
    case: 'Дело',
    status: 'Статус',
    service: 'Услуга',
    cost: 'Стоимость',
    amount: 'Сумма',
    note: 'Заметка',
    phone: 'Телефон',
    paid: 'Оплачено',
    debt: 'Долг',
    open: 'Открыть',
    city: 'Город',
    cases_short: 'Дел',
    income_title: 'Полученные деньги',
    income_subtitle: 'Доходы по месяцам и детализация платежей',
    selected_month: 'Выбранный месяц',
    received: 'Получено',
    payments_for_month: 'Платежи за месяц',
    no_payments_month: 'В этом месяце платежей нет',
    debt_title: 'Задолженность',
    debt_subtitle: 'Клиенты и дела с неоплаченным остатком',
    total_debt: 'Всего долг',
    clients_with_debt: 'Клиентов с долгом',
    who_owes_money: 'Кто должен деньги',
    no_debts: 'Задолженностей нет',
    no_service: 'Без услуги',
    case_number_missing: 'Номер не указан',
    new_cases_subtitle: 'Дела, созданные в выбранном месяце',
    created_cases_for: 'Создано дел за',
    cases_for_month: 'Дела за месяц',
    no_new_cases_month: 'В этом месяце новых дел нет',
    client_not_found: 'Клиент не найден',
    new_clients_subtitle: 'Клиенты, добавленные в выбранном месяце',
    added_clients_for: 'Добавлено клиентов за',
    clients_for_month: 'Клиенты за месяц',
    no_new_clients_month: 'В этом месяце новых клиентов нет',
  },
  uk: {
    back: 'Назад',
    months: 'Місяці',
    month: 'місяць',
    date: 'Дата',
    client: 'Клієнт',
    case: 'Справа',
    status: 'Статус',
    service: 'Послуга',
    cost: 'Вартість',
    amount: 'Сума',
    note: 'Примітка',
    phone: 'Телефон',
    paid: 'Оплачено',
    debt: 'Борг',
    open: 'Відкрити',
    city: 'Місто',
    cases_short: 'Справ',
    income_title: 'Отримані гроші',
    income_subtitle: 'Доходи за місяцями та деталізація платежів',
    selected_month: 'Вибраний місяць',
    received: 'Отримано',
    payments_for_month: 'Платежі за місяць',
    no_payments_month: 'У цьому місяці платежів немає',
    debt_title: 'Заборгованість',
    debt_subtitle: 'Клієнти та справи з неоплаченим залишком',
    total_debt: 'Загальний борг',
    clients_with_debt: 'Клієнтів із боргом',
    who_owes_money: 'Хто винен гроші',
    no_debts: 'Заборгованостей немає',
    no_service: 'Без послуги',
    case_number_missing: 'Номер не вказано',
    new_cases_subtitle: 'Справи, створені у вибраному місяці',
    created_cases_for: 'Створено справ за',
    cases_for_month: 'Справи за місяць',
    no_new_cases_month: 'У цьому місяці нових справ немає',
    client_not_found: 'Клієнта не знайдено',
    new_clients_subtitle: 'Клієнти, додані у вибраному місяці',
    added_clients_for: 'Додано клієнтів за',
    clients_for_month: 'Клієнти за місяць',
    no_new_clients_month: 'У цьому місяці нових клієнтів немає',
  },
  pl: {
    back: 'Wstecz',
    months: 'Miesiące',
    month: 'miesiąc',
    date: 'Data',
    client: 'Klient',
    case: 'Sprawa',
    status: 'Status',
    service: 'Usługa',
    cost: 'Koszt',
    amount: 'Kwota',
    note: 'Notatka',
    phone: 'Telefon',
    paid: 'Opłacono',
    debt: 'Dług',
    open: 'Otwórz',
    city: 'Miasto',
    cases_short: 'Spraw',
    income_title: 'Otrzymane pieniądze',
    income_subtitle: 'Dochody według miesięcy i szczegóły płatności',
    selected_month: 'Wybrany miesiąc',
    received: 'Otrzymano',
    payments_for_month: 'Płatności za miesiąc',
    no_payments_month: 'W tym miesiącu nie ma płatności',
    debt_title: 'Zaległości',
    debt_subtitle: 'Klienci i sprawy z nieopłaconym saldem',
    total_debt: 'Łączny dług',
    clients_with_debt: 'Klientów z długiem',
    who_owes_money: 'Kto zalega z płatnością',
    no_debts: 'Brak zaległości',
    no_service: 'Bez usługi',
    case_number_missing: 'Numer nie podany',
    new_cases_subtitle: 'Sprawy utworzone w wybranym miesiącu',
    created_cases_for: 'Utworzono spraw za',
    cases_for_month: 'Sprawy za miesiąc',
    no_new_cases_month: 'W tym miesiącu nie ma nowych spraw',
    client_not_found: 'Klient nie znaleziony',
    new_clients_subtitle: 'Klienci dodani w wybranym miesiącu',
    added_clients_for: 'Dodano klientów za',
    clients_for_month: 'Klienci za miesiąc',
    no_new_clients_month: 'W tym miesiącu nie ma nowych klientów',
  },
}

export function DashboardText({ k }: { k: string }) {
  const { lang, t } = useLanguage()
  return <>{DASHBOARD_TEXT[lang]?.[k] || t(k) || DASHBOARD_TEXT.ru[k] || k}</>
}

export function LocalizedMonthLabel({
  monthKey,
  variant = 'long',
}: {
  monthKey?: string | null
  variant?: 'long' | 'short'
}) {
  const { lang } = useLanguage()

  if (!monthKey) return <>-</>

  const [yearText, monthText] = monthKey.split('-')
  const year = Number(yearText)
  const month = Number(monthText)

  if (!year || !month || month < 1 || month > 12) return <>-</>

  const date = new Date(Date.UTC(year, month - 1, 1))

  return (
    <>
      {date.toLocaleDateString(LOCALES[lang] || LOCALES.ru, {
        month: variant,
        year: variant === 'long' ? 'numeric' : '2-digit',
        timeZone: 'UTC',
      })}
    </>
  )
}

export function LocalizedDate({ value }: { value?: Date | string | number | null }) {
  const { lang } = useLanguage()
  if (!value) return <>-</>

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return <>-</>

  return <>{date.toLocaleDateString(LOCALES[lang] || LOCALES.ru, { timeZone: 'UTC' })}</>
}
