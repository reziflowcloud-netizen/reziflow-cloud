import type { MarketingLang } from '@/lib/marketingI18n'

type AuthBenefit = {
  title: string
  text: string
  icon: string
}

type PlanLabels = Record<'free' | 'starter' | 'pro' | 'agency', string>

export type AuthCopy = {
  login: {
    introAria: string
    formAria: string
    kicker: string
    title: string
    benefits: AuthBenefit[]
    cardSubtitle: string
    loginError: string
    connectionError: string
    email: string
    password: string
    showPassword: string
    hidePassword: string
    remember: string
    forgot: string
    forgotSubject: string
    loading: string
    submit: string
    privacy: string
    dataDeletion: string
  }
  register: {
    infoAria: string
    formAria: string
    kicker: string
    title: string
    lead: string
    benefits: AuthBenefit[]
    formKicker: string
    createError: string
    connectionError: string
    companyName: string
    companyPlaceholder: string
    adminName: string
    adminPlaceholder: string
    email: string
    emailPlaceholder: string
    password: string
    passwordPlaceholder: string
    showPassword: string
    hidePassword: string
    startMode: string
    planAria: string
    planLabels: PlanLabels
    loading: string
    submitFree: string
    submitPlan: string
    already: string
    loginLink: string
  }
}

const ru: AuthCopy = {
  login: {
    introAria: 'Преимущества LegalHub',
    formAria: 'Форма входа',
    kicker: 'LegalHub CRM',
    title: 'Система управления делами для легализационных агентств в Польше',
    benefits: [
      { title: 'Ваши данные под защитой', text: 'Шифрование и резервное копирование', icon: 'shield' },
      { title: 'Ничего не упустите', text: 'Напоминания и контроль сроков', icon: 'reminder' },
      { title: 'Вся команда в одном окне', text: 'Задачи, клиенты и документы', icon: 'team' },
    ],
    cardSubtitle: 'Система управления делами',
    loginError: 'Неверный email или пароль',
    connectionError: 'Ошибка соединения',
    email: 'Email',
    password: 'Пароль',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
    remember: 'Запомнить меня',
    forgot: 'Забыли пароль?',
    forgotSubject: 'Восстановление доступа LegalHub',
    loading: 'Вход...',
    submit: 'Войти',
    privacy: 'Privacy Policy',
    dataDeletion: 'Data Deletion Instructions',
  },
  register: {
    infoAria: 'Преимущества старта',
    formAria: 'Форма регистрации',
    kicker: 'LegalHub CRM',
    title: 'Начните бесплатно и настройте систему под свою работу',
    lead: 'Создайте организацию за пару минут и начните работать в своей CRM.',
    benefits: [
      { title: 'Старт без оплаты', text: 'и без карты', icon: 'payment' },
      { title: 'Гибкие настройки', text: 'под ваш процесс', icon: 'settings' },
      { title: 'Полный контроль', text: 'и аналитика', icon: 'control' },
      { title: 'Безопасность', text: 'и защита данных', icon: 'security' },
    ],
    formKicker: 'Бесплатный старт',
    createError: 'Не удалось создать организацию. Проверьте данные или оставьте заявку через форму связи.',
    connectionError: 'Ошибка соединения',
    companyName: 'Название компании *',
    companyPlaceholder: 'Напр.: Legal Partner',
    adminName: 'Ваше имя *',
    adminPlaceholder: 'Имя администратора',
    email: 'Email для входа *',
    emailPlaceholder: 'admin@example.com',
    password: 'Пароль *',
    passwordPlaceholder: 'Минимум 6 символов',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
    startMode: 'Режим старта',
    planAria: 'Тариф',
    planLabels: { free: 'Бесплатный', starter: 'Starter', pro: 'Pro', agency: 'Agency' },
    loading: 'Создаем организацию...',
    submitFree: 'Создать организацию бесплатно',
    submitPlan: 'Начать бесплатно на тарифе {plan}',
    already: 'Уже есть аккаунт?',
    loginLink: 'Войти',
  },
}

