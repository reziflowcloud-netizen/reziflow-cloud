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
  openCrm: string
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
  openLarger: string
  closeImage: string
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
    openCrm: 'Открыть CRM',
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
    openLarger: 'Открыть крупнее',
    closeImage: 'Закрыть изображение',
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

const ukMarketingCopy: MarketingCopy = {
  ...ruMarketingCopy,
  header: {
    navAria: 'Головне меню',
    menu: 'Меню',
    nav: {
      product: 'Продукт',
      tour: 'Демо',
      workflow: 'Процес',
      pricing: 'Тарифи',
      security: 'Безпека',
    },
    login: 'Увійти',
    openCrm: 'Відкрити CRM',
    startFree: 'Почати безкоштовно',
  },
  hero: {
    kicker: 'CRM для компаній з легалізації в Польщі',
    title: 'Кожна справа з легалізації — під контролем',
    lead: 'LegalHub збирає заявки, клієнтів, документи, строки, оплати й команду в одній системі. По кожній справі видно, що відбувається, хто відповідає і який наступний крок.',
    fitNote: 'Підходить для одного спеціаліста, невеликої команди та компанії, що зростає.',
    primary: 'Подивитися демо',
    secondary: 'Почати безкоштовно',
    proof: [
      { strong: 'Імпорт', text: 'з Excel' },
      { strong: 'Ролі', text: 'співробітників' },
      { strong: 'Старт', text: 'за 5 хвилин' },
      { strong: 'Без картки', text: 'для перевірки' },
    ],
    dashboardAria: 'Приклад інтерфейсу LegalHub CRM для процесів легалізації',
    windowTitle: 'LegalHub workspace',
    sidebarLabel: 'CRM',
    boardTitle: 'Панель керівника',
    today: 'Сьогодні',
    kpis: [
      { label: 'Нові заявки', value: '18', delta: 'сьогодні' },
      { label: 'Активні справи', value: '128', delta: '+12%' },
      { label: 'Прострочення', value: '9', delta: 'у фокусі', warning: true },
      { label: 'Документи', value: '31', delta: 'готові до подання' },
    ],
    nextActionsTitle: 'Наступні дії',
    nextActions: [
      { name: 'Anna K.', text: 'Karta Pobytu · Не вистачає: umowa zlecenia · Дедлайн: 12.06' },
      { name: 'Oleh M.', text: 'Zezwolenie na pracę · Готово до подання · Відповідальна: Marta' },
      { name: 'Irina S.', text: 'PESEL / meldunek · Прострочення: 2 дні · Призначити зустріч' },
    ],
    documentsTitle: 'Документи',
    documents: [
      { value: '31', text: 'готові до подання' },
      { value: '7', text: 'клієнтів чекають відповіді' },
    ],
  },
  productTour: {
    ariaLabel: 'Демо LegalHub CRM',
    kicker: 'Демо процесу',
    title: 'Подивіться, як виглядає робочий процес у CRM',
    text: 'Короткий приклад: заявка, справа, документи та контроль керівника в одному інтерфейсі.',
    previewAriaPrefix: 'Екран LegalHub',
    openLarger: 'Відкрити більше',
    closeImage: 'Закрити зображення',
    modules: [
      {
        id: 'leads',
        label: 'Заявки',
        title: 'Заявки одразу потрапляють у роботу',
        text: 'Джерело, послуга, контакт і наступний крок видно в одній картці.',
        stats: ['18 нових заявок', '4 джерела', '7 чекають відповіді'],
        rows: [
          ['Telegram', 'Karta Pobytu', 'Сьогодні 12:40'],
          ['Сайт', 'Zezwolenie na pracę', 'Сьогодні 10:15'],
          ['Instagram', 'PESEL', 'Вчора 18:05'],
          ['Facebook', 'Консультація', 'Вчора 16:20'],
        ],
      },
      {
        id: 'cases',
        label: 'Справи',
        title: 'Справа рухається зрозумілими етапами',
        text: 'Консультація, збір документів, подання, очікування рішення та завершення.',
        stats: ['128 активних справ', '6 етапів', '12 готові до подання'],
        rows: [
          ['Нова заявка', 'Консультація', 'Marta'],
          ['Збір документів', 'Готово до подання', 'Anna'],
          ['Подано', 'Очікування рішення', 'Oleh'],
          ['Завершено', 'Повторний контакт', 'CRM'],
        ],
      },
      {
        id: 'documents',
        label: 'Документи',
        title: 'Видно, чого не вистачає',
        text: 'Отримані й відсутні документи відображаються прямо в картці справи.',
        stats: ['31 готовий до подання', '7 не вистачає', '12 дедлайнів'],
        rows: [
          ['Anna K.', 'Готово: паспорт, фото, анкета', 'Karta Pobytu'],
          ['Не вистачає', 'umowa zlecenia, оплата', 'Запросити'],
          ['Наступний крок', 'Запросити документ', 'Сьогодні'],
        ],
      },
      {
        id: 'control',
        label: 'Контроль',
        title: 'Керівник бачить контрольні точки',
        text: 'Прострочення, документи, нові заявки й клієнти без відповіді видно одразу.',
        stats: ['9 прострочень', '18 нових заявок', '31 документ готовий'],
        rows: [
          ['Прострочення', 'Справи без руху', '9'],
          ['Заявки', 'Нові за сьогодні', '18'],
          ['Документи', 'Готові до подання', '31'],
          ['Відповіді', 'Клієнти чекають контакту', '7'],
        ],
      },
    ],
  },
  pricing: {
    kicker: 'Тарифи',
    title: 'Почніть безкоштовно, тариф виберете пізніше',
    text: 'Створіть робочий простір, додайте кілька клієнтів або імпортуйте таблицю. Оплату можна підключити після перевірки CRM у роботі.',
    plans: [
      {
        id: 'free',
        eyebrow: 'Легкий старт',
        name: 'Безкоштовний',
        price: '0 zł',
        period: 'без картки',
        text: 'Для перевірки CRM на перших заявках і реальних процесах.',
        items: [
          'Створити робочий простір',
          'Додати перші заявки та клієнтів',
          'Перевірити процес на реальних справах',
          'Зрозуміти, чи підходить CRM вашій команді',
        ],
        buttonLabel: 'Спробувати безкоштовно',
      },
      {
        id: 'starter',
        eyebrow: 'Для старту',
        name: 'Starter',
        price: '199 zł',
        period: '/ місяць',
        text: 'Для невеликої команди, яка хоче піти від Excel і тримати клієнтів під контролем.',
        items: [
          'Клієнти, справи та задачі',
          'Документи й дедлайни',
          'До 3 користувачів',
          'Безкоштовний старт без картки',
        ],
        buttonLabel: 'Почати зі Starter',
      },
      {
        id: 'pro',
        eyebrow: 'Рекомендуємо',
        name: 'Pro',
        price: '299 zł',
        period: '/ місяць',
        text: 'Для компанії, що зростає, з регулярним потоком заявок, співробітниками й звітністю для керівника.',
        items: [
          'Ліди та воронка',
          'Шаблони документів',
          'Командні ролі та звіти',
          'Інтеграції заявок',
        ],
        buttonLabel: 'Вибрати Pro',
      },
      {
        id: 'agency',
        eyebrow: 'Для масштабу',
        name: 'Agency',
        price: '499 zł',
        period: '/ місяць',
        text: 'Для кількох офісів, великого потоку клієнтів і розширених налаштувань.',
        items: [
          'Розширені налаштування',
          'Пріоритетні інтеграції',
          'Персональна допомога із запуском',
          'Допомога з міграцією',
        ],
        buttonLabel: 'Обговорити Agency',
      },
    ],
  },
  faq: {
    kicker: 'FAQ',
    title: 'Часті запитання',
    items: [
      {
        question: 'Чи можна почати з чистої бази?',
        answer: 'Так. Ви можете створити робочий простір без імпорту й почати з перших клієнтів вручну. Це зручно, якщо ви тільки запускаєте фірму або хочете спочатку перевірити CRM на невеликому процесі.',
      },
      {
        question: 'Чим LegalHub відрізняється від звичайної CRM?',
        answer: 'Звичайна CRM частіше допомагає вести продажі. LegalHub допомагає контролювати весь процес легалізації: клієнта, справу, документи, строки, оплату, відповідального й наступний крок.',
      },
      {
        question: 'Чи можна обмежити доступ співробітникам?',
        answer: 'Так. Можна налаштувати ролі й права, щоб співробітник бачив тільки потрібні розділи, клієнтів, задачі та справи.',
      },
      {
        question: 'Чи підійде LegalHub, якщо ми зараз працюємо в Excel?',
        answer: 'Так. Ви можете імпортувати базу з Excel або Google Sheets і поступово перевести роботу в CRM.',
      },
      {
        question: 'Чи можна почати без оплати й картки?',
        answer: 'Так. Можна створити робочий простір безкоштовно й перевірити CRM на реальних заявках без картки.',
      },
      {
        question: 'Скільки часу займає запуск?',
        answer: 'Перший робочий простір можна створити за кілька хвилин. Для команди можна почати з одного процесу, наприклад Karta Pobytu, а потім додати інші.',
      },
      {
        question: 'Співробітники не звикли до CRM. Буде складно?',
        answer: 'LegalHub побудований навколо простого процесу: заявка, клієнт, справа, документи, дедлайн, наступний крок. Співробітнику не потрібно вивчати складну універсальну CRM.',
      },
      {
        question: 'Чи можна налаштувати етапи під наш процес?',
        answer: 'Так. Етапи можна адаптувати під вашу роботу: консультація, збір документів, готово до подання, подано, очікування, завершено.',
      },
      {
        question: 'Чи можна вести різні послуги?',
        answer: 'Так. У CRM можна вести Karta Pobytu, Work Permit, PESEL, meldunek, oświadczenia та інші процеси, де є клієнт, документи, строки й відповідальний.',
      },
      {
        question: 'Що буде з нашою базою клієнтів?',
        answer: 'Ви можете імпортувати базу з таблиці й вивантажувати дані за потреби.',
      },
      {
        question: 'Чи потрібна допомога із запуском?',
        answer: 'Для команд можна зробити запуск по кроках: імпорт бази, налаштування етапів, ролі співробітників і перший робочий процес.',
      },
    ],
  },
  final: {
    kicker: 'Наступний крок',
    title: 'Перевірте LegalHub на кількох реальних клієнтах',
    text: 'Додайте 5-10 клієнтів або імпортуйте таблицю й подивіться, як CRM допомагає контролювати заявки, документи, строки, оплати та співробітників.',
    primary: 'Спробувати безкоштовно',
    secondary: 'Подивитися демо',
    note: 'Старт за кілька хвилин · Без картки · Можна почати з кількох клієнтів',
  },
  footer: {
    tagline: 'CRM для компаній з легалізації в Польщі.',
    phoneLabel: 'Швидкий звʼязок',
  },
}

