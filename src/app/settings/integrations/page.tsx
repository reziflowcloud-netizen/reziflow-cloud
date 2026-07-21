'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'

type WebhookSettings = {
  slug: string
  enabled: boolean
  key: string
  fieldMap: FieldMapRow[]
  assignment: AssignmentSettings
  facebook: FacebookLeadSettings
}

type FieldMapRow = {
  external: string
  target: string
}

type AssignmentSettings = {
  mode: 'off' | 'single' | 'round_robin'
  userId: number | null
  userIds: number[]
}

type FacebookLeadSettings = {
  enabled: boolean
  messagesEnabled: boolean
  verifyToken: string
  pageAccessToken: string
  instagramPageAccessToken: string
  apiVersion: string
  oauth?: MetaOAuthConnection
}

type MetaOAuthPageOption = {
  id: string
  name: string
  tasks?: string[]
  instagramBusinessAccount?: {
    id?: string
    username?: string
  } | null
  connectedInstagramAccount?: {
    id?: string
    username?: string
  } | null
}

type MetaOAuthConnection = {
  connected: boolean
  connectedAt?: string
  userId?: string
  userName?: string
  pageId?: string
  pageName?: string
  instagramId?: string
  instagramUsername?: string
  pendingPages?: MetaOAuthPageOption[]
  subscriptionError?: string
  subscribedAt?: string
}

type StorageSettings = {
  provider: 'cloudinary' | 'dropbox'
  dropbox: {
    enabled: boolean
    rootFolder: string
    hasAccessToken: boolean
    accessToken?: string
  }
  canManage: boolean
}

type UserOption = {
  id: number
  name: string
  email: string
  role: string
}

type WebhookLog = {
  id: number
  status: string
  source?: string | null
  error?: string | null
  payload?: Record<string, unknown> | null
  createdAt: string
  lead?: {
    id: string
    firstName?: string | null
    lastName?: string | null
    fullName?: string | null
    phone?: string | null
    email?: string | null
  } | null
}

type MetaTokenDiagnostic = {
  label: string
  configured: boolean
  ok?: boolean
  error?: string
  data?: {
    id?: string
    name?: string
    username?: string
    instagram_business_account?: { id?: string; username?: string }
    connected_instagram_account?: { id?: string; username?: string }
  }
  debug?: {
    configured: boolean
    ok?: boolean
    error?: string
    appId?: string
    appName?: string
    type?: string
    isValid?: boolean
    expiresAt?: number | null
    scopes?: string[]
    requiredPermissions?: string[]
    missingPermissions?: string[]
    expectedAppId?: string | null
    appMatchesExpected?: boolean | null
  }
}

type MetaTokenDiagnostics = {
  apiVersion?: string
  facebook?: MetaTokenDiagnostic
  instagram?: MetaTokenDiagnostic
  hint?: string
}

const samplePayload = `{
  "firstName": "Ivan",
  "lastName": "Ivanov",
  "phone": "+48 123 456 789",
  "email": "ivan@example.com",
  "source": "website",
  "serviceInterest": "Pobyt czasowy",
  "nextContactNote": "Oddzwonic po konsultacji",
  "notes": "Zgloszenie z formularza"
}`

const targetFields = [
  { value: 'firstName', label: 'Имя' },
  { value: 'lastName', label: 'Фамилия' },
  { value: 'fullName', label: 'Полное имя' },
  { value: 'phone', label: 'Телефон' },
  { value: 'email', label: 'Email' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'messengerId', label: 'Messenger ID' },
  { value: 'city', label: 'Город' },
  { value: 'country', label: 'Страна / гражданство' },
  { value: 'language', label: 'Язык' },
  { value: 'serviceInterest', label: 'Интересующая услуга' },
  { value: 'budget', label: 'Бюджет' },
  { value: 'urgency', label: 'Срочность' },
  { value: 'notes', label: 'Заметки' },
  { value: 'source', label: 'Источник' },
  { value: 'nextContactAt', label: 'Следующий контакт' },
  { value: 'nextContactNote', label: 'О чем сконтактироваться' },
]

