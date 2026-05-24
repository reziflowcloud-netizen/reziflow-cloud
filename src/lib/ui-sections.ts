export type UiSectionScope = 'client' | 'case'

export type UiSectionDefinition = {
  scope: UiSectionScope
  sectionKey: string
  title: string
  description: string
  sortOrder: number
}

const clientSections: UiSectionDefinition[] = [
  { scope: 'client', sectionKey: 'client-personal', title: 'Данные личные', description: 'Основная информация о клиенте', sortOrder: 10 },
  { scope: 'client', sectionKey: 'client-status-family', title: 'Статус и семья', description: 'Гражданство, семейное положение и данные семьи', sortOrder: 20 },
  { scope: 'client', sectionKey: 'client-passport', title: 'Паспортные данные', description: 'Серия, номер и срок действия паспорта', sortOrder: 30 },
  { scope: 'client', sectionKey: 'client-physical', title: 'Физические признаки', description: 'Рост, цвет глаз и особые приметы', sortOrder: 40 },
  { scope: 'client', sectionKey: 'client-origin-address', title: 'Адрес в стране происхождения', description: 'Адрес проживания до переезда', sortOrder: 50 },
  { scope: 'client', sectionKey: 'client-previous-residence-address', title: 'Адрес предыдущего проживания', description: 'При проживании 365 дней и больше', sortOrder: 60 },
  { scope: 'client', sectionKey: 'client-poland-stay', title: 'Пребывание в Польше', description: 'Адрес, основание пребывания и карта побыта', sortOrder: 70 },
  { scope: 'client', sectionKey: 'client-travel-history', title: 'История путешествий', description: 'Выезды за границу и пребывание', sortOrder: 80 },
  { scope: 'client', sectionKey: 'client-previous-poland-stays', title: 'Предыдущие пребывания в Польше', description: 'Дата въезда, выезда и основание пребывания', sortOrder: 90 },
]

const caseSections: UiSectionDefinition[] = [
  { scope: 'case', sectionKey: 'case-basic', title: 'Основные данные', description: 'Статус, услуга, стоимость и ответственные', sortOrder: 10 },
  { scope: 'case', sectionKey: 'case-main-goal', title: 'Главная цель пребывания', description: 'Тип и основание пребывания', sortOrder: 20 },
  { scope: 'case', sectionKey: 'case-work-contract', title: 'Договор с работодателем', description: 'Данные договора с работодателем', sortOrder: 30 },
  { scope: 'case', sectionKey: 'case-agency-contract', title: 'Договор с нашим агентством', description: 'Тип, номер, дата и подпись договора', sortOrder: 40 },
  { scope: 'case', sectionKey: 'case-mos', title: 'MOS и корреспонденция', description: 'MOS, ID, документы и напоминания', sortOrder: 50 },
  { scope: 'case', sectionKey: 'case-important-dates', title: 'Важные даты', description: 'Подача, явка и дополнительные даты', sortOrder: 60 },
  { scope: 'case', sectionKey: 'case-doc-updates', title: 'Актуализация документации', description: 'История обновления документов', sortOrder: 70 },
  { scope: 'case', sectionKey: 'case-notes', title: 'Заметки', description: 'Дополнительная информация по делу', sortOrder: 80 },
]

export const uiSectionDefinitions = [...clientSections, ...caseSections]

export function getUiSectionDefinitions(scope?: string | null) {
  if (!scope) return uiSectionDefinitions
  return uiSectionDefinitions.filter(section => section.scope === scope)
}