const enMarketingCopy: MarketingCopy = {
  ...ruMarketingCopy,
  header: {
    navAria: 'Main menu',
    menu: 'Menu',
    nav: {
      product: 'Product',
      tour: 'Demo',
      workflow: 'Process',
      pricing: 'Pricing',
      security: 'Security',
    },
    login: 'Sign in',
    openCrm: 'Open CRM',
    startFree: 'Start free',
  },
  hero: {
    kicker: 'CRM for legalization companies in Poland',
    title: 'Every legalization case under control',
    lead: 'LegalHub brings requests, clients, documents, deadlines, payments and your team into one system. For each case you can see what is happening, who is responsible and what the next step is.',
    fitNote: 'Built for solo specialists, small teams and growing agencies.',
    primary: 'View demo',
    secondary: 'Start free',
    proof: [
      { strong: 'Import', text: 'from Excel' },
      { strong: 'Roles', text: 'for your team' },
      { strong: 'Start', text: 'in 5 minutes' },
      { strong: 'No card', text: 'to try it' },
    ],
    dashboardAria: 'Example LegalHub CRM interface for legalization processes',
    windowTitle: 'LegalHub workspace',
    sidebarLabel: 'CRM',
    boardTitle: 'Manager dashboard',
    today: 'Today',
    kpis: [
      { label: 'New requests', value: '18', delta: 'today' },
      { label: 'Active cases', value: '128', delta: '+12%' },
      { label: 'Overdue', value: '9', delta: 'in focus', warning: true },
      { label: 'Documents', value: '31', delta: 'ready to file' },
    ],
    nextActionsTitle: 'Next actions',
    nextActions: [
      { name: 'Anna K.', text: 'Karta Pobytu · Missing: umowa zlecenia · Deadline: 12.06' },
      { name: 'Oleh M.', text: 'Work permit · Ready to file · Owner: Marta' },
      { name: 'Irina S.', text: 'PESEL / meldunek · 2 days overdue · Schedule a meeting' },
    ],
    documentsTitle: 'Documents',
    documents: [
      { value: '31', text: 'ready to file' },
      { value: '7', text: 'clients waiting for a reply' },
    ],
  },
  productTour: {
    ariaLabel: 'LegalHub CRM demo',
    kicker: 'Process demo',
    title: 'See what the working process looks like in CRM',
    text: 'A quick example: request, case, documents and manager control in one interface.',
    previewAriaPrefix: 'LegalHub screen',
    openLarger: 'Open larger',
    closeImage: 'Close image',
    modules: [
      {
        id: 'leads',
        label: 'Requests',
        title: 'Requests go straight into work',
        text: 'Source, service, contact and the next step are visible in one card.',
        stats: ['18 new requests', '4 sources', '7 waiting for a reply'],
        rows: [
          ['Telegram', 'Karta Pobytu', 'Today 12:40'],
          ['Website', 'Work permit', 'Today 10:15'],
          ['Instagram', 'PESEL', 'Yesterday 18:05'],
          ['Facebook', 'Consultation', 'Yesterday 16:20'],
        ],
      },
      {
        id: 'cases',
        label: 'Cases',
        title: 'Each case moves through clear stages',
        text: 'Consultation, document collection, filing, decision waiting and completion.',
        stats: ['128 active cases', '6 stages', '12 ready to file'],
        rows: [
          ['New request', 'Consultation', 'Marta'],
          ['Documents', 'Ready to file', 'Anna'],
          ['Filed', 'Waiting for decision', 'Oleh'],
          ['Completed', 'Follow-up', 'CRM'],
        ],
      },
      {
        id: 'documents',
        label: 'Documents',
        title: 'You can see what is missing',
        text: 'Received and missing documents are shown directly in the case card.',
        stats: ['31 ready to file', '7 missing', '12 deadlines'],
        rows: [
          ['Anna K.', 'Ready: passport, photo, form', 'Karta Pobytu'],
          ['Missing', 'umowa zlecenia, payment', 'Request'],
          ['Next step', 'Ask for document', 'Today'],
        ],
      },
      {
        id: 'control',
        label: 'Control',
        title: 'The manager sees control points',
        text: 'Overdue items, documents, new requests and clients without a reply are visible immediately.',
        stats: ['9 overdue', '18 new requests', '31 ready documents'],
        rows: [
          ['Overdue', 'Cases without movement', '9'],
          ['Requests', 'New today', '18'],
          ['Documents', 'Ready to file', '31'],
          ['Replies', 'Clients waiting', '7'],
        ],
      },
    ],
  },
  pricing: {
    kicker: 'Pricing',
    title: 'Start for free, choose a plan later',
    text: 'Create a workspace, add a few clients or import a spreadsheet. You can connect payment after checking the CRM in real work.',
    plans: [
      {
        id: 'free',
        eyebrow: 'Light start',
        name: 'Free',
        price: '0 zł',
        period: 'no card',
        text: 'For checking CRM on the first requests and real processes.',
        items: [
          'Create a workspace',
          'Add first requests and clients',
          'Test the process on real cases',
          'Understand if the CRM fits your team',
        ],
        buttonLabel: 'Try for free',
      },
      {
        id: 'starter',
        eyebrow: 'For starting',
        name: 'Starter',
        price: '199 zł',
        period: '/ month',
        text: 'For a small team that wants to move away from Excel and keep clients under control.',
        items: [
          'Clients, cases and tasks',
          'Documents and deadlines',
          'Up to 3 users',
          'Free start without a card',
        ],
        buttonLabel: 'Start with Starter',
      },
      {
        id: 'pro',
        eyebrow: 'Recommended',
        name: 'Pro',
        price: '299 zł',
        period: '/ month',
        text: 'For a growing company with a regular request flow, team members and manager reporting.',
        items: [
          'Leads and pipeline',
          'Document templates',
          'Team roles and reports',
          'Request integrations',
        ],
        buttonLabel: 'Choose Pro',
      },
      {
        id: 'agency',
        eyebrow: 'For scale',
        name: 'Agency',
        price: '499 zł',
        period: '/ month',
        text: 'For several offices, a larger client flow and advanced settings.',
        items: [
          'Advanced settings',
          'Priority integrations',
          'Personal launch support',
          'Migration help',
        ],
        buttonLabel: 'Discuss Agency',
      },
    ],
  },
  faq: {
    kicker: 'FAQ',
    title: 'Frequently asked questions',
    items: [
      {
        question: 'Can we start with an empty database?',
        answer: 'Yes. You can create a workspace without import and start manually with the first clients. This is useful if you are just launching or want to test CRM on a small process first.',
      },
      {
        question: 'How is LegalHub different from a regular CRM?',
        answer: 'A regular CRM is usually built around sales. LegalHub helps control the whole legalization process: client, case, documents, deadlines, payments, responsible person and next step.',
      },
      {
        question: 'Can we limit employee access?',
        answer: 'Yes. Roles and permissions can be configured so employees see only the sections, clients, tasks and cases they need.',
      },
      {
        question: 'Will LegalHub work if we currently use Excel?',
        answer: 'Yes. You can import your base from Excel or Google Sheets and gradually move work into CRM.',
      },
      {
        question: 'Can we start without payment and without a card?',
        answer: 'Yes. You can create a workspace for free and test CRM on real requests without a card.',
      },
      {
        question: 'How long does launch take?',
        answer: 'The first workspace can be created in a few minutes. A team can start with one process, for example Karta Pobytu, and then add the rest.',
      },
      {
        question: 'Employees are not used to CRM. Will it be difficult?',
        answer: 'LegalHub is built around a simple flow: request, client, case, documents, deadline and next step. Employees do not need to learn a complex universal CRM.',
      },
      {
        question: 'Can stages be adapted to our process?',
        answer: 'Yes. Stages can be adjusted to your work: consultation, document collection, ready to file, filed, waiting, completed.',
      },
      {
        question: 'Can we manage different services?',
        answer: 'Yes. The CRM can handle Karta Pobytu, Work Permit, PESEL, meldunek, oświadczenia and other processes.',
      },
      {
        question: 'What happens to our client base?',
        answer: 'You can import your base from a spreadsheet and export data when needed.',
      },
      {
        question: 'Do we need help with launch?',
        answer: 'For teams, launch can be done step by step: base import, stage setup, employee roles and the first working process.',
      },
    ],
  },
  final: {
    kicker: 'Next step',
    title: 'Test LegalHub on a few real clients',
    text: 'Add 5-10 clients or import a spreadsheet and see how CRM helps control requests, documents, deadlines, payments and employees.',
    primary: 'Try for free',
    secondary: 'View demo',
    note: 'Start in a few minutes · No card · You can begin with a few clients',
  },
  footer: {
    tagline: 'CRM for legalization companies in Poland.',
    phoneLabel: 'Quick contact',
  },
}