const integrationText = {
  ru: {
    title: 'Интеграции',
    subtitle: 'Подключение заявок с сайта, квиза, рекламы и внешних сервисов',
    back: 'Назад',
    loading: 'Загрузка...',
    loadFailed: 'Не удалось загрузить интеграции',
    saveFailed: 'Не удалось сохранить интеграции',
    storageSaveFailed: 'Не удалось сохранить хранилище документов',
    noDiagnostics: 'Нет данных диагностики',
    tokenNotSaved: 'Токен не сохранен',
    metaRejected: 'Meta не приняла токен',
    metaOk: 'Meta вернула OK',
    metaNeedsAttention: 'Проверить',
    metaDebugNotConfigured: 'Для проверки permissions добавьте в Vercel META_APP_ID и META_APP_SECRET или META_APP_ACCESS_TOKEN.',
    metaDebugError: 'debug_token не сработал',
    metaTokenApp: 'Meta App',
    metaTokenWrongApp: 'Токен выдан другим приложением. Ожидаемый App ID: {appId}',
    metaTokenPermissionsOk: 'Нужные permissions есть в токене',
    metaTokenMissingPermissions: 'Не хватает permissions',
    metaTokenExpires: 'Истекает',
    metaAdvancedAccessHint: 'Если permissions есть в токене, но реальные Instagram-лиды все равно блокируются, проверьте Advanced Access/App Review для instagram_manage_messages в Meta Developers и переподключите токен через это же приложение.',
    storageTitle: 'Хранение документов',
    storageHint: 'CRM всегда сохраняет документ в Cloudinary как основное хранилище. Если Dropbox подключен, туда дополнительно отправляется копия для папок организации.',
    storageEnabled: 'Делать копию новых документов в Dropbox',
    dropboxFolder: 'Папка в Dropbox',
    tokenSavedPlaceholder: 'Токен уже сохранен. Вставьте новый только для замены.',
    show: 'Показать',
    hide: 'Скрыть',
    saving: 'Сохраняю...',
    save: 'Сохранить',
    webhookTitle: 'Webhook для лидов',
    webhookHint: 'Этот адрес можно указать в квизе, форме сайта, Make, Zapier или другом сервисе. Каждая новая заявка будет создавать лида в этой организации.',
    webhookEnabled: 'Принимать лиды через webhook',
    webliumUrl: 'Webhook URL для Weblium',
    webliumHidden: 'Покажите ключ, чтобы увидеть URL для Weblium',
    copy: 'Копировать',
    webliumHint: 'Используйте этот вариант, если сервис не умеет отправлять заголовок x-reziflow-key.',
    accessKey: 'Ключ доступа',
    newKey: 'Новый ключ',
    regenerateConfirm: 'Пересоздать ключ? Старые подключения перестанут работать.',
    keyHint: 'Ключ можно передавать в заголовке x-reziflow-key или как Bearer token в Authorization.',
    requestExample: 'Пример запроса',
    requestHint: 'Минимально достаточно передать имя, телефон, email, Instagram или Facebook. Остальные поля можно добавлять постепенно.',
    mappingTitle: 'Маппинг полей',
    mappingHint: 'CRM уже автоматически понимает частые названия вроде name, phone, telefon, email, usluga, service. Здесь можно добавить свои правила для конкретного квиза или формы.',
    addField: '+ Поле',
    noMapping: 'Ручных правил пока нет. Автораспознавание все равно работает.',
    externalFieldPlaceholder: 'Поле из формы, например phone_number',
    delete: 'Удалить',
    saveMapping: 'Сохранить маппинг',
    assignmentTitle: 'Автораспределение лидов',
    assignmentHint: 'Новые лиды из webhook можно сразу назначать ответственному. Если внешний сервис передаст assignedToId, он будет иметь приоритет.',
    mode: 'Режим',
    modeOff: 'Не назначать автоматически',
    modeSingle: 'Назначать одного сотрудника',
    modeRoundRobin: 'По очереди между сотрудниками',
    responsible: 'Ответственный',
    notSelected: '— Не выбран —',
    queueMembers: 'Участники очереди',
    noUsers: 'Нет пользователей для выбора',
    saveAssignment: 'Сохранить распределение',
    facebookTitle: 'Facebook Lead Ads',
    facebookHint: 'Подключение лид-форм Meta/Facebook. В Meta App укажите Callback URL и Verify Token, а в CRM сохраните Page Access Token страницы.',
    publicPages: 'Публичные страницы для публикации Meta App',
    publicPagesHint: 'Эти ссылки можно вставить в Meta Developers в поля Privacy Policy URL и Data Deletion URL. Страницы открываются без входа в CRM.',
    open: 'Открыть',
    facebookEnabled: 'Принимать лиды из Facebook Lead Ads',
    messagesEnabled: 'Принимать сообщения из Instagram Direct и Facebook Messenger',
    metaCallback: 'Callback URL для Meta',
    messagesCallback: 'Callback URL для сообщений Instagram/Facebook',
    messagesHint: 'Этот URL добавляем в Meta Webhooks для событий сообщений. Verify Token общий, а Page Access Token можно указать отдельно для Facebook Messenger и Instagram Direct.',
    metaChecking: 'Проверяю Meta...',
    subscribeMeta: 'Подписать страницу на messages / message_echoes',
    facebookTokenPlaceholder: 'Токен страницы Facebook для Lead Ads и Messenger',
    facebookTokenHint: 'Используется для Facebook Lead Ads и исходящих сообщений Facebook Messenger.',
    instagramTokenPlaceholder: 'Токен для Instagram Direct',
    instagramTokenHint: 'Используется для профиля отправителя и ответов в Instagram Direct. Если поле пустое, CRM временно попробует Facebook token.',
    diagnosticsTitle: 'Диагностика Meta токенов',
    diagnosticsHint: 'Проверяет сохраненные токены, Page ID / Instagram account, приложение Meta и permissions для сообщений.',
    checking: 'Проверяю...',
    checkTokens: 'Проверить токены',
    newVerifyToken: 'Новый Verify Token',
    saveFacebook: 'Сохранить Facebook',
    googleSheetsTitle: 'Google Sheets',
    googleSheetsHint: 'Если лиды уже попадают в Google таблицу, можно поставить в таблицу Apps Script. Он отправит новую строку в CRM без Make и Zapier.',
    googleSheetsUrl: 'Webhook URL для Google Sheets',
    scriptHint: 'Первый запуск: один раз выполните markExistingRowsAsSent для старых строк. Триггер: sendLastRowToReziFlow, источник From spreadsheet, событие On change. Скрипт больше не добавляет видимые колонки и хранит отметки отправки внутри Apps Script properties.',
    copyScript: 'Копировать скрипт',
    telegramHint: 'Этот вариант нужен для группы, куда уже приходят уведомления. Создайте своего Telegram-бота, добавьте его в группу и установите webhook на URL ниже. Если Telegram даст боту читать сообщения WebJackBot, CRM будет создавать лиды из этих текстов.',
    telegramCommand: 'Команда для подключения webhook:',
    logsTitle: 'Журнал входящих заявок',
    logsHint: 'Последние 50 запросов из внешних форм и сервисов',
    showLogs: 'Показать журнал',
    collapse: 'Свернуть',
    refreshing: 'Обновляю...',
    refresh: 'Обновить',
    logsCollapsed: 'Журнал свернут. Записей загружено: {count}.',
    noLogs: 'Входящих заявок пока нет',
    date: 'Дата',
    status: 'Статус',
    source: 'Источник',
    lead: 'Лид',
    payloadError: 'Payload / ошибка',
    created: 'Создан',
    test: 'Тест',
    message: 'Сообщение',
    ignored: 'Пропущено',
    comment: 'Комментарий',
    service: 'Сервис',
    failed: 'Ошибка',
    rejected: 'Отклонен',
    showPayload: 'Показать payload',
    leadFallback: 'Лид',
    locale: 'ru-RU',
  },
  uk: {
    title: 'Інтеграції',
    subtitle: 'Підключення заявок із сайту, квізу, реклами та зовнішніх сервісів',
    back: 'Назад',
    loading: 'Завантаження...',
    loadFailed: 'Не вдалося завантажити інтеграції',
    saveFailed: 'Не вдалося зберегти інтеграції',
    storageSaveFailed: 'Не вдалося зберегти сховище документів',
    noDiagnostics: 'Немає даних діагностики',
    tokenNotSaved: 'Токен не збережено',
    metaRejected: 'Meta не прийняла токен',
    metaOk: 'Meta повернула OK',
    metaNeedsAttention: 'Перевірити',
    metaDebugNotConfigured: 'Для перевірки permissions додайте у Vercel META_APP_ID і META_APP_SECRET або META_APP_ACCESS_TOKEN.',
    metaDebugError: 'debug_token не спрацював',
    metaTokenApp: 'Meta App',
    metaTokenWrongApp: 'Токен виданий іншим застосунком. Очікуваний App ID: {appId}',
    metaTokenPermissionsOk: 'Потрібні permissions є в токені',
    metaTokenMissingPermissions: 'Не вистачає permissions',
    metaTokenExpires: 'Закінчується',
    metaAdvancedAccessHint: 'Якщо permissions є в токені, але реальні Instagram-ліди все одно блокуються, перевірте Advanced Access/App Review для instagram_manage_messages у Meta Developers і перепідключіть токен через цей самий застосунок.',
    storageTitle: 'Зберігання документів',
    storageHint: 'CRM завжди зберігає документ у Cloudinary як основне сховище. Якщо Dropbox підключено, туди додатково надсилається копія для папок організації.',
    storageEnabled: 'Робити копію нових документів у Dropbox',
    dropboxFolder: 'Папка в Dropbox',
    tokenSavedPlaceholder: 'Токен уже збережено. Вставте новий тільки для заміни.',
    show: 'Показати',
    hide: 'Сховати',
    saving: 'Зберігаю...',
    save: 'Зберегти',
    webhookTitle: 'Webhook для лідів',
    webhookHint: 'Цю адресу можна вказати у квізі, формі сайту, Make, Zapier або іншому сервісі. Кожна нова заявка створюватиме ліда в цій організації.',
    webhookEnabled: 'Приймати ліди через webhook',
    webliumUrl: 'Webhook URL для Weblium',
    webliumHidden: 'Покажіть ключ, щоб побачити URL для Weblium',
    copy: 'Копіювати',
    webliumHint: 'Використовуйте цей варіант, якщо сервіс не вміє надсилати заголовок x-reziflow-key.',
    accessKey: 'Ключ доступу',
    newKey: 'Новий ключ',
    regenerateConfirm: 'Пересоздати ключ? Старі підключення перестануть працювати.',
    keyHint: 'Ключ можна передавати в заголовку x-reziflow-key або як Bearer token в Authorization.',
    requestExample: 'Приклад запиту',
    requestHint: 'Мінімально достатньо передати ім’я, телефон, email, Instagram або Facebook. Інші поля можна додавати поступово.',
    mappingTitle: 'Мапінг полів',
    mappingHint: 'CRM уже автоматично розуміє часті назви на кшталт name, phone, telefon, email, usluga, service. Тут можна додати свої правила для конкретного квізу або форми.',
    addField: '+ Поле',
    noMapping: 'Ручних правил поки немає. Авторозпізнавання все одно працює.',
    externalFieldPlaceholder: 'Поле з форми, наприклад phone_number',
    delete: 'Видалити',
    saveMapping: 'Зберегти мапінг',
    assignmentTitle: 'Авторозподіл лідів',
    assignmentHint: 'Нові ліди з webhook можна одразу призначати відповідальному. Якщо зовнішній сервіс передасть assignedToId, він матиме пріоритет.',
    mode: 'Режим',
    modeOff: 'Не призначати автоматично',
    modeSingle: 'Призначати одного співробітника',
    modeRoundRobin: 'По черзі між співробітниками',
    responsible: 'Відповідальний',
    notSelected: '— Не вибрано —',
    queueMembers: 'Учасники черги',
    noUsers: 'Немає користувачів для вибору',
    saveAssignment: 'Зберегти розподіл',
    facebookTitle: 'Facebook Lead Ads',
    facebookHint: 'Підключення лід-форм Meta/Facebook. У Meta App вкажіть Callback URL і Verify Token, а в CRM збережіть Page Access Token сторінки.',
    publicPages: 'Публічні сторінки для публікації Meta App',
    publicPagesHint: 'Ці посилання можна вставити в Meta Developers у поля Privacy Policy URL і Data Deletion URL. Сторінки відкриваються без входу в CRM.',
    open: 'Відкрити',
    facebookEnabled: 'Приймати ліди з Facebook Lead Ads',
    messagesEnabled: 'Приймати повідомлення з Instagram Direct і Facebook Messenger',
    metaCallback: 'Callback URL для Meta',
    messagesCallback: 'Callback URL для повідомлень Instagram/Facebook',
    messagesHint: 'Цей URL додаємо в Meta Webhooks для подій повідомлень. Verify Token спільний, а Page Access Token можна вказати окремо для Facebook Messenger і Instagram Direct.',
    metaChecking: 'Перевіряю Meta...',
    subscribeMeta: 'Підписати сторінку на messages / message_echoes',
    facebookTokenPlaceholder: 'Токен сторінки Facebook для Lead Ads і Messenger',
    facebookTokenHint: 'Використовується для Facebook Lead Ads і вихідних повідомлень Facebook Messenger.',
    instagramTokenPlaceholder: 'Токен для Instagram Direct',
    instagramTokenHint: 'Використовується для профілю відправника і відповідей в Instagram Direct. Якщо поле порожнє, CRM тимчасово спробує Facebook token.',
    diagnosticsTitle: 'Діагностика Meta токенів',
    diagnosticsHint: 'Перевіряє збережені токени, Page ID / Instagram account, застосунок Meta і permissions для повідомлень.',
    checking: 'Перевіряю...',
    checkTokens: 'Перевірити токени',
    newVerifyToken: 'Новий Verify Token',
    saveFacebook: 'Зберегти Facebook',
    googleSheetsTitle: 'Google Sheets',
    googleSheetsHint: 'Якщо ліди вже потрапляють у Google таблицю, можна встановити Apps Script у таблицю. Він надсилатиме новий рядок у CRM без Make і Zapier.',
    googleSheetsUrl: 'Webhook URL для Google Sheets',
    scriptHint: 'Перший запуск: один раз виконайте markExistingRowsAsSent для старих рядків. Тригер: sendLastRowToReziFlow, джерело From spreadsheet, подія On change. Скрипт більше не додає видимі колонки і зберігає позначки відправки в Apps Script properties.',
    copyScript: 'Копіювати скрипт',
    telegramHint: 'Цей варіант потрібен для групи, куди вже приходять повідомлення. Створіть свого Telegram-бота, додайте його в групу і встановіть webhook на URL нижче. Якщо Telegram дасть боту читати повідомлення WebJackBot, CRM створюватиме ліди з цих текстів.',
    telegramCommand: 'Команда для підключення webhook:',
    logsTitle: 'Журнал вхідних заявок',
    logsHint: 'Останні 50 запитів із зовнішніх форм і сервісів',
    showLogs: 'Показати журнал',
    collapse: 'Згорнути',
    refreshing: 'Оновлюю...',
    refresh: 'Оновити',
    logsCollapsed: 'Журнал згорнуто. Завантажено записів: {count}.',
    noLogs: 'Вхідних заявок поки немає',
    date: 'Дата',
    status: 'Статус',
    source: 'Джерело',
    lead: 'Лід',
    payloadError: 'Payload / помилка',
    created: 'Створено',
    test: 'Тест',
    message: 'Повідомлення',
    ignored: 'Пропущено',
    comment: 'Коментар',
    service: 'Сервіс',
    failed: 'Помилка',
    rejected: 'Відхилено',
    showPayload: 'Показати payload',
    leadFallback: 'Лід',
    locale: 'uk-UA',
  },
  pl: {
    title: 'Integracje',
    subtitle: 'Podłączenie zgłoszeń ze strony, quizu, reklam i zewnętrznych serwisów',
    back: 'Wstecz',
    loading: 'Ładowanie...',
    loadFailed: 'Nie udało się załadować integracji',
    saveFailed: 'Nie udało się zapisać integracji',
    storageSaveFailed: 'Nie udało się zapisać przechowywania dokumentów',
    noDiagnostics: 'Brak danych diagnostycznych',
    tokenNotSaved: 'Token nie jest zapisany',
    metaRejected: 'Meta nie przyjęła tokenu',
    metaOk: 'Meta zwróciła OK',
    metaNeedsAttention: 'Sprawdź',
    metaDebugNotConfigured: 'Aby sprawdzić permissions, dodaj w Vercel META_APP_ID i META_APP_SECRET albo META_APP_ACCESS_TOKEN.',
    metaDebugError: 'debug_token nie zadziałał',
    metaTokenApp: 'Meta App',
    metaTokenWrongApp: 'Token został wydany przez inną aplikację. Oczekiwany App ID: {appId}',
    metaTokenPermissionsOk: 'Wymagane permissions są w tokenie',
    metaTokenMissingPermissions: 'Brakuje permissions',
    metaTokenExpires: 'Wygasa',
    metaAdvancedAccessHint: 'Jeśli permissions są w tokenie, ale prawdziwe leady z Instagrama nadal są blokowane, sprawdź Advanced Access/App Review dla instagram_manage_messages w Meta Developers i podłącz token ponownie przez tę samą aplikację.',
    storageTitle: 'Przechowywanie dokumentów',
    storageHint: 'CRM zawsze zapisuje dokument w Cloudinary jako głównym magazynie. Jeśli Dropbox jest podłączony, dodatkowa kopia trafia do folderów organizacji.',
    storageEnabled: 'Tworzyć kopię nowych dokumentów w Dropbox',
    dropboxFolder: 'Folder w Dropbox',
    tokenSavedPlaceholder: 'Token jest już zapisany. Wklej nowy tylko, aby go zmienić.',
    show: 'Pokaż',
    hide: 'Ukryj',
    saving: 'Zapisuję...',
    save: 'Zapisz',
    webhookTitle: 'Webhook dla leadów',
    webhookHint: 'Ten adres można podać w quizie, formularzu strony, Make, Zapier lub innym serwisie. Każde nowe zgłoszenie utworzy leada w tej organizacji.',
    webhookEnabled: 'Przyjmować leady przez webhook',
    webliumUrl: 'Webhook URL dla Weblium',
    webliumHidden: 'Pokaż klucz, aby zobaczyć URL dla Weblium',
    copy: 'Kopiuj',
    webliumHint: 'Użyj tej opcji, jeśli serwis nie umie wysłać nagłówka x-reziflow-key.',
    accessKey: 'Klucz dostępu',
    newKey: 'Nowy klucz',
    regenerateConfirm: 'Wygenerować klucz ponownie? Stare podłączenia przestaną działać.',
    keyHint: 'Klucz można przekazywać w nagłówku x-reziflow-key albo jako Bearer token w Authorization.',
    requestExample: 'Przykład zapytania',
    requestHint: 'Minimalnie wystarczy przekazać imię, telefon, email, Instagram albo Facebook. Pozostałe pola można dodawać stopniowo.',
    mappingTitle: 'Mapowanie pól',
    mappingHint: 'CRM automatycznie rozumie częste nazwy, np. name, phone, telefon, email, usluga, service. Tutaj można dodać własne reguły dla konkretnego quizu lub formularza.',
    addField: '+ Pole',
    noMapping: 'Nie ma jeszcze ręcznych reguł. Automatyczne rozpoznawanie nadal działa.',
    externalFieldPlaceholder: 'Pole z formularza, np. phone_number',
    delete: 'Usuń',
    saveMapping: 'Zapisz mapowanie',
    assignmentTitle: 'Automatyczny przydział leadów',
    assignmentHint: 'Nowe leady z webhook można od razu przypisywać osobie odpowiedzialnej. Jeśli zewnętrzny serwis przekaże assignedToId, będzie miał priorytet.',
    mode: 'Tryb',
    modeOff: 'Nie przypisywać automatycznie',
    modeSingle: 'Przypisywać jednego pracownika',
    modeRoundRobin: 'Po kolei między pracownikami',
    responsible: 'Odpowiedzialny',
    notSelected: '— Nie wybrano —',
    queueMembers: 'Uczestnicy kolejki',
    noUsers: 'Brak użytkowników do wyboru',
    saveAssignment: 'Zapisz przydział',
    facebookTitle: 'Facebook Lead Ads',
    facebookHint: 'Podłączenie formularzy leadowych Meta/Facebook. W Meta App podaj Callback URL i Verify Token, a w CRM zapisz Page Access Token strony.',
    publicPages: 'Publiczne strony dla publikacji Meta App',
    publicPagesHint: 'Te linki można wkleić w Meta Developers w pola Privacy Policy URL i Data Deletion URL. Strony otwierają się bez logowania do CRM.',
    open: 'Otwórz',
    facebookEnabled: 'Przyjmować leady z Facebook Lead Ads',
    messagesEnabled: 'Przyjmować wiadomości z Instagram Direct i Facebook Messenger',
    metaCallback: 'Callback URL dla Meta',
    messagesCallback: 'Callback URL dla wiadomości Instagram/Facebook',
    messagesHint: 'Ten URL dodajemy w Meta Webhooks dla zdarzeń wiadomości. Verify Token jest wspólny, a Page Access Token można podać osobno dla Facebook Messenger i Instagram Direct.',
    metaChecking: 'Sprawdzam Meta...',
    subscribeMeta: 'Subskrybuj stronę na messages / message_echoes',
    facebookTokenPlaceholder: 'Token strony Facebook dla Lead Ads i Messenger',
    facebookTokenHint: 'Używany dla Facebook Lead Ads i wiadomości wychodzących Facebook Messenger.',
    instagramTokenPlaceholder: 'Token dla Instagram Direct',
    instagramTokenHint: 'Używany dla profilu nadawcy i odpowiedzi w Instagram Direct. Jeśli pole jest puste, CRM tymczasowo spróbuje użyć Facebook token.',
    diagnosticsTitle: 'Diagnostyka tokenów Meta',
    diagnosticsHint: 'Sprawdza zapisane tokeny, Page ID / Instagram account, aplikację Meta i permissions dla wiadomości.',
    checking: 'Sprawdzam...',
    checkTokens: 'Sprawdź tokeny',
    newVerifyToken: 'Nowy Verify Token',
    saveFacebook: 'Zapisz Facebook',
    googleSheetsTitle: 'Google Sheets',
    googleSheetsHint: 'Jeśli leady już trafiają do arkusza Google, można dodać Apps Script w arkuszu. Wyśle nowy wiersz do CRM bez Make i Zapier.',
    googleSheetsUrl: 'Webhook URL dla Google Sheets',
    scriptHint: 'Pierwsze uruchomienie: wykonaj raz markExistingRowsAsSent dla starych wierszy. Trigger: sendLastRowToReziFlow, źródło From spreadsheet, zdarzenie On change. Skrypt nie dodaje już widocznych kolumn i przechowuje znaczniki wysyłki w Apps Script properties.',
    copyScript: 'Kopiuj skrypt',
    telegramHint: 'Ta opcja jest potrzebna dla grupy, do której już trafiają powiadomienia. Utwórz własnego bota Telegram, dodaj go do grupy i ustaw webhook na URL poniżej. Jeśli Telegram pozwoli botowi czytać wiadomości WebJackBot, CRM będzie tworzyć leady z tych tekstów.',
    telegramCommand: 'Komenda do podłączenia webhook:',
    logsTitle: 'Dziennik przychodzących zgłoszeń',
    logsHint: 'Ostatnie 50 zapytań z zewnętrznych formularzy i serwisów',
    showLogs: 'Pokaż dziennik',
    collapse: 'Zwiń',
    refreshing: 'Odświeżam...',
    refresh: 'Odśwież',
    logsCollapsed: 'Dziennik zwinięty. Załadowano wpisów: {count}.',
    noLogs: 'Brak przychodzących zgłoszeń',
    date: 'Data',
    status: 'Status',
    source: 'Źródło',
    lead: 'Lead',
    payloadError: 'Payload / błąd',
    created: 'Utworzono',
    test: 'Test',
    message: 'Wiadomość',
    ignored: 'Pominięto',
    comment: 'Komentarz',
    service: 'Serwis',
    failed: 'Błąd',
    rejected: 'Odrzucono',
    showPayload: 'Pokaż payload',
    leadFallback: 'Lead',
    locale: 'pl-PL',
  },
}

