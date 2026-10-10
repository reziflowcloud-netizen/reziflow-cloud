'use client'
import { useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
const text = {
  ru: { title: 'Проверка тестового push', check: 'Проверить версию на этом устройстве', ready: 'Версия подтверждена', old: 'Версия ещё не обновилась. Закройте и снова откройте приложение.', failed: 'Не удалось подтвердить версию. Повторите проверку.' },
  uk: { title: 'Перевірка тестового push', check: 'Перевірити версію на цьому пристрої', ready: 'Версію підтверджено', old: 'Версія ще не оновилася. Закрийте та знову відкрийте застосунок.', failed: 'Не вдалося підтвердити версію. Повторіть перевірку.' },
  pl: { title: 'Sprawdzenie testowego push', check: 'Sprawdź wersję na tym urządzeniu', ready: 'Wersja potwierdzona', old: 'Wersja nie została zaktualizowana. Zamknij i otwórz aplikację ponownie.', failed: 'Nie udało się potwierdzić wersji. Spróbuj ponownie.' },
}
export default function PushPilotDiagnostics({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const { lang } = useLanguage(), copy = text[lang]
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  async function check() {
    setBusy(true); setResult('')
    try {
      const response = await fetch('/api/notifications/pilot-diagnostics', { cache: 'no-store' })
      if (!response.ok) throw new Error()
      const config = await response.json()
      const registration = await navigator.serviceWorker.getRegistration('/notification-sw.js')
      if (!registration) throw new Error()
      await registration.update()
      const worker = registration.active
      if (!worker) throw new Error()
      const info = await new Promise<{ workerVersion: string; instanceId: string }>((resolve, reject) => {
        const channel = new MessageChannel()
        const timer = setTimeout(() => { channel.port1.close(); reject(new Error()) }, 3000)
        channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data) }
        worker.postMessage({ type: 'legalhub:pilot-worker-check' }, [channel.port2])
      })
      if (info.workerVersion !== config.expectedWorkerVersion) { setResult(copy.old); return }
      if (config.notificationId) {
        const trace = await fetch('/api/notifications/pilot-diagnostics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId: config.notificationId, workerVersion: info.workerVersion, instanceId: info.instanceId, stage: 'worker-check' }) })
        if (!trace.ok) throw new Error()
      }
      setResult(`${copy.ready}: ${info.workerVersion}`)
    } catch { setResult(copy.failed) } finally { setBusy(false) }
  }
  return <details className="card" open={initiallyOpen || undefined}><summary>{copy.title}</summary><button className="btn btn-secondary" style={{ marginTop: 12, maxWidth: '100%', whiteSpace: 'normal' }} disabled={busy} onClick={() => void check()}>{copy.check}</button>{result && <p role="status" style={{ overflowWrap: 'anywhere' }}>{result}</p>}</details>
}