const plMarketingCopy: MarketingCopy = {
  ...ruMarketingCopy,
  header: {
    navAria: 'Menu główne',
    menu: 'Menu',
    nav: {
      product: 'Produkt',
      tour: 'Demo',
      workflow: 'Proces',
      pricing: 'Cennik',
      security: 'Bezpieczeństwo',
    },
    login: 'Zaloguj',
    openCrm: 'Otwórz CRM',
    startFree: 'Zacznij bezpłatnie',
  },
  hero: {
    kicker: 'CRM dla firm legalizacyjnych w Polsce',
    title: 'Każda sprawa legalizacyjna pod kontrolą',
    lead: 'LegalHub zbiera zgłoszenia, klientów, dokumenty, terminy, płatności i zespół w jednym systemie. Przy każdej sprawie widać, co się dzieje, kto odpowiada i jaki jest następny krok.',
    fitNote: 'Dla jednego specjalisty, małego zespołu i rozwijającej się agencji.',
    primary: 'Zobacz demo',
    secondary: 'Zacznij bezpłatnie',
    proof: [
      { strong: 'Import', text: 'z Excela' },
      { strong: 'Role', text: 'dla zespołu' },
      { strong: 'Start', text: 'w 5 minut' },
      { strong: 'Bez karty', text: 'do testu' },
    ],
    dashboardAria: 'Przykład interfejsu LegalHub CRM dla procesów legalizacji',
    windowTitle: 'LegalHub workspace',
    sidebarLabel: 'CRM',
    boardTitle: 'Panel managera',
    today: 'Dzisiaj',
    kpis: [
      { label: 'Nowe zgłoszenia', value: '18', delta: 'dzisiaj' },
      { label: 'Aktywne sprawy', value: '128', delta: '+12%' },
      { label: 'Po terminie', value: '9', delta: 'w fokusie', warning: true },
      { label: 'Dokumenty', value: '31', delta: 'gotowe do złożenia' },
    ],
    nextActionsTitle: 'Następne działania',
    nextActions: [
      { name: 'Anna K.', text: 'Karta Pobytu · Brakuje: umowa zlecenia · Termin: 12.06' },
      { name: 'Oleh M.', text: 'Zezwolenie na pracę · Gotowe do złożenia · Odpowiedzialna: Marta' },
      { name: 'Irina S.', text: 'PESEL / meldunek · 2 dni po terminie · Umówić spotkanie' },
    ],
    documentsTitle: 'Dokumenty',
    documents: [
      { value: '31', text: 'gotowe do złożenia' },
      { value: '7', text: 'klientów czeka na odpowiedź' },
    ],
  },
  productTour: {
    ariaLabel: 'Demo LegalHub CRM',
    kicker: 'Demo procesu',
    title: 'Zobacz, jak wygląda proces pracy w CRM',
    text: 'Krótki przykład: zgłoszenie, sprawa, dokumenty i kontrola managera w jednym interfejsie.',
    previewAriaPrefix: 'Ekran LegalHub',
    openLarger: 'Otwórz większe',
    closeImage: 'Zamknij obraz',
    modules: [
      {
        id: 'leads',
        label: 'Zgłoszenia',
        title: 'Zgłoszenia od razu trafiają do pracy',
        text: 'Źródło, usługa, kontakt i następny krok są widoczne w jednej karcie.',
        stats: ['18 nowych zgłoszeń', '4 źródła', '7 czeka na odpowiedź'],
        rows: [
          ['Telegram', 'Karta Pobytu', 'Dzisiaj 12:40'],
          ['Strona', 'Zezwolenie na pracę', 'Dzisiaj 10:15'],
          ['Instagram', 'PESEL', 'Wczoraj 18:05'],
          ['Facebook', 'Konsultacja', 'Wczoraj 16:20'],
        ],
      },
      {
        id: 'cases',
        label: 'Sprawy',
        title: 'Sprawa przechodzi przez jasne etapy',
        text: 'Konsultacja, zbieranie dokumentów, złożenie, oczekiwanie na decyzję i zakończenie.',
        stats: ['128 aktywnych spraw', '6 etapów', '12 gotowych do złożenia'],
        rows: [
          ['Nowe zgłoszenie', 'Konsultacja', 'Marta'],
          ['Dokumenty', 'Gotowe do złożenia', 'Anna'],
          ['Złożone', 'Oczekiwanie na decyzję', 'Oleh'],
          ['Zakończone', 'Ponowny kontakt', 'CRM'],
        ],
      },
      {
        id: 'documents',
        label: 'Dokumenty',
        title: 'Widać, czego brakuje',
        text: 'Otrzymane i brakujące dokumenty są pokazane bezpośrednio w karcie sprawy.',
        stats: ['31 gotowych do złożenia', '7 brakujących', '12 deadlineów'],
        rows: [
          ['Anna K.', 'Gotowe: paszport, zdjęcie, formularz', 'Karta Pobytu'],
          ['Brakuje', 'umowa zlecenia, płatność', 'Poprosić'],
          ['Następny krok', 'Poprosić o dokument', 'Dzisiaj'],
        ],
      },
      {
        id: 'control',
        label: 'Kontrola',
        title: 'Manager widzi punkty kontrolne',
        text: 'Opóźnienia, dokumenty, nowe zgłoszenia i klienci bez odpowiedzi są widoczne od razu.',
        stats: ['9 po terminie', '18 nowych zgłoszeń', '31 gotowych dokumentów'],
        rows: [
          ['Po terminie', 'Sprawy bez ruchu', '9'],
          ['Zgłoszenia', 'Nowe dzisiaj', '18'],
          ['Dokumenty', 'Gotowe do złożenia', '31'],
          ['Odpowiedzi', 'Klienci czekają', '7'],
        ],
      },
    ],
  },
  pricing: {
    kicker: 'Cennik',
    title: 'Zacznij bezpłatnie, taryfę wybierzesz później',
    text: 'Utwórz przestrzeń pracy, dodaj kilku klientów albo zaimportuj tabelę. Płatność można podłączyć po sprawdzeniu CRM w realnej pracy.',
    plans: [
      {
        id: 'free',
        eyebrow: 'Lekki start',
        name: 'Bezpłatny',
        price: '0 zł',
        period: 'bez karty',
        text: 'Do sprawdzenia CRM na pierwszych zgłoszeniach i realnych procesach.',
        items: [
          'Utwórz przestrzeń pracy',
          'Dodaj pierwsze zgłoszenia i klientów',
          'Sprawdź proces na realnych sprawach',
          'Zobacz, czy CRM pasuje do zespołu',
        ],
        buttonLabel: 'Spróbuj bezpłatnie',
      },
      {
        id: 'starter',
        eyebrow: 'Na start',
        name: 'Starter',
        price: '199 zł',
        period: '/ miesiąc',
        text: 'Dla małego zespołu, który chce odejść od Excela i trzymać klientów pod kontrolą.',
        items: [
          'Klienci, sprawy i zadania',
          'Dokumenty i terminy',
          'Do 3 użytkowników',
          'Bezpłatny start bez karty',
        ],
        buttonLabel: 'Zacznij od Starter',
      },
      {
        id: 'pro',
        eyebrow: 'Polecany',
        name: 'Pro',
        price: '299 zł',
        period: '/ miesiąc',
        text: 'Dla rozwijającej się firmy z regularnym napływem zgłoszeń, zespołem i raportowaniem dla managera.',
        items: [
          'Leady i lejek',
          'Szablony dokumentów',
          'Role zespołu i raporty',
          'Integracje zgłoszeń',
        ],
        buttonLabel: 'Wybierz Pro',
      },
      {
        id: 'agency',
        eyebrow: 'Dla skali',
        name: 'Agency',
        price: '499 zł',
        period: '/ miesiąc',
        text: 'Dla kilku biur, większego przepływu klientów i zaawansowanych ustawień.',
        items: [
          'Zaawansowane ustawienia',
          'Priorytetowe integracje',
          'Osobiste wsparcie startu',
          'Pomoc z migracją',
        ],
        buttonLabel: 'Omów Agency',
      },
    ],
  },
  faq: {
    kicker: 'FAQ',
    title: 'Najczęstsze pytania',
    items: [
      {
        question: 'Czy można zacząć z pustą bazą?',
        answer: 'Tak. Możesz utworzyć przestrzeń pracy bez importu i zacząć ręcznie od pierwszych klientów. To wygodne, jeśli dopiero uruchamiasz firmę albo chcesz najpierw sprawdzić CRM na małym procesie.',
      },
      {
        question: 'Czym LegalHub różni się od zwykłego CRM?',
        answer: 'Zwykły CRM częściej pomaga prowadzić sprzedaż. LegalHub pomaga kontrolować cały proces legalizacji: klienta, sprawę, dokumenty, terminy, płatność, odpowiedzialnego i następny krok.',
      },
      {
        question: 'Czy można ograniczyć dostęp pracownikom?',
        answer: 'Tak. Można skonfigurować role i prawa tak, aby pracownicy widzieli tylko potrzebne sekcje, klientów, zadania i sprawy.',
      },
      {
        question: 'Czy LegalHub sprawdzi się, jeśli teraz pracujemy w Excelu?',
        answer: 'Tak. Możesz zaimportować bazę z Excela albo Google Sheets i stopniowo przenieść pracę do CRM.',
      },
      {
        question: 'Czy można zacząć bez płatności i bez karty?',
        answer: 'Tak. Można utworzyć przestrzeń pracy bezpłatnie i sprawdzić CRM na realnych zgłoszeniach bez karty.',
      },
      {
        question: 'Ile trwa uruchomienie?',
        answer: 'Pierwszą przestrzeń pracy można utworzyć w kilka minut. Zespół może zacząć od jednego procesu, na przykład Karta Pobytu, a później dodać pozostałe.',
      },
      {
        question: 'Pracownicy nie są przyzwyczajeni do CRM. Czy będzie trudno?',
        answer: 'LegalHub jest zbudowany wokół prostego procesu: zgłoszenie, klient, sprawa, dokumenty, termin i następny krok. Pracownik nie musi uczyć się skomplikowanego uniwersalnego CRM.',
      },
      {
        question: 'Czy można dopasować etapy do naszego procesu?',
        answer: 'Tak. Etapy można dostosować do pracy: konsultacja, zbieranie dokumentów, gotowe do złożenia, złożone, oczekiwanie, zakończone.',
      },
      {
        question: 'Czy można prowadzić różne usługi?',
        answer: 'Tak. W CRM można prowadzić Karta Pobytu, Work Permit, PESEL, meldunek, oświadczenia i inne procesy.',
      },
      {
        question: 'Co będzie z naszą bazą klientów?',
        answer: 'Możesz zaimportować bazę z tabeli i wyeksportować dane, kiedy będzie to potrzebne.',
      },
      {
        question: 'Czy potrzebna jest pomoc z uruchomieniem?',
        answer: 'Dla zespołów można zrobić uruchomienie krok po kroku: import bazy, ustawienie etapów, role pracowników i pierwszy proces roboczy.',
      },
    ],
  },
  final: {
    kicker: 'Następny krok',
    title: 'Sprawdź LegalHub na kilku realnych klientach',
    text: 'Dodaj 5-10 klientów albo zaimportuj tabelę i zobacz, jak CRM pomaga kontrolować zgłoszenia, dokumenty, terminy, płatności i pracowników.',
    primary: 'Spróbuj bezpłatnie',
    secondary: 'Zobacz demo',
    note: 'Start w kilka minut · Bez karty · Można zacząć od kilku klientów',
  },
  footer: {
    tagline: 'CRM dla firm legalizacyjnych w Polsce.',
    phoneLabel: 'Szybki kontakt',
  },
}

export const marketingCopy: Record<MarketingLang, MarketingCopy> = {
  ru: ruMarketingCopy,
  en: enMarketingCopy,
  uk: ukMarketingCopy,
  pl: plMarketingCopy,
}

export function getMarketingCopy(lang: MarketingLang) {
  return marketingCopy[lang] || marketingCopy[DEFAULT_MARKETING_LANG]
}
