import type { Lang } from '@/lib/translations'

const CASE_STATUS_TRANSLATIONS: Record<Lang, Record<string, string>> = {
  ru: {
    'Новый': 'Новый',
    'В работе': 'В работе',
    'Ожидание документов': 'Ожидание документов',
    'Решение получено': 'Решение получено',
    'Архив': 'Архив',
    'Отказ': 'Отказ',
  },
  uk: {
    'Новый': 'Новий',
    'В работе': 'У роботі',
    'Ожидание документов': 'Очікування документів',
    'Решение получено': 'Рішення отримано',
    'Архив': 'Архів',
    'Отказ': 'Відмова',
  },
  pl: {
    'Новый': 'Nowa',
    'В работе': 'W toku',
    'Ожидание документов': 'Oczekiwanie na dokumenty',
    'Решение получено': 'Decyzja otrzymana',
    'Архив': 'Archiwum',
    'Отказ': 'Odmowa',
  },
}

export function caseStatusLabel(lang: Lang, name?: string | null) {
  const value = String(name || '')
  return CASE_STATUS_TRANSLATIONS[lang]?.[value] || CASE_STATUS_TRANSLATIONS.ru[value] || value
}

export function isArchiveCaseStatus(name?: string | null) {
  const value = String(name || '').trim().toLowerCase()
  return value.includes('архив')
    || value.includes('архів')
    || value.includes('archive')
    || value.includes('archiw')
}