const targetFieldLabels: Record<'uk' | 'pl', Record<string, string>> = {
  uk: {
    firstName: 'Ім’я', lastName: 'Прізвище', fullName: 'Повне ім’я', phone: 'Телефон', city: 'Місто',
    country: 'Країна / громадянство', language: 'Мова', serviceInterest: 'Цікава послуга', budget: 'Бюджет',
    urgency: 'Терміновість', notes: 'Нотатки', source: 'Джерело', nextContactAt: 'Наступний контакт',
    nextContactNote: 'Про що сконтактувати',
  },
  pl: {
    firstName: 'Imię', lastName: 'Nazwisko', fullName: 'Pełne imię i nazwisko', phone: 'Telefon', city: 'Miasto',
    country: 'Kraj / obywatelstwo', language: 'Język', serviceInterest: 'Interesująca usługa', budget: 'Budżet',
    urgency: 'Pilność', notes: 'Notatki', source: 'Źródło', nextContactAt: 'Następny kontakt',
    nextContactNote: 'W sprawie kontaktu',
  },
}

const metaOAuthText = {
  ru: {
    title: 'Подключение Meta через CRM',
    hint: 'Администратор входит в Meta, выбирает Facebook Page и привязанный Instagram Business аккаунт. Токен сохраняется только для текущей организации.',
    connected: 'Подключено',
    notConnected: 'Не подключено',
    connect: 'Подключить Meta',
    reconnect: 'Переподключить Meta',
    connecting: 'Открываю Meta...',
    page: 'Страница',
    instagram: 'Instagram',
    noInstagram: 'Instagram Business аккаунт не найден у выбранной страницы',
    selectTitle: 'Выберите страницу Meta',
    selectHint: 'Meta вернула несколько страниц. Выберите ту, с которой CRM должна принимать и отправлять сообщения.',
    choosePage: 'Выберите страницу',
    usePage: 'Использовать эту страницу',
    selecting: 'Подключаю...',
    manualTitle: 'Ручной режим и технические поля',
    manualHint: 'Оставлено как резерв: callback URL, verify token и ручная вставка Page Access Token.',
    subscriptionWarning: 'Подписка на сообщения требует внимания',
    connectedAs: 'Meta-пользователь',
    noPages: 'Страницы пока не загружены. Нажмите «Подключить Meta».',
  },
  uk: {
    title: 'Підключення Meta через CRM',
    hint: 'Адміністратор входить у Meta, вибирає Facebook Page і прив’язаний Instagram Business акаунт. Токен зберігається тільки для поточної організації.',
    connected: 'Підключено',
    notConnected: 'Не підключено',
    connect: 'Підключити Meta',
    reconnect: 'Перепідключити Meta',
    connecting: 'Відкриваю Meta...',
    page: 'Сторінка',
    instagram: 'Instagram',
    noInstagram: 'Instagram Business акаунт не знайдено у вибраної сторінки',
    selectTitle: 'Виберіть сторінку Meta',
    selectHint: 'Meta повернула кілька сторінок. Виберіть ту, з якої CRM має приймати і надсилати повідомлення.',
    choosePage: 'Виберіть сторінку',
    usePage: 'Використати цю сторінку',
    selecting: 'Підключаю...',
    manualTitle: 'Ручний режим і технічні поля',
    manualHint: 'Залишено як резерв: callback URL, verify token і ручна вставка Page Access Token.',
    subscriptionWarning: 'Підписка на повідомлення потребує уваги',
    connectedAs: 'Meta-користувач',
    noPages: 'Сторінки поки не завантажені. Натисніть «Підключити Meta».',
  },
  pl: {
    title: 'Połączenie Meta przez CRM',
    hint: 'Administrator loguje się do Meta, wybiera Facebook Page i powiązane konto Instagram Business. Token jest zapisywany tylko dla bieżącej organizacji.',
    connected: 'Połączono',
    notConnected: 'Nie połączono',
    connect: 'Połącz Meta',
    reconnect: 'Połącz ponownie Meta',
    connecting: 'Otwieram Meta...',
    page: 'Strona',
    instagram: 'Instagram',
    noInstagram: 'Nie znaleziono konta Instagram Business dla wybranej strony',
    selectTitle: 'Wybierz stronę Meta',
    selectHint: 'Meta zwróciła kilka stron. Wybierz tę, z której CRM ma odbierać i wysyłać wiadomości.',
    choosePage: 'Wybierz stronę',
    usePage: 'Użyj tej strony',
    selecting: 'Łączę...',
    manualTitle: 'Tryb ręczny i pola techniczne',
    manualHint: 'Zostawione jako rezerwa: callback URL, verify token i ręczne wklejenie Page Access Token.',
    subscriptionWarning: 'Subskrypcja wiadomości wymaga uwagi',
    connectedAs: 'Użytkownik Meta',
    noPages: 'Strony nie zostały jeszcze załadowane. Kliknij „Połącz Meta”.',
  },
}

