import type { MarketingLang } from '@/lib/marketingI18n'

type PasswordResetCopy = {
  forgot: {
    formAria: string
    title: string
    subtitle: string
    email: string
    submit: string
    loading: string
    generic: string
    back: string
  }
  reset: {
    formAria: string
    title: string
    subtitle: string
    password: string
    confirm: string
    minimum: string
    mismatch: string
    submit: string
    loading: string
    success: string
    login: string
    invalid: string
    requestNew: string
    showPassword: string
    hidePassword: string
  }
}

export const PASSWORD_RESET_COPY: Record<MarketingLang, PasswordResetCopy> = {
  ru: {
    forgot: {
      formAria: 'Восстановление пароля', title: 'Забыли пароль?',
      subtitle: 'Укажите email для входа — мы отправим ссылку для создания нового пароля.',
      email: 'Email', submit: 'Отправить инструкцию', loading: 'Отправляем...',
      generic: 'Если учётная запись с этим адресом электронной почты существует, мы отправили инструкцию для восстановления пароля.',
      back: 'Вернуться ко входу',
    },
    reset: {
      formAria: 'Создание нового пароля', title: 'Новый пароль',
      subtitle: 'Создайте новый пароль для входа в LegalHub CRM.', password: 'Новый пароль',
      confirm: 'Повторите пароль', minimum: 'Пароль должен содержать минимум 6 символов.',
      mismatch: 'Пароли не совпадают.', submit: 'Сохранить новый пароль', loading: 'Сохраняем...',
      success: 'Пароль обновлён. Теперь можно войти с новым паролем.', login: 'Перейти ко входу',
      invalid: 'Ссылка недействительна или срок её действия истёк.', requestNew: 'Запросить новую ссылку',
      showPassword: 'Показать пароль', hidePassword: 'Скрыть пароль',
    },
  },
  uk: {
    forgot: {
      formAria: 'Відновлення пароля', title: 'Забули пароль?',
      subtitle: 'Вкажіть email для входу — ми надішлемо посилання для створення нового пароля.',
      email: 'Email', submit: 'Надіслати інструкцію', loading: 'Надсилаємо...',
      generic: 'Якщо обліковий запис із цією електронною адресою існує, ми надіслали інструкцію для відновлення пароля.',
      back: 'Повернутися до входу',
    },
    reset: {
      formAria: 'Створення нового пароля', title: 'Новий пароль',
      subtitle: 'Створіть новий пароль для входу в LegalHub CRM.', password: 'Новий пароль',
      confirm: 'Повторіть пароль', minimum: 'Пароль має містити щонайменше 6 символів.',
      mismatch: 'Паролі не збігаються.', submit: 'Зберегти новий пароль', loading: 'Зберігаємо...',
      success: 'Пароль оновлено. Тепер можна увійти з новим паролем.', login: 'Перейти до входу',
      invalid: 'Посилання недійсне або термін його дії закінчився.', requestNew: 'Запросити нове посилання',
      showPassword: 'Показати пароль', hidePassword: 'Сховати пароль',
    },
  },
  pl: {
    forgot: {
      formAria: 'Reset hasła', title: 'Nie pamiętasz hasła?',
      subtitle: 'Podaj email logowania, a wyślemy link do ustawienia nowego hasła.',
      email: 'Email', submit: 'Wyślij instrukcję', loading: 'Wysyłamy...',
      generic: 'Jeśli konto z tym adresem email istnieje, wysłaliśmy instrukcję resetowania hasła.',
      back: 'Wróć do logowania',
    },
    reset: {
      formAria: 'Ustawienie nowego hasła', title: 'Nowe hasło',
      subtitle: 'Ustaw nowe hasło do LegalHub CRM.', password: 'Nowe hasło', confirm: 'Powtórz hasło',
      minimum: 'Hasło musi mieć co najmniej 6 znaków.', mismatch: 'Hasła nie są takie same.',
      submit: 'Zapisz nowe hasło', loading: 'Zapisujemy...',
      success: 'Hasło zostało zmienione. Możesz zalogować się nowym hasłem.', login: 'Przejdź do logowania',
      invalid: 'Link jest nieprawidłowy lub wygasł.', requestNew: 'Poproś o nowy link',
      showPassword: 'Pokaż hasło', hidePassword: 'Ukryj hasło',
    },
  },
  en: {
    forgot: {
      formAria: 'Password recovery', title: 'Forgot your password?',
      subtitle: 'Enter your login email and we will send a link to create a new password.',
      email: 'Email', submit: 'Send instructions', loading: 'Sending...',
      generic: 'If an account with this email address exists, we sent password recovery instructions.',
      back: 'Back to sign in',
    },
    reset: {
      formAria: 'Create a new password', title: 'New password', subtitle: 'Create a new LegalHub CRM password.',
      password: 'New password', confirm: 'Repeat password', minimum: 'Password must be at least 6 characters.',
      mismatch: 'Passwords do not match.', submit: 'Save new password', loading: 'Saving...',
      success: 'Your password was updated. You can now sign in with the new password.', login: 'Go to sign in',
      invalid: 'This link is invalid or has expired.', requestNew: 'Request a new link',
      showPassword: 'Show password', hidePassword: 'Hide password',
    },
  },
}

export function getPasswordResetCopy(lang: MarketingLang) {
  return PASSWORD_RESET_COPY[lang] || PASSWORD_RESET_COPY.ru
}
