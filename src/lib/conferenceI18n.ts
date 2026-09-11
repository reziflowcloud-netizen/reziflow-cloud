import type { MarketingLang } from '@/lib/marketingI18n'

type Benefit = { title: string; text: string }

export type ConferenceCopy = {
  meta: { title: string; description: string }
  hero: {
    eyebrow: string
    title: string
    accent: string
    text: string
    demo: string
    register: string
    imageAlt: string
  }
  benefits: Benefit[]
  note: string
  demoUnavailable: string
  demoBar: { title: string; text: string; register: string; login: string }
}

const uk: ConferenceCopy = {
  meta: {
    title: 'LegalHub CRM — уся робота агенції в одній CRM',
    description: 'CRM для компаній з легалізації в Польщі.',
  },
  hero: {
    eyebrow: 'CRM для компаній з легалізації в Польщі',
    title: 'Уся робота агенції —',
    accent: 'в одній CRM',
    text: 'Заявки, клієнти, справи, документи, строки, оплати й команда — в одній системі.',
    demo: 'Відкрити демо',
    register: 'Спробувати безкоштовно',
    imageAlt: 'Справжній Dashboard LegalHub CRM з тестовими даними',
  },
  benefits: [
    {
      title: 'Заявки та справи\nв одному місці',
      text: 'Усі клієнти, справи та етапи\nзавжди під рукою.',
    },
    {
      title: 'Строки, задачі та\nвідповідальні під контролем',
      text: 'Нічого не забувається, кожна дія\nприв’язана до конкретної людини.',
    },
    {
      title: 'Документи й оплати\nв контексті справи',
      text: 'Усі документи, платежі та історія\nв одному місці.',
    },
  ],
  note: 'Відкрийте готову CRM з тестовими даними та подивіться, як усе працює вже зараз.',
  demoUnavailable: 'Демо тимчасово недоступне. Спробуйте ще раз пізніше або створіть власну організацію.',
  demoBar: {
    title: 'Ви у спільному інтерактивному demo',
    text: 'Можна змінювати тестові дані. Технічні налаштування та дані доступу захищені.',
    register: 'Створити свою організацію',
    login: 'Увійти у свій акаунт',
  },
}

const pl: ConferenceCopy = {
  meta: {
    title: 'LegalHub CRM — cała praca agencji w jednym CRM',
    description: 'CRM dla firm legalizacyjnych w Polsce.',
  },
  hero: {
    eyebrow: 'CRM dla firm legalizacyjnych w Polsce',
    title: 'Cała praca agencji —',
    accent: 'w jednym CRM',
    text: 'Leady, klienci, sprawy, dokumenty, terminy, płatności i zespół — w jednym systemie.',
    demo: 'Otwórz demo',
    register: 'Wypróbuj bezpłatnie',
    imageAlt: 'Prawdziwy Dashboard LegalHub CRM z danymi testowymi',
  },
  benefits: [
    { title: 'Leady i sprawy\nw jednym miejscu', text: 'Wszyscy klienci, sprawy i etapy\nsą zawsze pod ręką.' },
    { title: 'Terminy, zadania i\nodpowiedzialni pod kontrolą', text: 'Nic nie zostaje pominięte, a każde działanie\nma przypisaną konkretną osobę.' },
    { title: 'Dokumenty i płatności\nw kontekście sprawy', text: 'Wszystkie dokumenty, płatności i historia\nw jednym miejscu.' },
  ],
  note: 'Otwórz gotowy CRM z danymi testowymi i zobacz już teraz, jak wszystko działa.',
  demoUnavailable: 'Demo jest chwilowo niedostępne. Spróbuj ponownie później albo utwórz własną organizację.',
  demoBar: {
    title: 'Korzystasz ze wspólnego interaktywnego demo',
    text: 'Możesz zmieniać dane testowe. Ustawienia techniczne i dane dostępowe są chronione.',
    register: 'Utwórz swoją organizację',
    login: 'Zaloguj się na swoje konto',
  },
}

const ru: ConferenceCopy = {
  meta: {
    title: 'LegalHub CRM — вся работа агентства в одной CRM',
    description: 'CRM для компаний по легализации в Польше.',
  },
  hero: {
    eyebrow: 'CRM для компаний по легализации в Польше',
    title: 'Вся работа агентства —',
    accent: 'в одной CRM',
    text: 'Лиды, клиенты, дела, документы, сроки, оплаты и команда — в одной системе.',
    demo: 'Открыть демо',
    register: 'Попробовать бесплатно',
    imageAlt: 'Настоящий Dashboard LegalHub CRM с тестовыми данными',
  },
  benefits: [
    { title: 'Лиды и дела\nв одном месте', text: 'Все клиенты, дела и этапы\nвсегда под рукой.' },
    { title: 'Сроки, задачи и\nответственные под контролем', text: 'Ничего не забывается, каждое действие\nпривязано к конкретному человеку.' },
    { title: 'Документы и оплаты\nв контексте дела', text: 'Все документы, платежи и история\nв одном месте.' },
  ],
  note: 'Откройте готовую CRM с тестовыми данными и посмотрите, как всё работает уже сейчас.',
  demoUnavailable: 'Демо временно недоступно. Попробуйте позже или создайте собственную организацию.',
  demoBar: {
    title: 'Вы находитесь в общем интерактивном демо',
    text: 'Тестовые данные можно изменять. Технические настройки и данные доступа защищены.',
    register: 'Создать свою организацию',
    login: 'Войти в свой аккаунт',
  },
}

const en: ConferenceCopy = {
  meta: {
    title: 'LegalHub CRM — your agency’s work in one CRM',
    description: 'CRM for legalization companies in Poland.',
  },
  hero: {
    eyebrow: 'CRM for legalization companies in Poland',
    title: 'Your agency’s work —',
    accent: 'in one CRM',
    text: 'Leads, clients, cases, documents, deadlines, payments, and your team — in one system.',
    demo: 'Open demo',
    register: 'Start for free',
    imageAlt: 'Real LegalHub CRM Dashboard with sample data',
  },
  benefits: [
    { title: 'Leads and cases\nin one place', text: 'Every client, case, and stage\nis always close at hand.' },
    { title: 'Deadlines, tasks, and\nowners under control', text: 'Nothing gets forgotten, and every action\nis assigned to a specific person.' },
    { title: 'Documents and payments\nin the case context', text: 'Every document, payment, and activity\nin one place.' },
  ],
  note: 'Open a ready CRM with sample data and see how everything works right now.',
  demoUnavailable: 'The demo is temporarily unavailable. Try again later or create your own organization.',
  demoBar: {
    title: 'You are using the shared interactive demo',
    text: 'You can change sample data. Technical settings and account credentials remain protected.',
    register: 'Create your organization',
    login: 'Sign in to your account',
  },
}

const copies: Record<MarketingLang, ConferenceCopy> = { ru, uk, en, pl }

export function getConferenceCopy(lang: MarketingLang) {
  return copies[lang] || copies.uk
}