const DEFAULT_FACEBOOK_DRAFT: FacebookLeadSettings = {
  enabled: false,
  messagesEnabled: false,
  verifyToken: '',
  pageAccessToken: '',
  instagramPageAccessToken: '',
  apiVersion: 'v23.0',
  oauth: {
    connected: false,
    pendingPages: [],
  },
}

function metaAccountSummary(account?: { id?: string; name?: string; username?: string } | null) {
  if (!account) return ''
  return [
    account.username ? `@${account.username}` : '',
    account.name || '',
    account.id ? `ID ${account.id}` : '',
  ].filter(Boolean).join(' · ')
}

function metaDiagnosticDetails(item: MetaTokenDiagnostic | undefined, text: typeof integrationText.ru) {
  if (!item) return text.noDiagnostics
  if (!item.configured) return text.tokenNotSaved
  if (!item.ok) return item.error || text.metaRejected

  const page = metaAccountSummary(item.data)
  const instagramBusiness = metaAccountSummary(item.data?.instagram_business_account)
  const connectedInstagram = metaAccountSummary(item.data?.connected_instagram_account)
  const debug = item.debug
  const debugDetails: string[] = []

  if (debug) {
    if (!debug.configured) {
      debugDetails.push(text.metaDebugNotConfigured)
    } else if (debug.ok === false) {
      debugDetails.push(`${text.metaDebugError}: ${debug.error || text.metaRejected}`)
    } else {
      const app = [debug.appName, debug.appId ? `App ID ${debug.appId}` : ''].filter(Boolean).join(' · ')
      if (app) debugDetails.push(`${text.metaTokenApp}: ${app}`)
      if (debug.expectedAppId && debug.appMatchesExpected === false) {
        debugDetails.push(text.metaTokenWrongApp.replace('{appId}', debug.expectedAppId))
      }
      if (debug.missingPermissions?.length) {
        debugDetails.push(`${text.metaTokenMissingPermissions}: ${debug.missingPermissions.join(', ')}`)
      } else if (debug.requiredPermissions?.length) {
        debugDetails.push(text.metaTokenPermissionsOk)
      }
      if (debug.expiresAt) {
        debugDetails.push(`${text.metaTokenExpires}: ${new Date(debug.expiresAt * 1000).toLocaleDateString(text.locale)}`)
      }
    }
  }

  return [
    page || text.metaOk,
    instagramBusiness ? `Instagram Business: ${instagramBusiness}` : '',
    connectedInstagram ? `Connected Instagram: ${connectedInstagram}` : '',
    ...debugDetails,
  ].filter(Boolean).join(' | ')
}

