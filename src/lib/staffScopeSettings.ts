import { settingsObject } from '@/lib/leadWebhook'

export function staffScopeFilterEnabled(settings: unknown) {
  return settingsObject(settings).staffScopeFilterEnabled !== false
}
