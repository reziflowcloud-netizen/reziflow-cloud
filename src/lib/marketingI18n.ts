export type MarketingLang = 'en' | 'ru' | 'uk' | 'pl'

export type LanguageOption = {
  code: MarketingLang
  short: string
  label: string
}

export const DEFAULT_MARKETING_LANG: MarketingLang = 'ru'
export const MARKETING_LANG_STORAGE_KEY = 'legalhub_marketing_lang'
export const APP_LANG_STORAGE_KEY = 'rezi_lang'
export const MARKETING_LANG_CHANGE_EVENT = 'marketinglangchange'

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'ru', short: 'RU', label: 'Русский' },
  { code: 'uk', short: 'UA', label: 'Українська' },
  { code: 'pl', short: 'PL', label: 'Polski' },
]

export type MarketingHeaderCopy = {
  navAria: string
  menu: string
  nav: {
    product: string
    tour: string
    workflow: string
    pricing: string
    security: string
  }
  login: string
  startFree: string
}

export type ProductTourModule = {
  id: string
  label: string
  title: string
  text: string
  stats: string[]
  rows: Array<[string, string, string]>
}

export type ProductTourCopy = {
  ariaLabel: string
  kicker: string
  title: string
  text: string
  previewAriaPrefix: string
  modules: ProductTourModule[]
}

export type MarketingPlanCopy = {
  id: string
  name: string
  price: string
  period: string
  eyebrow: string
  text: string
  items: string[]
  buttonLabel: string
}

type TextCard = {
  eyebrow?: string
  title: string
  text: string
}

export type MarketingCopy = {
  header: MarketingHeaderCopy
  hero: {
    kicker: string
    title: string
    lead: string
    fitNote: string
    primary: string
    secondary: string
    proof: Array<{ strong: string, text: string }>
    dashboardAria: string
    windowTitle: string
    sidebarLabel: string
    boardTitle: string
    today: string
    kpis: Array<{ label: string, value: string, delta: string, warning?: boolean }>
    nextActionsTitle: string
    nextActions: Array<{ name: string, text: string }>
    documentsTitle: string
    documents: Array<{ value: string, text: string }>
  }
  problems: {
    kicker: string
    title: string
    text: string
    cards: TextCard[]
  }
  product: {
    kicker: string
    title: string
    text: string
    before: { eyebrow: string, title: string, items: string[] }
    after: { eyebrow: string, title: string, items: string[] }
  }
  productTour: ProductTourCopy
  managerView: {
    kicker: string
    title: string
    text: string
    cards: TextCard[]
  }
  workflow: {
    kicker: string
    title: string
    text: string
    steps: Array<{ title: string, text: string }>
  }
  migration: {
    kicker: string
    title: string
    text: string
    steps: Array<{ number: string, title: string, text: string }>
    note: string
  }
  services: {
    kicker: string
    title: string
    text: string
    cards: TextCard[]
  }
  comparison: {
    kicker: string
    title: string
    text: string
    generic: { eyebrow: string, title: string, items: string[] }
    legalhub: { eyebrow: string, title: string, items: string[] }
  }
  security: {
    kicker: string
    title: string
    text: string
    cards: TextCard[]
  }
  pricing: {
    kicker: string
    title: string
    text: string
    plans: MarketingPlanCopy[]
  }
  faq: {
    kicker: string
    title: string
    items: Array<{ question: string, answer: string }>
  }
  final: {
    kicker: string
    title: string
    text: string
    primary: string
    secondary: string
    note: string
  }
  footer: {
    tagline: string
    phoneLabel: string
  }
}

export function normalizeMarketingLang(value: string | null | undefined): MarketingLang {
  return LANGUAGE_OPTIONS.some(option => option.code === value) ? value as MarketingLang : DEFAULT_MARKETING_LANG
}

