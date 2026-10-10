'use client'
import NotificationBell from '@/components/NotificationBell'
import PushPilotDiagnostics from '@/components/PushPilotDiagnostics'
import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { notificationText } from '@/lib/notificationI18n'
import { NOTIFICATION_TYPES, type NotificationPreferences } from '@/lib/notificationPolicy'
import { browserEndpointHash, disconnectPushDevice, pushSupported, vapidBytes } from '@/lib/notificationBrowser'
import styles from '@/components/Notifications.module.css'
import { pushPilotText, pushPilotPending } from '@/lib/pushPilotPolicy'

export default function NotificationSettings() {
  const { lang } = useLanguage()
  const copy = notificationText[lang]
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [config, setConfig] = useState<{ canReceiveTeam: boolean; pushAvailable: boolean; publicKey: string; devices: number } | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [active, setActive] = useState(false)
  const [devices, setDevices] = useState<{ id: string; deviceLabel: string; createdAt: string }[]>([])
  const [targetDevice, setTargetDevice] = useState('')
  const [testStatus, setTestStatus] = useState<'pending' | 'accepted' | null>(null)
  const [testRequest, setTestRequest] = useState<{ subscriptionId: string; requestId: string; language: typeof lang } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<'saved' | 'error' | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [missingEntity, setMissingEntity] = useState(false)
  const [pilotDiagnostics, setPilotDiagnostics] = useState(false)
  const refreshDevices = useCallback(async () => {
    const response = await fetch('/api/notifications/subscriptions', { cache: 'no-store' })
    const data = response.ok ? await response.json() : null
    setDevices(data?.devices || [])
    setTargetDevice(current => data?.devices?.some((device: { id: string }) => device.id === current) ? current : data?.devices?.[0]?.id || '')
  }, [])
  const deviceState = useCallback(async () => {
    if (!pushSupported()) { setPermission('unsupported'); return }
    setPermission(Notification.permission)
    const registration = await navigator.serviceWorker.getRegistration('/notification-sw.js')
    const subscription = await registration?.pushManager?.getSubscription()
    if (!subscription) { setActive(false); return }
    const response = await fetch(`/api/notifications/subscriptions?endpointHash=${await browserEndpointHash(subscription.endpoint)}`, { cache: 'no-store' })
    const data = response.ok ? await response.json() : null
    setActive(data?.active === true && Notification.permission === 'granted')
  }, [])
  useEffect(() => {
    setMissingEntity(new URLSearchParams(window.location.search).has('unavailable'))
    setPilotDiagnostics(new URLSearchParams(window.location.search).get('pilotDiagnostics') === '1')
    fetch('/api/notifications/preferences', { cache: 'no-store' }).then(async response => {
      if (!response.ok) { setUnavailable(true); return }
      const data = await response.json(); setConfig(data); setPreferences(data.preferences)
      await deviceState()
      if (data.pushAvailable) await refreshDevices()
    }).catch(() => setMessage('error'))
    const refresh = () => { void deviceState().catch(() => undefined); void refreshDevices().catch(() => undefined) }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [deviceState, refreshDevices])
  async function persist(value: NotificationPreferences) {
    const response = await fetch('/api/notifications/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...value, language: lang }) })
    if (!response.ok) throw new Error()
    const data = await response.json(); setPreferences(data.preferences)
  }
  async function save() {
    if (!preferences) return
    setBusy(true); setMessage(null)
    try { await persist(preferences); setMessage('saved') } catch { setMessage('error') } finally { setBusy(false) }
  }
  async function enable() {
    if (!preferences || !config?.pushAvailable || !pushSupported()) return
    // Invoke directly in the click gesture, before any network/worker await (iOS).
    const requested = Notification.permission === 'default' ? Notification.requestPermission() : Promise.resolve(Notification.permission)
    setBusy(true); setMessage(null)
    try {
      const granted = await requested; setPermission(granted)
      if (granted !== 'granted') return
      const registration = await navigator.serviceWorker.register('/notification-sw.js', { scope: '/', updateViaCache: 'none' })
      await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidBytes(config.publicKey) })
      const response = await fetch('/api/notifications/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()) })
      if (!response.ok) { await subscription.unsubscribe(); throw new Error() }
      await persist({ ...preferences, pushEnabled: true })
      setActive(true); setConfig(current => current ? { ...current, devices: current.devices + (active ? 0 : 1) } : current)
      await refreshDevices()
    } catch { setMessage('error') } finally { setBusy(false) }
  }
  async function disable() {
    setBusy(true); setMessage(null)
    try { await disconnectPushDevice(); setActive(false); setConfig(current => current ? { ...current, devices: Math.max(0, current.devices - 1) } : current); await refreshDevices() } catch { setMessage('error') } finally { setBusy(false) }
  }
  async function testPush() {
    if (!targetDevice || !config?.pushAvailable || !preferences?.pushEnabled) return
    const request = testRequest?.subscriptionId === targetDevice ? testRequest : { subscriptionId: targetDevice, requestId: crypto.randomUUID(), language: lang }
    setTestRequest(request); setBusy(true); setMessage(null); setTestStatus(null)
    try {
      const response = await fetch('/api/notifications/test-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
      const result = await response.json()
      if (!response.ok || result.status === 'failed') { if (response.ok || response.status < 500) setTestRequest(null); throw new Error() }
      if (result.status === 'accepted') { setTestStatus('accepted'); setTestRequest(null) }
      else { setTestStatus('pending') }
      window.dispatchEvent(new Event('notifications-changed'))
    } catch { setMessage('error') } finally { setBusy(false) }
  }
  async function masterOff() {
    if (!preferences) return
    setBusy(true)
    try { await persist({ ...preferences, pushEnabled: false }); setMessage('saved') } catch { setMessage('error') } finally { setBusy(false) }
  }
  return <div className="fade-in">
    <div className="page-header"><h1 className="page-title">{copy.center}</h1><NotificationBell /></div>
    <div className="page-body"><div className={styles.settings}>
      {missingEntity && <p role="status" className={styles.error}>{copy.unavailableEntity}</p>}
      {message && <p role={message === 'error' ? 'alert' : 'status'} className={message === 'error' ? styles.error : ''}>{copy[message]}</p>}
      {unavailable ? <p>{copy.unavailable}</p> : !preferences || !config ? <p>{copy.loading}</p> : <>
        <section className="card"><h2>{copy.push}</h2>
          <p>{copy.permission}: <strong>{copy.permissionStates[permission]}</strong></p>
          <p>{copy.device}: <strong>{active ? copy.active : copy.inactive}</strong> · {copy.devices}: {config.devices}</p>
          {permission === 'denied' && <p>{copy.denied}</p>}
          {permission === 'unsupported' && <p>{copy.unsupported}</p>}
          {!config.pushAvailable && <p>{copy.unavailable}</p>}
          {active && preferences.pushEnabled && <p role="status">✓ {copy.enabled}</p>}
          <div className={styles.controls}>
            {config.pushAvailable && (!active || !preferences.pushEnabled) && <button className="btn btn-primary" disabled={busy || permission === 'denied' || permission === 'unsupported'} onClick={() => void enable()}>{copy.enable}</button>}
            {active && <button className="btn btn-secondary" disabled={busy} onClick={() => void disable()}>{copy.disable}</button>}
            {preferences.pushEnabled && <button className="btn btn-secondary" disabled={busy} onClick={() => void masterOff()}>{copy.masterOff}</button>}
          </div>
          {config.pushAvailable && devices.length > 0 && <div className={`${styles.controls} ${styles.pilotControls}`}>
            <label>{copy.devices}<select aria-label={copy.devices} value={targetDevice} disabled={busy} onChange={event => { setTargetDevice(event.target.value); setTestRequest(null); setTestStatus(null) }}>
              {devices.map((device, index) => <option key={device.id} value={device.id}>{device.deviceLabel} · {index + 1}</option>)}
            </select></label>
            <button className="btn btn-secondary" disabled={busy || !targetDevice || !preferences.pushEnabled} onClick={() => void testPush()}>{pushPilotText[lang].send}</button>
          </div>}
          {testStatus && <p role="status">{testStatus === 'accepted' ? pushPilotText[lang].accepted : pushPilotPending[lang]}</p>}
        </section>
        {config.pushAvailable && <PushPilotDiagnostics initiallyOpen={pilotDiagnostics} />}
        <section className="card"><table className={styles.settingsTable}><thead><tr><th scope="col">{copy.event}</th><th scope="col">{copy.inApp}</th><th scope="col">{copy.push}</th></tr></thead><tbody>
          {NOTIFICATION_TYPES.map(type => <tr key={type}><td>{copy.events[type]}</td>{(['inApp', 'push'] as const).map(channel => <td key={channel}><label><input type="checkbox" disabled={busy} aria-label={`${copy.events[type]}: ${copy[channel]}`} checked={preferences.events[type][channel]} onChange={event => setPreferences({ ...preferences, events: { ...preferences.events, [type]: { ...preferences.events[type], [channel]: event.target.checked } } })} /></label></td>)}</tr>)}
        </tbody></table></section>
        {config.canReceiveTeam && <section className="card"><h2>{copy.scope}</h2><div className={styles.controls}>{(['mine', 'team'] as const).map(scope => <label key={scope}><input type="radio" name="notification-scope" disabled={busy} checked={preferences.scope === scope} onChange={() => setPreferences({ ...preferences, scope })} />{copy[scope]}</label>)}</div></section>}
        <section className="card"><label><input type="checkbox" disabled={busy} checked={preferences.showClientName} onChange={event => setPreferences({ ...preferences, showClientName: event.target.checked })} />{copy.privacy}</label><p>{copy.privacyHelp}</p></section>
        <div><button className="btn btn-primary" disabled={busy} onClick={() => void save()}>{copy.save}</button></div>
      </>}
    </div></div>
  </div>
}