export default function IntegrationsPage() {
  const { lang } = useLanguage()
  const text = integrationText[lang] || integrationText.ru
  const metaText = metaOAuthText[lang] || metaOAuthText.ru
  const [settings, setSettings] = useState<WebhookSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsCollapsed, setLogsCollapsed] = useState(false)
  const [fieldMapDraft, setFieldMapDraft] = useState<FieldMapRow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentSettings>({ mode: 'off', userId: null, userIds: [] })
  const [facebookDraft, setFacebookDraft] = useState<FacebookLeadSettings>(DEFAULT_FACEBOOK_DRAFT)
  const [showFacebookToken, setShowFacebookToken] = useState(false)
  const [showInstagramToken, setShowInstagramToken] = useState(false)
  const [metaSubscriptionLoading, setMetaSubscriptionLoading] = useState(false)
  const [metaSubscriptionStatus, setMetaSubscriptionStatus] = useState('')
  const [metaDiagnosticsLoading, setMetaDiagnosticsLoading] = useState(false)
  const [metaDiagnostics, setMetaDiagnostics] = useState<MetaTokenDiagnostics | null>(null)
  const [metaOAuthLoading, setMetaOAuthLoading] = useState(false)
  const [metaOAuthSelecting, setMetaOAuthSelecting] = useState(false)
  const [metaOAuthPageId, setMetaOAuthPageId] = useState('')
  const [storageSettings, setStorageSettings] = useState<StorageSettings | null>(null)
  const [storageDraft, setStorageDraft] = useState<StorageSettings['dropbox']>({ enabled: false, rootFolder: '/LegalHub', hasAccessToken: false, accessToken: '' })
  const [showDropboxToken, setShowDropboxToken] = useState(false)

  const webhookUrl = useMemo(() => {
    if (!settings || typeof window === 'undefined') return ''
    return `${window.location.origin}/api/webhooks/leads/${settings.slug}`
  }, [settings])
  const webliumWebhookUrl = useMemo(() => {
    if (!webhookUrl || !settings?.key) return ''
    return `${webhookUrl}/${encodeURIComponent(settings.key)}`
  }, [webhookUrl, settings?.key])
  const facebookCallbackUrl = useMemo(() => {
    if (!settings || typeof window === 'undefined') return ''
    return `${window.location.origin}/api/webhooks/meta/leads/${settings.slug}`
  }, [settings])
  const facebookMessagesCallbackUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/api/webhooks/meta/messages`
  }, [])
  const privacyPolicyUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/privacy`
  }, [])
  const dataDeletionUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/data-deletion`
  }, [])
  const telegramWebhookUrl = useMemo(() => {
    if (!settings || typeof window === 'undefined' || !settings.key) return ''
    return `${window.location.origin}/api/webhooks/telegram/leads/${settings.slug}/${encodeURIComponent(settings.key)}`
  }, [settings])
  const googleSheetsScript = useMemo(() => {
    if (!webliumWebhookUrl) return ''
    return `const REZIFLOW_WEBHOOK_URL = '${webliumWebhookUrl}';
const REZIFLOW_SENT_PREFIX = 'reziflow_sent_';

function normalizeColumnName(value) {
  return String(value || '').trim().toLowerCase();
}