const ruMarketingCopy: MarketingCopy = {
  header: {
    navAria: 'Главное меню',
    menu: 'Меню',
    nav: {
      product: 'Продукт',
      tour: 'Демо',
      workflow: 'Процесс',
      pricing: 'Тарифы',
      security: 'Безопасность',
    },
    login: 'Войти',
    startFree: 'Начать бесплатно',
  },
  hero: {
    kicker: 'CRM для компаний по легализации в Польше',
    title: 'Каждое дело по легализации — под контролем',
    lead: 'LegalHub собирает заявки, клиентов, документы, сроки, оплаты и команду в одной системе. По каждому делу видно, что происходит, кто отвечает и какой следующий шаг.',
    fitNote: 'Подходит для одного специалиста, маленькой команды и растущей фирмы.',
    primary: 'Посмотреть демо',
    secondary: 'Начать бесплатно',
    proof: [
      { strong: 'Импорт', text: 'из Excel' },
      { strong: 'Роли', text: 'сотрудников' },
      { strong: 'Старт', text: 'за 5 минут' },
      { strong: 'Без карты', text: 'для проверки' },
    ],
    dashboardAria: 'Пример интерфейса LegalHub CRM для процессов легализации',
    windowTitle: 'LegalHub workspace',
    sidebarLabel: 'CRM',
    boardTitle: 'Панель руководителя',
    today: 'Сегодня',
    kpis: [
      { label: 'Новые заявки', value: '18', delta: 'сегодня' },
      { label: 'Активные дела', value: '128', delta: '+12%' },
      { label: 'Просрочки', value: '9', delta: 'в фокусе', warning: true },
      { label: 'Документы', value: '31', delta: 'готов к подаче' },
    ],
    nextActionsTitle: 'Следующие действия',
    nextActions: [
      { name: 'Anna K.', text: 'Karta Pobytu · Не хватает: umowa zlecenia · Дедлайн: 12.06' },
      { name: 'Oleh M.', text: 'Zezwolenie na pracę · Готово к подаче · Ответственный: Marta' },
      { name: 'Irina S.', text: 'PESEL / meldunek · Просрочка: 2 дня · Назначить встречу' },
    ],
    documentsTitle: 'Документы',
    documents: [
      { value: '31', text: 'готов к подаче' },
      { value: '7', text: 'клиентов ждут ответа' },
    ],
  },
  problems: {
    kicker: 'Проблемы до CRM',
    title: 'Сейчас клиенты, документы и сроки живут в разных местах?',
    text: 'Так работает большинство компаний по легализации до CRM: заявки приходят в Direct и WhatsApp, документы лежат в Drive, статусы — в Excel, а руководитель узнаёт о проблемах слишком поздно.',
    cards: [
      {
        title: 'Заявки теряются',
        text: 'Клиент написал в Instagram, Facebook, WhatsApp или на сайт. Менеджер не ответил вовремя — клиент ушёл к другой компании.',
      },
      {
        title: 'Документы разбросаны',
        text: 'Паспорт, umowa, анкета, фото, сканы и договоры лежат в чатах, почте и Google Drive. Никто быстро не понимает, чего не хватает.',
      },
      {
        title: 'Сроки держатся в голове',
        text: 'Дедлайны записаны в календаре, таблице или вообще в памяти сотрудника. Просрочки видно только тогда, когда клиент уже недоволен.',
      },
      {
        title: 'Руководитель не видит картину',
        text: 'Нужно постоянно спрашивать сотрудников: “Что с этим клиентом?”, “Кто отвечает?”, “Почему дело не движется?”',
      },
    ],
  },
  product: {
    kicker: 'До / После',
    title: 'LegalHub убирает ручной контроль из процесса легализации',
    text: 'Вместо разрозненных таблиц, чатов и папок команда работает по одному процессу: заявка, клиент, дело, документы, дедлайн, оплата и ответственный.',
    before: {
      eyebrow: 'До CRM',
      title: 'Руководитель контролирует бизнес вручную',
      items: [
        'Заявки собираются из чатов, сайта, рекламы и рекомендаций вручную',
        'Статус клиента нужно спрашивать у сотрудника',
        'Документы лежат в Drive, почте, WhatsApp и Telegram',
        'Сроки контролируются в Excel, календарях или “на памяти”',
        'Клиент может зависнуть без следующего шага',
        'Руководитель видит проблему уже после просрочки',
      ],
    },
    after: {
      eyebrow: 'После LegalHub',
      title: 'Каждый клиент имеет статус, ответственного и следующий шаг',
      items: [
        'Каждая заявка попадает в CRM с источником и услугой',
        'По каждому клиенту видно этап, документы, дедлайн и оплату',
        'Сотрудник понимает, что делать дальше',
        'Руководитель видит просрочки, нагрузку и проблемные дела',
        'Документы и история общения хранятся в карточке клиента',
        'Бизнес можно масштабировать без хаоса в таблицах',
      ],
    },
  },
  productTour: {
    ariaLabel: 'Демо LegalHub CRM',
    kicker: 'Демо процесса',
    title: 'Посмотрите, как выглядит рабочий процесс в CRM',
    text: 'Короткий пример: заявка, дело, документы и контроль руководителя в одном интерфейсе.',
    previewAriaPrefix: 'Экран LegalHub',
    modules: [
      {
        id: 'leads',
        label: 'Заявки',
        title: 'Заявки сразу попадают в работу',
        text: 'Источник, услуга, контакт и следующий шаг видны в одной карточке.',
        stats: ['18 новых заявок', '4 источника', '7 ждут ответа'],
        rows: [
          ['Telegram', 'Karta Pobytu', 'Сегодня 12:40'],
          ['Сайт', 'Zezwolenie na pracę', 'Сегодня 10:15'],
          ['Instagram', 'PESEL', 'Вчера 18:05'],
          ['Facebook', 'Консультация', 'Вчера 16:20'],
        ],
      },
      {
        id: 'cases',
        label: 'Дела',
        title: 'Дело идет по понятным этапам',
        text: 'Консультация, сбор документов, подача, ожидание решения и завершение.',
        stats: ['128 активных дел', '6 этапов', '12 готово к подаче'],
        rows: [
          ['Новая заявка', 'Консультация', 'Marta'],
          ['Сбор документов', 'Готово к подаче', 'Anna'],
          ['Подано', 'Ожидание решения', 'Oleh'],
          ['Завершено', 'Повторный контакт', 'CRM'],
        ],
      },
      {
        id: 'documents',
        label: 'Документы',
        title: 'Видно, чего не хватает',
        text: 'Полученные и отсутствующие документы отображаются прямо в карточке дела.',
        stats: ['31 готов к подаче', '7 не хватает', '12 дедлайнов'],
        rows: [
          ['Anna K.', 'Готово: паспорт, фото, анкета', 'Karta Pobytu'],
          ['Не хватает', 'umowa zlecenia, оплата', 'Запросить'],
          ['Следующий шаг', 'Запросить документ', 'Сегодня'],
        ],
      },
      {
        id: 'control',
        label: 'Контроль',
        title: 'Руководитель видит контрольные точки',
        text: 'Просрочки, документы, новые заявки и клиенты без ответа видны сразу.',
        stats: ['9 просрочек', '18 новых заявок', '31 документ готов'],
        rows: [
          ['Просрочки', 'Дела без движения', '9'],
          ['Заявки', 'Новые за сегодня', '18'],
          ['Документы', 'Готовы к подаче', '31'],
          ['Ответы', 'Клиенты ждут контакта', '7'],
        ],
      },
    ],
  },
  managerView: {
    kicker: 'Контроль руководителя',
    title: 'Руководитель видит работу компании без ежедневных вопросов сотрудникам',
    text: 'LegalHub показывает не просто список клиентов, а реальную картину бизнеса: где новые заявки, какие дела зависли, кто отвечает, чего не хватает и где есть риск просрочки.',
    cards: [
      { title: 'Просрочки', text: 'Какие дела стоят без движения и требуют внимания сегодня.' },
      { title: 'Ответственные', text: 'Кто ведёт клиента, кто должен связаться и кто отвечает за следующий шаг.' },
      { title: 'Документы', text: 'Чего не хватает для подачи: umowa, паспорт, фото, анкета, доверенность, подтверждения.' },
      { title: 'Нагрузка команды', text: 'У кого слишком много активных дел, а у кого есть свободный ресурс.' },
      { title: 'Оплаты', text: 'Кто оплатил, кто должен доплатить, какие суммы ещё в работе.' },
      { title: 'Источники заявок', text: 'Откуда приходят лиды: сайт, Instagram, Facebook, Telegram, WhatsApp, рекомендации.' },
    ],
  },
  workflow: {
    kicker: 'От заявки до завершенного дела',
    title: 'От первой заявки до завершенного дела — один понятный процесс',
    text: 'LegalHub закрывает весь цикл работы компании по легализации: заявка, квалификация, клиент, документы, дедлайны, оплата, подача и контроль результата.',
    steps: [
      { title: 'Заявка', text: 'Лиды из сайта, рекламы, Instagram, Facebook, Telegram или WhatsApp попадают в CRM с источником, контактом и интересом.' },
      { title: 'Квалификация', text: 'Менеджер фиксирует услугу, язык, ситуацию клиента, следующий контакт и ответственного.' },
      { title: 'Дело', text: 'Заявку можно перевести в клиента и дело: Karta Pobytu, Work Permit, PESEL, meldunek или другой процесс.' },
      { title: 'Документы', text: 'По делу видно, какие документы получены, чего не хватает и что нужно запросить у клиента.' },
      { title: 'Контроль', text: 'Руководитель видит сроки, просрочки, оплату, нагрузку сотрудников и клиентов на каждом этапе.' },
      { title: 'Завершение', text: 'После завершения дела история, документы и контакты остаются в базе. Клиента можно вернуть на новую услугу или повторное обращение.' },
    ],
  },
  migration: {
    kicker: 'Переход без хаоса',
    title: 'Переход с Excel без потери базы и ручного хаоса',
    text: 'Уже ведёте клиентов в Excel или Google Sheets? Загрузите таблицу, сопоставьте колонки с полями CRM и продолжайте работу в LegalHub: клиенты, статусы, телефоны, услуги, ответственные и дедлайны сохраняются в системе.',
    steps: [
      {
        number: '01',
        title: 'Загрузите файл',
        text: 'Excel или Google Sheets с клиентами, лидами, статусами и контактами.',
      },
      {
        number: '02',
        title: 'Сопоставьте колонки',
        text: 'Имя, телефон, услуга, статус, ответственный, дедлайн, комментарий.',
      },
      {
        number: '03',
        title: 'Продолжайте работу в CRM',
        text: 'Каждый клиент получает карточку, статус, историю и следующий шаг.',
      },
    ],
    note: 'Можно начать с небольшой части базы и проверить процесс без риска.',
  },
  services: {
    kicker: 'Для процессов легализации',
    title: 'Подходит для основных процессов легализации в Польше',
    text: 'LegalHub можно использовать для разных услуг, где есть клиент, документы, сроки, ответственный и статус дела.',
    cards: [
      { title: 'Karta Pobytu', text: 'Контроль клиента от первой консультации до сбора документов, подачи и дальнейшего статуса.' },
      { title: 'Zezwolenie na pracę', text: 'Документы, работодатель, сроки, ответственный сотрудник и статус дела в одной карточке.' },
      { title: 'Oświadczenie / приглашения', text: 'Быстрые процессы, где важно не потерять заявку и вовремя подготовить документы.' },
      { title: 'PESEL / meldunek', text: 'Короткие услуги, которые удобно вести через понятные этапы и шаблоны.' },
      { title: 'Семейная легализация', text: 'Несколько связанных клиентов, документы членов семьи, статусы и дедлайны.' },
      { title: 'Комплексное сопровождение', text: 'Когда один клиент проходит несколько услуг, история сохраняется в одной базе.' },
    ],
  },
  comparison: {
    kicker: 'Сравнение',
    title: 'Обычная CRM ведёт продажи. LegalHub ведёт процесс легализации',
    text: 'Компании по легализации работают не только с продажами. После заявки начинается длинный процесс: документы, сроки, проверки, подача, ожидание, повторные контакты и контроль результата.',
    generic: {
      eyebrow: 'Обычная CRM',
      title: 'Подходит для продаж, но не закрывает весь процесс',
      items: ['Лид', 'Сделка', 'Звонок', 'Комментарий', 'Общая воронка продаж'],
    },
    legalhub: {
      eyebrow: 'LegalHub',
      title: 'Создан для работы с делами по легализации',
      items: ['Клиент', 'Услуга', 'Дело', 'Документы', 'Дедлайн', 'Ответственный', 'Подача', 'Оплата', 'Статус процесса'],
    },
  },
  security: {
    kicker: 'Безопасность и доступы',
    title: 'Доступ к клиентам, документам и оплатам контролируется ролями',
    text: 'В компании по легализации сотрудники работают с персональными данными клиентов. В LegalHub можно настроить, кто видит клиентов, документы, оплаты, отчёты и рабочие разделы. Роли и доступы помогают организовать работу с персональными данными клиентов.',
    cards: [
      { title: 'Роли сотрудников', text: 'Администратор управляет доступами и видимостью разделов CRM.' },
      { title: 'Доступ к своим делам', text: 'Сотрудник может видеть только тех клиентов и процессы, за которые отвечает.' },
      { title: 'Контроль действий', text: 'Руководитель видит изменения по клиентам, статусам, документам и дедлайнам.' },
      { title: 'Документы в карточке клиента', text: 'Файлы, статусы и история дела хранятся не в разрозненных чатах, а в одном месте.' },
      { title: 'Экспорт базы', text: 'Данные можно выгрузить, чтобы компания не боялась “запереться” внутри системы.' },
    ],
  },
  pricing: {
    kicker: 'Тарифы',
    title: 'Начните бесплатно, тариф выберите позже',
    text: 'Создайте рабочее пространство, добавьте несколько клиентов или импортируйте таблицу. Оплату можно подключить после проверки CRM в работе.',
    plans: [
      {
        id: 'free',
        eyebrow: 'Лёгкий старт',
        name: 'Бесплатный',
        price: '0 zł',
        period: 'без карты',
        text: 'Для проверки CRM на первых заявках и реальных процессах.',
        items: [
          'Создать рабочее пространство',
          'Добавить первые заявки и клиентов',
          'Проверить процесс на реальных делах',
          'Понять, подходит ли CRM вашей команде',
        ],
        buttonLabel: 'Попробовать бесплатно',
      },
      {
        id: 'starter',
        eyebrow: 'Для старта',
        name: 'Starter',
        price: '199 zł',
        period: '/ месяц',
        text: 'Для небольшой команды, которая хочет уйти от Excel и держать клиентов под контролем.',
        items: [
          'Клиенты, дела и задачи',
          'Документы и дедлайны',
          'До 3 пользователей',
          'Бесплатный старт без карты',
        ],
        buttonLabel: 'Начать со Starter',
      },
      {
        id: 'pro',
        eyebrow: 'Рекомендуем',
        name: 'Pro',
        price: '299 zł',
        period: '/ месяц',
        text: 'Для растущей компании с регулярным потоком заявок, сотрудниками и отчётностью руководителя.',
        items: [
          'Лиды и воронка',
          'Шаблоны документов',
          'Командные роли и отчёты',
          'Интеграции заявок',
        ],
        buttonLabel: 'Выбрать Pro',
      },
      {
        id: 'agency',
        eyebrow: 'Для масштаба',
        name: 'Agency',
        price: '499 zł',
        period: '/ месяц',
        text: 'Для нескольких офисов, большого потока клиентов и расширенных настроек.',
        items: [
          'Расширенные настройки',
          'Приоритетные интеграции',
          'Персональная помощь запуска',
          'Помощь с миграцией',
        ],
        buttonLabel: 'Обсудить Agency',
      },
    ],
  },
  faq: {
    kicker: 'FAQ',
    title: 'Частые вопросы',
    items: [
      {
        question: 'Можно ли начать с чистой базы?',
        answer: 'Да. Вы можете создать рабочее пространство без импорта и начать с первых клиентов вручную. Это удобно, если вы только запускаете фирму или хотите сначала проверить CRM на небольшом процессе.',
      },
      {
        question: 'Чем LegalHub отличается от обычной CRM?',
        answer: 'Обычная CRM чаще помогает вести продажи. LegalHub помогает контролировать весь процесс легализации: клиента, дело, документы, сроки, оплату, ответственного и следующий шаг.',
      },
      {
        question: 'Можно ли ограничить доступ сотрудникам?',
        answer: 'Да. Можно настроить роли и права, чтобы сотрудник видел только нужные разделы, клиентов, задачи и дела.',
      },
      {
        question: 'Подойдёт ли LegalHub, если мы сейчас работаем в Excel?',
        answer: 'Да. Вы можете импортировать базу из Excel или Google Sheets и постепенно перевести работу в CRM.',
      },
      {
        question: 'Можно ли начать без оплаты и карты?',
        answer: 'Да. Можно создать рабочее пространство бесплатно и проверить CRM на реальных заявках без карты.',
      },
      {
        question: 'Сколько времени занимает запуск?',
        answer: 'Первое рабочее пространство можно создать за несколько минут. Для команды можно начать с одного процесса, например Karta Pobytu, и потом добавить остальные.',
      },
      {
        question: 'Сотрудники не привыкли к CRM. Будет сложно?',
        answer: 'LegalHub строится вокруг простого процесса: заявка, клиент, дело, документы, дедлайн, следующий шаг. Сотруднику не нужно изучать сложную универсальную CRM.',
      },
      {
        question: 'Можно ли настроить этапы под наш процесс?',
        answer: 'Да. Этапы можно адаптировать под вашу работу: консультация, сбор документов, готово к подаче, подано, ожидание, завершено.',
      },
      {
        question: 'Можно ли вести разные услуги?',
        answer: 'Да. В CRM можно вести Karta Pobytu, Work Permit, PESEL, meldunek, oświadczenia и другие процессы, где есть клиент, документы, сроки и ответственный.',
      },
      {
        question: 'Можно ли ограничить доступ сотрудникам?',
        answer: 'Да. Можно настроить роли и доступы, чтобы сотрудники видели только нужные разделы, клиентов и дела.',
      },
      {
        question: 'Что будет с нашей базой клиентов?',
        answer: 'Вы можете импортировать базу из таблицы и выгружать данные при необходимости.',
      },
      {
        question: 'Нужна ли помощь с запуском?',
        answer: 'Для команд можно сделать запуск по шагам: импорт базы, настройка этапов, роли сотрудников и первый рабочий процесс.',
      },
    ],
  },
  final: {
    kicker: 'Следующий шаг',
    title: 'Проверьте LegalHub на нескольких реальных клиентах',
    text: 'Добавьте 5–10 клиентов или импортируйте таблицу и посмотрите, как CRM помогает контролировать заявки, документы, сроки, оплаты и сотрудников.',
    primary: 'Попробовать бесплатно',
    secondary: 'Посмотреть демо',
    note: 'Старт за несколько минут · Без карты · Можно начать с нескольких клиентов',
  },
  footer: {
    tagline: 'CRM для компаний по легализации в Польше.',
    phoneLabel: 'Быстрая связь',
  },
}

export const marketingCopy: Record<MarketingLang, MarketingCopy> = {
  ru: ruMarketingCopy,
  en: ruMarketingCopy,
  uk: ruMarketingCopy,
  pl: ruMarketingCopy,
}

export function getMarketingCopy(lang: MarketingLang) {
  return marketingCopy[lang] || marketingCopy[DEFAULT_MARKETING_LANG]
}