const uk: AuthCopy = {
  login: {
    introAria: 'Переваги LegalHub',
    formAria: 'Форма входу',
    kicker: 'LegalHub CRM',
    title: 'Система управління справами для легалізаційних агентств у Польщі',
    benefits: [
      { title: 'Ваші дані захищені', text: 'Шифрування та резервне копіювання', icon: 'shield' },
      { title: 'Нічого не пропустите', text: 'Нагадування та контроль строків', icon: 'reminder' },
      { title: 'Уся команда в одному вікні', text: 'Задачі, клієнти та документи', icon: 'team' },
    ],
    cardSubtitle: 'Система управління справами',
    loginError: 'Невірний email або пароль',
    connectionError: 'Помилка зʼєднання',
    email: 'Email',
    password: 'Пароль',
    showPassword: 'Показати пароль',
    hidePassword: 'Сховати пароль',
    remember: 'Запамʼятати мене',
    forgot: 'Забули пароль?',
    forgotSubject: 'Відновлення доступу LegalHub',
    loading: 'Вхід...',
    submit: 'Увійти',
    privacy: 'Privacy Policy',
    dataDeletion: 'Data Deletion Instructions',
  },
  register: {
    infoAria: 'Переваги старту',
    formAria: 'Форма реєстрації',
    kicker: 'LegalHub CRM',
    title: 'Почніть безкоштовно та налаштуйте систему під свою роботу',
    lead: 'Створіть організацію за кілька хвилин і почніть працювати у своїй CRM.',
    benefits: [
      { title: 'Старт без оплати', text: 'і без картки', icon: 'payment' },
      { title: 'Гнучкі налаштування', text: 'під ваш процес', icon: 'settings' },
      { title: 'Повний контроль', text: 'та аналітика', icon: 'control' },
      { title: 'Безпека', text: 'і захист даних', icon: 'security' },
    ],
    formKicker: 'Безкоштовний старт',
    createError: 'Не вдалося створити організацію. Перевірте дані або залиште заявку через форму звʼязку.',
    connectionError: 'Помилка зʼєднання',
    companyName: 'Назва компанії *',
    companyPlaceholder: 'Напр.: Legal Partner',
    adminName: 'Ваше імʼя *',
    adminPlaceholder: 'Імʼя адміністратора',
    email: 'Email для входу *',
    emailPlaceholder: 'admin@example.com',
    password: 'Пароль *',
    passwordPlaceholder: 'Мінімум 6 символів',
    showPassword: 'Показати пароль',
    hidePassword: 'Сховати пароль',
    startMode: 'Режим старту',
    planAria: 'Тариф',
    planLabels: { free: 'Безкоштовний', starter: 'Starter', pro: 'Pro', agency: 'Agency' },
    loading: 'Створюємо організацію...',
    submitFree: 'Створити організацію безкоштовно',
    submitPlan: 'Почати безкоштовно на тарифі {plan}',
    already: 'Вже є акаунт?',
    loginLink: 'Увійти',
  },
}