function pick(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') {
      return row[name];
    }
  }
  const normalizedNames = names.map(normalizeColumnName);
  for (const key of Object.keys(row)) {
    if (normalizedNames.indexOf(normalizeColumnName(key)) >= 0 && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return '';
}

function buildNextContactAt(preferredHours) {
  const text = String(preferredHours || '').trim();
  if (!text) return '';

  const match = text.match(/(\\d{1,2})(?:[.:](\\d{2}))?/);
  if (!match) return '';

  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';

  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return Utilities.formatDate(next, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function normalizeReziFlowPayload(row) {
  const firstName = pick(row, ["Ім'я", "Имя", "Name", "name", "firstName"]);
  const phone = pick(row, ["Контактний номер", "Контактный номер", "Телефон", "phone", "Phone"]);
  const interest = pick(row, ["Прізвище", "Интерес", "Услуга", "serviceInterest", "Service"]);
  const preferredHours = pick(row, ["Години", "Годины", "Час", "Время"]);
  const requestDate = pick(row, ["E-mail", "Email", "Дата заявки", "Дата"]);
  const notes = pick(row, ["Нотатки", "Заметки", "Notes", "notes"]);

  return {
    firstName: String(firstName || '').trim(),
    phone: String(phone || '').trim(),
    serviceInterest: String(interest || '').trim(),
    source: 'target',
    nextContactAt: buildNextContactAt(preferredHours),
    nextContactNote: preferredHours ? 'Перезвонить в окно: ' + preferredHours : '',
    notes: [
      requestDate ? 'Дата заявки: ' + requestDate : '',
      notes ? 'Заметки: ' + notes : '',
    ].filter(Boolean).join('\\n'),
    rawSheetRow: row,
  };
}

function postToReziFlow(row) {
  const payload = normalizeReziFlowPayload(row);

  if (!payload.firstName && !payload.phone && !payload.serviceInterest) {
    return false;
  }

  const response = UrlFetchApp.fetch(REZIFLOW_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('ReziFlow webhook failed: ' + code + ' ' + response.getContentText());
  }

  return true;
}

function rowToObject(headers, row) {
  const rowObject = {};
  headers.forEach((header, index) => {
    if (header) rowObject[header] = row[index];
  });
  return rowObject;
}

function rowSentKey(rowObject) {
  const json = JSON.stringify(rowObject);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, json);
  return REZIFLOW_SENT_PREFIX + Utilities.base64EncodeWebSafe(digest);
}

function sendLastRowToReziFlow() {
  sendNewRowsToReziFlow();
}

function sendNewRowsToReziFlow() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;

  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return;

    const headers = values[0].map(String);
    const properties = PropertiesService.getDocumentProperties();

    for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
      const row = values[rowIndex];
      const rowObject = rowToObject(headers, row);
      const key = rowSentKey(rowObject);
      if (properties.getProperty(key)) continue;

      if (postToReziFlow(rowObject)) {
        properties.setProperty(key, new Date().toISOString());
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function markExistingRowsAsSent() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  const headers = values[0].map(String);
  const properties = PropertiesService.getDocumentProperties();
  const now = new Date();

  values.slice(1).forEach((row) => {
    const rowObject = rowToObject(headers, row);
    properties.setProperty(rowSentKey(rowObject), now.toISOString());
  });
}

function onFormSubmit(e) {
  const rowObject = {};
  const namedValues = e && e.namedValues ? e.namedValues : {};

  Object.keys(namedValues).forEach((key) => {
    const value = namedValues[key];
    rowObject[key] = Array.isArray(value) ? value.join(', ') : value;
  });

  postToReziFlow(rowObject);
}`
  }, [webliumWebhookUrl])

  useEffect(() => {
    loadSettings()
    loadLogs()
    loadUsers()
    loadStorageSettings()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const metaError = params.get('meta_error')
    const oauthStatus = params.get('meta_oauth')
    if (metaError) setError(metaError)
    if (oauthStatus === 'select') setMetaSubscriptionStatus(metaText.selectTitle)
    if (metaError || oauthStatus) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [metaText.selectTitle])

  async function loadSettings() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/lead-webhook-settings', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || text.loadFailed)
        return
      }
      setSettings(data)
      setFieldMapDraft(Array.isArray(data.fieldMap) ? data.fieldMap : [])
      setAssignmentDraft(data.assignment || { mode: 'off', userId: null, userIds: [] })
      const nextFacebook = { ...DEFAULT_FACEBOOK_DRAFT, ...(data.facebook || {}) }
      setFacebookDraft(nextFacebook)
      const pendingPages: MetaOAuthPageOption[] = nextFacebook.oauth?.pendingPages || []
      setMetaOAuthPageId(current => pendingPages.some(page => page.id === current) ? current : pendingPages[0]?.id || '')
    } finally {
      setLoading(false)
    }
  }

  async function updateSettings(patch: Record<string, unknown>) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/lead-webhook-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || text.saveFailed)
        return
      }
      setSettings(data)
      if (Array.isArray(data.fieldMap)) setFieldMapDraft(data.fieldMap)
      if (data.assignment) setAssignmentDraft(data.assignment)
      if (data.facebook) {
        const nextFacebook = { ...DEFAULT_FACEBOOK_DRAFT, ...data.facebook }
        setFacebookDraft(nextFacebook)
        const pendingPages: MetaOAuthPageOption[] = nextFacebook.oauth?.pendingPages || []
        setMetaOAuthPageId(current => pendingPages.some(page => page.id === current) ? current : pendingPages[0]?.id || '')
      }
    } finally {
      setSaving(false)
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
  }

  async function loadLogs() {
    setLogsLoading(true)
    try {
      const res = await fetch('/api/lead-webhook-logs', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setLogs(Array.isArray(data) ? data : [])
    } finally {
      setLogsLoading(false)
    }
  }

  async function loadUsers() {
    const res = await fetch('/api/users', { cache: 'no-store' })
    const data = await res.json().catch(() => [])
    if (res.ok) setUsers(Array.isArray(data) ? data : [])
  }

  async function loadStorageSettings() {
    const res = await fetch('/api/storage-settings', { cache: 'no-store' })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.dropbox) {
      setStorageSettings(data)
      setStorageDraft({ ...data.dropbox, accessToken: '' })
    }
  }

  async function saveStorageSettings() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/storage-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dropbox: storageDraft }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || text.storageSaveFailed)
        return
      }
      setStorageSettings(data)
      setStorageDraft({ ...data.dropbox, accessToken: '' })
    } finally {
      setSaving(false)
    }
  }

  function leadName(lead: WebhookLog['lead']) {
    if (!lead) return ''
    return lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.phone || lead.email || text.leadFallback
  }

  function payloadSummary(payload?: Record<string, unknown> | null) {
    const metaEvent = payload && typeof payload === 'object' ? (payload as any).metaEvent : null
    if (metaEvent && typeof metaEvent === 'object') {
      return [
        `Meta event: ${metaEvent.kind || 'unknown'}`,
        `echo: ${metaEvent.isEcho ? 'yes' : 'no'}`,
        `text: ${metaEvent.hasText ? 'yes' : 'no'}`,
        `keys: ${Array.isArray(metaEvent.eventKeys) ? metaEvent.eventKeys.join(', ') : '—'}`,
      ].join(' · ')
    }
    const metaChange = payload && typeof payload === 'object' ? (payload as any).metaChange : null
    if (metaChange && typeof metaChange === 'object') {
      const author = metaChange.username ? `@${metaChange.username}` : metaChange.fromId || 'unknown'
      const text = metaChange.text ? `: ${metaChange.text}` : ''
      const media = metaChange.mediaProductType ? ` · ${metaChange.mediaProductType}` : ''
      return `Meta change: ${metaChange.kind || 'change'} · ${author}${media}${text}`
    }
    return payload ? Object.entries(payload).slice(0, 4).map(([key, value]) => `${key}: ${typeof value === 'object' && value !== null ? '[object]' : String(value)}`).join(', ') : ''
  }

  function payloadJson(payload?: Record<string, unknown> | null) {
    if (!payload) return ''
    try {
      return JSON.stringify(payload, null, 2)
    } catch {
      return String(payload)
    }
  }

  function updateFieldMapRow(index: number, patch: Partial<FieldMapRow>) {
    setFieldMapDraft(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  }

  function addFieldMapRow() {
    setFieldMapDraft(current => [...current, { external: '', target: 'phone' }])
  }

  function removeFieldMapRow(index: number) {
    setFieldMapDraft(current => current.filter((_, rowIndex) => rowIndex !== index))
  }

  function saveFieldMap() {
    updateSettings({
      fieldMap: fieldMapDraft
        .map(row => ({ external: row.external.trim(), target: row.target }))
        .filter(row => row.external && row.target),
    })
  }

  function toggleRoundRobinUser(userId: number) {
    setAssignmentDraft(current => ({
      ...current,
      userIds: current.userIds.includes(userId)
        ? current.userIds.filter(id => id !== userId)
        : [...current.userIds, userId],
    }))
  }

  function saveAssignment() {
    updateSettings({ assignment: assignmentDraft })
  }

  function saveFacebookSettings(patch?: Partial<FacebookLeadSettings>) {
    updateSettings({ facebook: { ...facebookDraft, ...patch } })
  }

  function metaPageLabel(page: MetaOAuthPageOption) {
    const instagram = page.instagramBusinessAccount || page.connectedInstagramAccount
    return [
      `${page.name} (ID ${page.id})`,
      instagram?.username ? `Instagram @${instagram.username}` : '',
    ].filter(Boolean).join(' · ')
  }

  function metaConnectionDate(value?: string) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString(text.locale)
  }

  function startMetaOAuth() {
    setMetaOAuthLoading(true)
    setError('')
    window.location.href = '/api/meta/oauth/start'
  }

  async function selectMetaOAuthPage() {
    if (!metaOAuthPageId) {
      setError(metaText.choosePage)
      return
    }
    setMetaOAuthSelecting(true)
    setError('')
    setMetaSubscriptionStatus('')
    try {
      const res = await fetch('/api/meta/oauth/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: metaOAuthPageId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || text.saveFailed)
        return
      }
      if (data.subscriptionError) setMetaSubscriptionStatus(`${metaText.subscriptionWarning}: ${data.subscriptionError}`)
      await loadSettings()
    } finally {
      setMetaOAuthSelecting(false)
    }
  }

  async function subscribeMetaPage() {
    setMetaSubscriptionLoading(true)
    setMetaSubscriptionStatus('')
    setError('')
    try {
      await updateSettings({ facebook: facebookDraft })
      const res = await fetch('/api/meta/subscriptions', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMetaSubscriptionStatus(data.error || 'Meta не приняла подписку страницы')
        return
      }
      const app = Array.isArray(data.apps) ? data.apps.find((item: any) => Array.isArray(item.subscribed_fields)) : null
      const fields = Array.isArray(app?.subscribed_fields) ? app.subscribed_fields.join(', ') : 'messages, message_echoes'
      setMetaSubscriptionStatus(`Страница ${data.page?.name || data.page?.id || ''} подписана. Поля: ${fields}`)
    } finally {
      setMetaSubscriptionLoading(false)
    }
  }

  async function runMetaTokenDiagnostics() {
    setMetaDiagnosticsLoading(true)
    setMetaDiagnostics(null)
    setMetaSubscriptionStatus('')
    setError('')
    try {
      await updateSettings({ facebook: facebookDraft })
      const res = await fetch('/api/meta/token-diagnostics', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || text.saveFailed)
        return
      }
      setMetaDiagnostics(data)
    } finally {
      setMetaDiagnosticsLoading(false)
    }
  }

  const maskedKey = settings?.key ? `${settings.key.slice(0, 8)}••••••••••••${settings.key.slice(-6)}` : ''
  const targetLabel = (field: { value: string; label: string }) => targetFieldLabels[lang as 'uk' | 'pl']?.[field.value] || field.label
  const metaOAuth = facebookDraft.oauth
  const pendingMetaPages = metaOAuth?.pendingPages || []
  const selectedMetaPage = pendingMetaPages.find(page => page.id === metaOAuthPageId) || pendingMetaPages[0]

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{text.title}</div>
          <div className="page-subtitle">{text.subtitle}</div>
        </div>
        <Link href="/settings" className="btn btn-secondary">{text.back}</Link>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="card">{text.loading}</div>
        ) : settings ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)', gap: 16, alignItems: 'start' }}>
            {storageSettings && (
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <div className="section-title" style={{ marginBottom: 4 }}><span>📁</span>{text.storageTitle}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
                   {text.storageHint}
                  </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={storageDraft.enabled}
                    disabled={!storageSettings.canManage || saving}
                    onChange={event => setStorageDraft(current => ({ ...current, enabled: event.target.checked }))}
                  />
                   {text.storageEnabled}
                  </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(260px, 1.3fr) auto', gap: 10, alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">{text.dropboxFolder}</label>
                    <input
                      className="input"
                      value={storageDraft.rootFolder}
                      disabled={!storageSettings.canManage || saving}
                      onChange={event => setStorageDraft(current => ({ ...current, rootFolder: event.target.value }))}
                      placeholder="/LegalHub"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">Dropbox Access Token</label>
                    <input
                      className="input"
                      type={showDropboxToken ? 'text' : 'password'}
                      value={storageDraft.accessToken || ''}
                      disabled={!storageSettings.canManage || saving}
                      onChange={event => setStorageDraft(current => ({ ...current, accessToken: event.target.value }))}
                      placeholder={storageDraft.hasAccessToken ? text.tokenSavedPlaceholder : 'sl....'}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" type="button" onClick={() => setShowDropboxToken(value => !value)}>
                      {showDropboxToken ? text.hide : text.show}
                    </button>
                    <button className="btn btn-primary" type="button" onClick={saveStorageSettings} disabled={!storageSettings.canManage || saving}>
                      {saving ? text.saving : text.save}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="card">
              <div className="section-title"><span>🔌</span>{text.webhookTitle}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                {text.webhookHint}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={event => updateSettings({ enabled: event.target.checked })}
                  disabled={saving}
                />
                {text.webhookEnabled}
              </label>

              <div className="form-group">
                <label className="label">Webhook URL</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input className="input" readOnly value={webhookUrl} />
                  <button className="btn btn-secondary" type="button" onClick={() => copy(webhookUrl)}>Копировать</button>
                </div>
              </div>

              <div className="form-group">
                <label className="label">{text.webliumUrl}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input className="input" readOnly value={showKey ? webliumWebhookUrl : text.webliumHidden} />
                  <button className="btn btn-secondary" type="button" onClick={() => copy(webliumWebhookUrl)} disabled={!showKey}>{text.copy}</button>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                  {text.webliumHint}
                </div>
              </div>

              <div className="form-group">
                <label className="label">{text.accessKey}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8 }}>
                  <input className="input" readOnly value={showKey ? settings.key : maskedKey} />
                  <button className="btn btn-secondary" type="button" onClick={() => setShowKey(value => !value)}>{showKey ? text.hide : text.show}</button>
                  <button className="btn btn-secondary" type="button" onClick={() => copy(settings.key)}>{text.copy}</button>
                  <button className="btn btn-danger" type="button" disabled={saving} onClick={() => {
                    if (confirm(text.regenerateConfirm)) updateSettings({ regenerateKey: true })
                  }}>{text.newKey}</button>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--muted)' }}>
                {text.keyHint}
              </div>
            </div>

            <div className="card">
              <div className="section-title"><span>🧪</span>{text.requestExample}</div>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#0f172a', color: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.5, overflowX: 'auto' }}>
{`POST ${webhookUrl}
x-reziflow-key: ${showKey ? settings.key : 'YOUR_KEY'}
Content-Type: application/json

${samplePayload}`}
              </pre>
              <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
                {text.requestHint}
              </div>
            </div>
          </div>
        ) : null}

        {!loading && settings && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div>
                <div className="section-title" style={{ marginBottom: 4 }}><span>⇄</span>{text.mappingTitle}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
                  {text.mappingHint}
                </div>
              </div>
              <button type="button" className="btn btn-secondary" onClick={addFieldMapRow}>{text.addField}</button>
            </div>

            {fieldMapDraft.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '10px 0' }}>{text.noMapping}</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {fieldMapDraft.map((row, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr) auto', gap: 10, alignItems: 'center' }}>
                    <input
                      className="input"
                      value={row.external}
                      onChange={event => updateFieldMapRow(index, { external: event.target.value })}
                      placeholder={text.externalFieldPlaceholder}
                    />
                    <select className="input" value={row.target} onChange={event => updateFieldMapRow(index, { target: event.target.value })}>
                      {targetFields.map(field => <option key={field.value} value={field.value}>{targetLabel(field)}</option>)}
                    </select>
                    <button type="button" className="btn btn-danger" onClick={() => removeFieldMapRow(index)}>{text.delete}</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className="btn btn-primary" onClick={saveFieldMap} disabled={saving}>
                {saving ? text.saving : text.saveMapping}
              </button>
            </div>
          </div>
        )}

        {!loading && settings && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title" style={{ marginBottom: 4 }}><span>👤</span>{text.assignmentTitle}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
              {text.assignmentHint}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) 1fr', gap: 16, alignItems: 'start' }}>
              <div className="form-group">
                <label className="label">{text.mode}</label>
                <select
                  className="input"
                  value={assignmentDraft.mode}
                  onChange={event => setAssignmentDraft(current => ({ ...current, mode: event.target.value as AssignmentSettings['mode'] }))}
                >
                  <option value="off">{text.modeOff}</option>
                  <option value="single">{text.modeSingle}</option>
                  <option value="round_robin">{text.modeRoundRobin}</option>
                </select>
              </div>

              {assignmentDraft.mode === 'single' && (
                <div className="form-group">
                  <label className="label">{text.responsible}</label>
                  <select
                    className="input"
                    value={assignmentDraft.userId || ''}
                    onChange={event => setAssignmentDraft(current => ({ ...current, userId: event.target.value ? Number(event.target.value) : null }))}
                  >
                    <option value="">{text.notSelected}</option>
                    {users.map(user => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}
                  </select>
                </div>
              )}

              {assignmentDraft.mode === 'round_robin' && (
                <div>
                  <div className="label" style={{ marginBottom: 8 }}>{text.queueMembers}</div>
                  {users.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>{text.noUsers}</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                      {users.map(user => (
                        <label key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 8, padding: 10, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={assignmentDraft.userIds.includes(user.id)}
                            onChange={() => toggleRoundRobinUser(user.id)}
                          />
                          <span>
                            <span style={{ display: 'block', fontWeight: 700 }}>{user.name}</span>
                            <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>{user.email}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className="btn btn-primary" onClick={saveAssignment} disabled={saving}>
                {saving ? text.saving : text.saveAssignment}
              </button>
            </div>
          </div>
        )}

        {!loading && settings && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title" style={{ marginBottom: 4 }}><span>📣</span>{text.facebookTitle}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
              {text.facebookHint}
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>{text.publicPages}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
                {text.publicPagesHint}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto auto', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Privacy Policy</span>
                  <input className="input" readOnly value={privacyPolicyUrl} />
                  <a className="btn btn-secondary" href="/privacy" target="_blank" rel="noreferrer">{text.open}</a>
                  <button className="btn btn-secondary" type="button" onClick={() => copy(privacyPolicyUrl)}>{text.copy}</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto auto', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Data Deletion</span>
                  <input className="input" readOnly value={dataDeletionUrl} />
                  <a className="btn btn-secondary" href="/data-deletion" target="_blank" rel="noreferrer">{text.open}</a>
                  <button className="btn btn-secondary" type="button" onClick={() => copy(dataDeletionUrl)}>{text.copy}</button>
                </div>
              </div>
            </div>

            <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 4 }}>{metaText.title}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, maxWidth: 820 }}>
                    {metaText.hint}
                  </div>
                </div>
                <span style={{
                  borderRadius: 999,
                  padding: '6px 10px',
                  background: metaOAuth?.connected ? '#dcfce7' : '#fff7ed',
                  color: metaOAuth?.connected ? '#166534' : '#9a3412',
                  fontSize: 12,
                  fontWeight: 900,
                  whiteSpace: 'nowrap',
                }}>
                  {metaOAuth?.connected ? metaText.connected : metaText.notConnected}
                </span>
              </div>

              {metaOAuth?.connected && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 12 }}>
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{metaText.page}</div>
                    <div style={{ fontWeight: 800, marginTop: 4 }}>{metaOAuth.pageName || '—'}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{metaOAuth.pageId ? `ID ${metaOAuth.pageId}` : ''}</div>
                  </div>
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{metaText.instagram}</div>
                    <div style={{ fontWeight: 800, marginTop: 4 }}>
                      {metaOAuth.instagramUsername ? `@${metaOAuth.instagramUsername}` : metaText.noInstagram}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{metaOAuth.instagramId ? `ID ${metaOAuth.instagramId}` : ''}</div>
                  </div>
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{metaText.connectedAs}</div>
                    <div style={{ fontWeight: 800, marginTop: 4 }}>{metaOAuth.userName || '—'}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{metaConnectionDate(metaOAuth.connectedAt)}</div>
                  </div>
                </div>
              )}

              {pendingMetaPages.length > 0 && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginTop: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 4 }}>{metaText.selectTitle}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
                    {metaText.selectHint}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) auto', gap: 10, alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="label">{metaText.choosePage}</label>
                      <select
                        className="input"
                        value={metaOAuthPageId || selectedMetaPage?.id || ''}
                        onChange={event => setMetaOAuthPageId(event.target.value)}
                      >
                        {pendingMetaPages.map(page => (
                          <option key={page.id} value={page.id}>{metaPageLabel(page)}</option>
                        ))}
                      </select>
                      {selectedMetaPage && (
                        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                          {metaPageLabel(selectedMetaPage)}
                        </div>
                      )}
                    </div>
                    <button className="btn btn-primary" type="button" onClick={selectMetaOAuthPage} disabled={metaOAuthSelecting || saving}>
                      {metaOAuthSelecting ? metaText.selecting : metaText.usePage}
                    </button>
                  </div>
                </div>
              )}

              {metaOAuth?.subscriptionError && (
                <div style={{ marginTop: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.5 }}>
                  {metaText.subscriptionWarning}: {metaOAuth.subscriptionError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                <button className="btn btn-primary" type="button" onClick={startMetaOAuth} disabled={metaOAuthLoading || saving}>
                  {metaOAuthLoading ? metaText.connecting : metaOAuth?.connected ? metaText.reconnect : metaText.connect}
                </button>
                {!pendingMetaPages.length && !metaOAuth?.connected && (
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{metaText.noPages}</span>
                )}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={facebookDraft.enabled}
                onChange={event => setFacebookDraft(current => ({ ...current, enabled: event.target.checked }))}
              />
              {text.facebookEnabled}
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={facebookDraft.messagesEnabled}
                onChange={event => setFacebookDraft(current => ({ ...current, messagesEnabled: event.target.checked }))}
              />
              {text.messagesEnabled}
            </label>

            <div className="form-group">
              <label className="label">{text.metaCallback}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input className="input" readOnly value={facebookCallbackUrl} />
                <button className="btn btn-secondary" type="button" onClick={() => copy(facebookCallbackUrl)}>{text.copy}</button>
              </div>
            </div>

            <div className="form-group">
              <label className="label">{text.messagesCallback}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input className="input" readOnly value={facebookMessagesCallbackUrl} />
                <button className="btn btn-secondary" type="button" onClick={() => copy(facebookMessagesCallbackUrl)}>{text.copy}</button>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                {text.messagesHint}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                <button className="btn btn-secondary" type="button" onClick={subscribeMetaPage} disabled={metaSubscriptionLoading || saving}>
                  {metaSubscriptionLoading ? text.metaChecking : text.subscribeMeta}
                </button>
                {metaSubscriptionStatus && (
                  <span style={{ fontSize: 12, color: metaSubscriptionStatus.includes('не приняла') || metaSubscriptionStatus.includes('failed') ? '#991b1b' : 'var(--muted)' }}>
                    {metaSubscriptionStatus}
                  </span>
                )}
              </div>
            </div>

            <details style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: '#f8fafc', marginBottom: 14 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 900 }}>{metaText.manualTitle}</summary>
              <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5, marginTop: 8, marginBottom: 12 }}>
                {metaText.manualHint}
              </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 1fr)', gap: 12 }}>
              <div className="form-group">
                <label className="label">Verify Token</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input
                    className="input"
                    value={facebookDraft.verifyToken}
                    onChange={event => setFacebookDraft(current => ({ ...current, verifyToken: event.target.value }))}
                    placeholder="rzfb_..."
                  />
                  <button className="btn btn-secondary" type="button" onClick={() => copy(facebookDraft.verifyToken)}>{text.copy}</button>
                </div>
              </div>

              <div className="form-group">
                <label className="label">Graph API version</label>
                <input
                  className="input"
                  value={facebookDraft.apiVersion}
                  onChange={event => setFacebookDraft(current => ({ ...current, apiVersion: event.target.value }))}
                  placeholder="v23.0"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Facebook Page Access Token</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  className="input"
                  type={showFacebookToken ? 'text' : 'password'}
                  name="legalhub-facebook-page-access-token"
                  autoComplete="off"
                  spellCheck={false}
                  value={facebookDraft.pageAccessToken}
                  onChange={event => setFacebookDraft(current => ({ ...current, pageAccessToken: event.target.value }))}
                  placeholder={text.facebookTokenPlaceholder}
                />
                <button className="btn btn-secondary" type="button" onClick={() => setShowFacebookToken(value => !value)}>
                  {showFacebookToken ? text.hide : text.show}
                </button>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                {text.facebookTokenHint}
              </div>
            </div>

            <div className="form-group">
              <label className="label">Instagram Page Access Token</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  className="input"
                  type={showInstagramToken ? 'text' : 'password'}
                  name="legalhub-instagram-page-access-token"
                  autoComplete="off"
                  spellCheck={false}
                  value={facebookDraft.instagramPageAccessToken || ''}
                  onChange={event => setFacebookDraft(current => ({ ...current, instagramPageAccessToken: event.target.value }))}
                  placeholder={text.instagramTokenPlaceholder}
                />
                <button className="btn btn-secondary" type="button" onClick={() => setShowInstagramToken(value => !value)}>
                  {showInstagramToken ? text.hide : text.show}
                </button>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                {text.instagramTokenHint}
              </div>
            </div>
            </details>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: metaDiagnostics ? 12 : 0 }}>
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>{text.diagnosticsTitle}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
                    {text.diagnosticsHint}
                  </div>
                </div>
                <button className="btn btn-secondary" type="button" onClick={runMetaTokenDiagnostics} disabled={metaDiagnosticsLoading || saving}>
                  {metaDiagnosticsLoading ? text.checking : text.checkTokens}
                </button>
              </div>

              {metaDiagnostics && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {(['facebook', 'instagram'] as const).map(key => {
                    const item = metaDiagnostics[key]
                    const needsAttention = Boolean(
                      item?.ok &&
                      item.debug?.configured &&
                      item.debug.ok !== false &&
                      ((item.debug.missingPermissions?.length || 0) > 0 || item.debug.appMatchesExpected === false)
                    )
                    const tone = !item?.configured ? '#92400e' : needsAttention ? '#92400e' : item.ok ? '#166534' : '#991b1b'
                    const background = !item?.configured ? '#fffbeb' : needsAttention ? '#fffbeb' : item.ok ? '#f0fdf4' : '#fef2f2'
                    return (
                      <div key={key} style={{ border: `1px solid ${tone}22`, borderRadius: 8, background, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                          <strong style={{ color: '#0f172a', fontSize: 13 }}>{item?.label || key}</strong>
                          <span style={{ color: tone, fontSize: 12, fontWeight: 800 }}>
                            {!item?.configured ? 'NO TOKEN' : needsAttention ? text.metaNeedsAttention : item.ok ? 'OK' : 'ERROR'}
                          </span>
                        </div>
                        <div style={{ color: tone, fontSize: 12, lineHeight: 1.5 }}>{metaDiagnosticDetails(item, text)}</div>
                      </div>
                    )
                  })}
                  {metaDiagnostics.apiVersion && (
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                      Graph API: {metaDiagnostics.apiVersion}
                    </div>
                  )}
                  {metaDiagnostics.hint && (
                    <div style={{ color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.5 }}>
                      {text.metaAdvancedAccessHint}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => updateSettings({ regenerateFacebookVerifyToken: true, facebook: facebookDraft })}
              >
                {text.newVerifyToken}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => saveFacebookSettings()} disabled={saving}>
                {saving ? text.saving : text.saveFacebook}
              </button>
            </div>
          </div>
        )}

        {!loading && settings && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title" style={{ marginBottom: 4 }}><span>📊</span>{text.googleSheetsTitle}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
              {text.googleSheetsHint}
            </div>

            <div className="form-group">
              <label className="label">{text.googleSheetsUrl}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input className="input" readOnly value={webliumWebhookUrl} />
                <button className="btn btn-secondary" type="button" onClick={() => copy(webliumWebhookUrl)}>{text.copy}</button>
              </div>
            </div>

            <div className="form-group">
              <label className="label">Apps Script</label>
              <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>
                {text.scriptHint}
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#0f172a', color: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.5, overflowX: 'auto', maxHeight: 360 }}>
{googleSheetsScript}
              </pre>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-secondary" type="button" onClick={() => copy(googleSheetsScript)}>{text.copyScript}</button>
              </div>
            </div>
          </div>
        )}

        {!loading && settings && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title" style={{ marginBottom: 4 }}><span>✈️</span>Telegram</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
              {text.telegramHint}
            </div>

            <div className="form-group">
              <label className="label">Telegram webhook URL</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input className="input" readOnly value={telegramWebhookUrl} />
                <button className="btn btn-secondary" type="button" onClick={() => copy(telegramWebhookUrl)}>{text.copy}</button>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              {text.telegramCommand}
              <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0', color: '#0f172a' }}>{`https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=${telegramWebhookUrl}`}</pre>
            </div>
          </div>
        )}

        {!loading && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div>
                <div className="section-title" style={{ marginBottom: 4 }}><span>📥</span>{text.logsTitle}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{text.logsHint}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setLogsCollapsed(current => !current)}
                  aria-expanded={!logsCollapsed}
                >
                  {logsCollapsed ? text.showLogs : text.collapse}
                </button>
                <button type="button" className="btn btn-secondary" onClick={loadLogs} disabled={logsLoading}>
                  {logsLoading ? text.refreshing : text.refresh}
                </button>
              </div>
            </div>

            {logsCollapsed ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>
                {text.logsCollapsed.replace('{count}', String(logs.length))}
              </div>
            ) : logs.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>{text.noLogs}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{text.date}</th>
                      <th>{text.status}</th>
                      <th>{text.source}</th>
                      <th>{text.lead}</th>
                      <th>{text.payloadError}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      const isCreated = log.status === 'created'
                      const isPing = log.status === 'ping'
                      const isMessage = log.status === 'message'
                      const isIgnored = log.status === 'ignored'
                      const isComment = log.status === 'comment'
                      const isService = log.status === 'service'
                      const payload = payloadSummary(log.payload)
                      const fullPayload = payloadJson(log.payload)
                      return (
                        <tr key={log.id}>
                          <td style={{ fontSize: 13 }}>{new Date(log.createdAt).toLocaleString(text.locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <span style={{ display: 'inline-flex', borderRadius: 999, padding: '4px 8px', fontSize: 12, fontWeight: 800, background: isCreated ? '#dcfce7' : isPing ? '#dbeafe' : isMessage ? '#ede9fe' : isIgnored ? '#fef3c7' : isComment ? '#e0f2fe' : isService ? '#f1f5f9' : '#fee2e2', color: isCreated ? '#166534' : isPing ? '#1d4ed8' : isMessage ? '#6d28d9' : isIgnored ? '#92400e' : isComment ? '#0369a1' : isService ? '#475569' : '#991b1b' }}>
                              {isCreated ? text.created : isPing ? text.test : isMessage ? text.message : isIgnored ? text.ignored : isComment ? text.comment : isService ? text.service : log.status === 'failed' ? text.failed : text.rejected}
                            </span>
                          </td>
                          <td style={{ fontSize: 13 }}>{log.source || '—'}</td>
                          <td style={{ fontSize: 13 }}>
                            {log.lead ? <a href={`/leads/${log.lead.id}`}>{leadName(log.lead)}</a> : '—'}
                          </td>
                          <td style={{ fontSize: 12, color: log.error ? '#991b1b' : 'var(--muted)', maxWidth: 520 }}>
                            <div>{log.error || payload || '—'}</div>
                            {fullPayload && (
                              <details style={{ marginTop: 6, color: 'var(--muted)' }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>{text.showPayload}</summary>
                                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260, overflow: 'auto', marginTop: 8, padding: 10, borderRadius: 6, background: 'var(--bg-soft)', color: 'var(--text)' }}>
                                  {fullPayload}
                                </pre>
                              </details>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
