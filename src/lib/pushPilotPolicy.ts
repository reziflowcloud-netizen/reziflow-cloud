export const PUSH_PILOT_TYPE = 'push_test'
export const pushPilotPending = { uk: 'Тест обробляється. Повторна перевірка не надсилає другий push.', ru: 'Тест обрабатывается. Повторная проверка не отправляет второй push.', pl: 'Test jest przetwarzany. Ponowne sprawdzenie nie wysyła drugiego push.' }
export const pushPilotText = {
  uk: { title: 'Тестове сповіщення', body: 'Push-повідомлення працюють.', send: 'Надіслати тест на вибраний пристрій', accepted: 'Push-сервіс прийняв тест. Перевірте сповіщення на пристрої.' },
  ru: { title: 'Тестовое уведомление', body: 'Push-уведомления работают.', send: 'Отправить тест на выбранное устройство', accepted: 'Push-сервис принял тест. Проверьте уведомление на устройстве.' },
  pl: { title: 'Powiadomienie testowe', body: 'Powiadomienia push działają.', send: 'Wyślij test na wybrane urządzenie', accepted: 'Usługa push przyjęła test. Sprawdź powiadomienie na urządzeniu.' },
}
export function validPilotRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
}
export function isPushPilotNotification(notification: any) {
  return notification?.type === PUSH_PILOT_TYPE && notification.entityType === PUSH_PILOT_TYPE && notification.entityId === notification.id && notification.deepLink === '/dashboard' && typeof notification.dedupeKey === 'string' && notification.dedupeKey.startsWith('push-pilot:') && validPilotRequestId(notification.dedupeKey.slice(11))
}