const pl: AuthCopy = {
  login: {
    introAria: 'Korzyści LegalHub',
    formAria: 'Formularz logowania',
    kicker: 'LegalHub CRM',
    title: 'System zarządzania sprawami dla agencji legalizacyjnych w Polsce',
    benefits: [
      { title: 'Twoje dane są chronione', text: 'Szyfrowanie i kopie zapasowe', icon: 'shield' },
      { title: 'Nic nie umknie', text: 'Przypomnienia i kontrola terminów', icon: 'reminder' },
      { title: 'Cały zespół w jednym oknie', text: 'Zadania, klienci i dokumenty', icon: 'team' },
    ],
    cardSubtitle: 'System zarządzania sprawami',
    loginError: 'Nieprawidłowy email lub hasło',
    connectionError: 'Błąd połączenia',
    email: 'Email',
    password: 'Hasło',
    showPassword: 'Pokaż hasło',
    hidePassword: 'Ukryj hasło',
    remember: 'Zapamiętaj mnie',
    forgot: 'Nie pamiętasz hasła?',
    forgotSubject: 'Odzyskanie dostępu LegalHub',
    loading: 'Logowanie...',
    submit: 'Zaloguj',
    privacy: 'Privacy Policy',
    dataDeletion: 'Data Deletion Instructions',
  },
  register: {
    infoAria: 'Korzyści startu',
    formAria: 'Formularz rejestracji',
    kicker: 'LegalHub CRM',
    title: 'Zacznij bezpłatnie i dopasuj system do swojej pracy',
    lead: 'Utwórz organizację w kilka minut i zacznij pracować w swojej CRM.',
    benefits: [
      { title: 'Start bez opłaty', text: 'i bez karty', icon: 'payment' },
      { title: 'Elastyczne ustawienia', text: 'pod Twój proces', icon: 'settings' },
      { title: 'Pełna kontrola', text: 'i analityka', icon: 'control' },
      { title: 'Bezpieczeństwo', text: 'i ochrona danych', icon: 'security' },
    ],
    formKicker: 'Bezpłatny start',
    createError: 'Nie udało się utworzyć organizacji. Sprawdź dane albo zostaw zgłoszenie przez formularz kontaktowy.',
    connectionError: 'Błąd połączenia',
    companyName: 'Nazwa firmy *',
    companyPlaceholder: 'Np.: Legal Partner',
    adminName: 'Twoje imię *',
    adminPlaceholder: 'Imię administratora',
    email: 'Email do logowania *',
    emailPlaceholder: 'admin@example.com',
    password: 'Hasło *',
    passwordPlaceholder: 'Minimum 6 znaków',
    showPassword: 'Pokaż hasło',
    hidePassword: 'Ukryj hasło',
    startMode: 'Tryb startu',
    planAria: 'Taryfa',
    planLabels: { free: 'Bezpłatny', starter: 'Starter', pro: 'Pro', agency: 'Agency' },
    loading: 'Tworzymy organizację...',
    submitFree: 'Utwórz organizację bezpłatnie',
    submitPlan: 'Zacznij bezpłatnie w taryfie {plan}',
    already: 'Masz już konto?',
    loginLink: 'Zaloguj',
  },
}

const en: AuthCopy = {
  login: {
    introAria: 'LegalHub benefits',
    formAria: 'Login form',
    kicker: 'LegalHub CRM',
    title: 'Case management system for legalization agencies in Poland',
    benefits: [
      { title: 'Your data is protected', text: 'Encryption and backups', icon: 'shield' },
      { title: 'Nothing gets missed', text: 'Reminders and deadline control', icon: 'reminder' },
      { title: 'The whole team in one place', text: 'Tasks, clients and documents', icon: 'team' },
    ],
    cardSubtitle: 'Case management system',
    loginError: 'Invalid email or password',
    connectionError: 'Connection error',
    email: 'Email',
    password: 'Password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    remember: 'Remember me',
    forgot: 'Forgot password?',
    forgotSubject: 'LegalHub access recovery',
    loading: 'Signing in...',
    submit: 'Sign in',
    privacy: 'Privacy Policy',
    dataDeletion: 'Data Deletion Instructions',
  },
  register: {
    infoAria: 'Startup benefits',
    formAria: 'Registration form',
    kicker: 'LegalHub CRM',
    title: 'Start for free and adapt the system to your work',
    lead: 'Create an organization in a couple of minutes and start working in your CRM.',
    benefits: [
      { title: 'Start without payment', text: 'and without a card', icon: 'payment' },
      { title: 'Flexible settings', text: 'for your process', icon: 'settings' },
      { title: 'Full control', text: 'and analytics', icon: 'control' },
      { title: 'Security', text: 'and data protection', icon: 'security' },
    ],
    formKicker: 'Free start',
    createError: 'Could not create the organization. Check the details or leave a request through the contact form.',
    connectionError: 'Connection error',
    companyName: 'Company name *',
    companyPlaceholder: 'E.g.: Legal Partner',
    adminName: 'Your name *',
    adminPlaceholder: 'Administrator name',
    email: 'Login email *',
    emailPlaceholder: 'admin@example.com',
    password: 'Password *',
    passwordPlaceholder: 'Minimum 6 characters',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    startMode: 'Start mode',
    planAria: 'Plan',
    planLabels: { free: 'Free', starter: 'Starter', pro: 'Pro', agency: 'Agency' },
    loading: 'Creating organization...',
    submitFree: 'Create organization for free',
    submitPlan: 'Start for free on {plan}',
    already: 'Already have an account?',
    loginLink: 'Sign in',
  },
}

export const AUTH_COPY: Record<MarketingLang, AuthCopy> = { en, ru, uk, pl }

export function getAuthCopy(lang: MarketingLang) {
  return AUTH_COPY[lang] || AUTH_COPY.ru
}
