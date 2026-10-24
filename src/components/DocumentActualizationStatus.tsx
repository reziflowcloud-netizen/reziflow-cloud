'use client'
import ActualizationAssignmentBadge from './ActualizationAssignmentBadge'
const copy = {
  uk: {
    next: 'Наступна актуалізація',
    overdue: 'Актуалізація прострочена',
    stopped: 'Контроль зупинено: децизія отримана',
    noDate: 'Немає дати для актуалізації',
    inactive: 'Автоматичний контроль ще не активовано',
    completed: 'Контроль цього циклу виконано',
  },
  ru: {
    next: 'Следующая актуализация',
    overdue: 'Актуализация просрочена',
    stopped: 'Контроль остановлен: решение получено',
    noDate: 'Нет даты для актуализации',
    inactive: 'Автоматический контроль ещё не активирован',
    completed: 'Контроль этого цикла выполнен',
  },
  pl: {
    next: 'Następna aktualizacja',
    overdue: 'Aktualizacja po terminie',
    stopped: 'Kontrola zatrzymana: decyzja otrzymana',
    noDate: 'Brak daty aktualizacji',
    inactive: 'Automatyczna kontrola nie jest jeszcze aktywna',
    completed: 'Kontrola tego cyklu zakończona',
  },
}
export default function DocumentActualizationStatus({
  value,
  lang,
}: {
  value?: { date: string | null; state: string; requiresAssignment?: boolean }
  lang: string
}) {
  const language = lang === 'ru' || lang === 'pl' ? lang : 'uk',
    text = copy[language]
  const state = value?.state || 'inactive',
    date = value?.date
  const formatted = date
    ? new Date(date + 'T12:00:00Z').toLocaleDateString(
        language === 'uk' ? 'uk-UA' : language === 'pl' ? 'pl-PL' : 'ru-RU',
        { timeZone: 'Europe/Warsaw' },
      )
    : ''
  return (
    <p
      data-document-actualization-state={state}
      style={{
        fontSize: 12,
        margin: '8px 0 12px',
        color: state === 'overdue' ? 'var(--danger)' : 'var(--muted)',
      }}
    >
      {text[state as keyof typeof text] || text.inactive}
      <ActualizationAssignmentBadge required={value?.requiresAssignment} lang={lang} />
      {date && ['next', 'overdue', 'completed'].includes(state) ? ` · ${formatted}` : ''}
    </p>
  )
}
