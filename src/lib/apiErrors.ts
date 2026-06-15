import { Prisma } from '@prisma/client'

const DATABASE_ERROR_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1010',
  'P1011',
  'P1012',
  'P1013',
  'P1017',
])

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function databaseUnavailableResponse() {
  return {
    status: 503,
    code: 'DATABASE_UNAVAILABLE',
    error: 'База данных CRM сейчас не подключена. Если вы тестируете локально, добавьте DATABASE_URL в .env.local. На Vercel проверьте переменные окружения и миграции базы.',
  }
}

export function publicApiError(error: unknown, fallback: string, fallbackStatus = 400) {
  const message = String((error as { message?: unknown })?.message || '')
  const code = String((error as { code?: unknown })?.code || '')

  if (message.includes('DATABASE_URL') || message.includes('Environment variable not found') || DATABASE_ERROR_CODES.has(code)) {
    return databaseUnavailableResponse()
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : []
    if (target.includes('email')) {
      return {
        status: 409,
        code: 'EMAIL_ALREADY_EXISTS',
        error: 'Пользователь с таким email уже зарегистрирован. Войдите в аккаунт или используйте другой email.',
      }
    }
    if (target.includes('slug')) {
      return {
        status: 409,
        code: 'ORGANIZATION_ALREADY_EXISTS',
        error: 'Организация с таким названием уже есть. Попробуйте добавить город или короткое уточнение.',
      }
    }
    return {
      status: 409,
      code: 'DUPLICATE_VALUE',
      error: 'Такая запись уже существует. Проверьте данные и попробуйте еще раз.',
    }
  }

  if (message) {
    return {
      status: fallbackStatus,
      code: 'VALIDATION_ERROR',
      error: message,
    }
  }

  return {
    status: fallbackStatus,
    code: 'REQUEST_FAILED',
    error: fallback,
  }
}
