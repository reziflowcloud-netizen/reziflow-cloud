import {
  buildConferenceDedupeKey,
  createConferenceAttribution,
  inferConferenceDemoOrigin,
  preserveConferenceFirstTouch,
  type ConferenceAttribution,
  type ConferenceDemoOrigin,
  type ConferenceEventName,
} from '../src/lib/conferenceTrackingCore'

type TestEvent = {
  eventName: ConferenceEventName
  attribution: ConferenceAttribution
  ctaLocation?: string
  demoOrigin?: ConferenceDemoOrigin
  registrationKey?: string
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function createStore() {
  const rows = new Map<string, TestEvent>()
  return {
    rows,
    add(event: TestEvent) {
      const key = buildConferenceDedupeKey({
        eventName: event.eventName,
        anonymousSessionId: event.attribution.attributionId,
        ctaLocation: event.ctaLocation,
        demoOrigin: event.demoOrigin,
        registrationKey: event.registrationKey,
        createdAt: new Date('2026-09-13T12:00:00.000Z'),
      })
      if (!rows.has(key)) rows.set(key, event)
    },
  }
}

function runFlowA() {
  const store = createStore()
  const qrLanding = createConferenceAttribution(new URL(
    'https://legalhubcrm.com/conference?utm_source=conference&utm_medium=offline_flyer&utm_campaign=conference_legalization_poland&utm_content=qr_landing',
  ), 'flow-a')
  const internalDemo = createConferenceAttribution(new URL(
    'https://legalhubcrm.com/conference/demo?utm_source=conference&utm_medium=conference_landing&utm_campaign=conference_legalization_poland&utm_content=demo_cta',
  ), 'flow-a-internal')
  const attribution = preserveConferenceFirstTouch(qrLanding, internalDemo)
  const demoOrigin = inferConferenceDemoOrigin(new URL(
    'https://legalhubcrm.com/conference/demo?utm_source=conference&utm_medium=conference_landing&utm_campaign=conference_legalization_poland&utm_content=demo_cta',
  ), attribution)

  store.add({ eventName: 'conference_page_view', attribution })
  store.add({ eventName: 'conference_page_view', attribution })
  store.add({ eventName: 'conference_demo_open', attribution, demoOrigin })
  store.add({ eventName: 'conference_demo_open', attribution, demoOrigin })
  store.add({ eventName: 'conference_register_click', attribution, ctaLocation: 'demo_bar' })
  store.add({ eventName: 'conference_register_click', attribution, ctaLocation: 'demo_bar' })
  store.add({ eventName: 'conference_register_complete', attribution, registrationKey: 'registration-a' })
  store.add({ eventName: 'conference_register_complete', attribution, registrationKey: 'registration-a' })

  assert(attribution.utmContent === 'qr_landing', 'Flow A must preserve the QR 1 first touch')
  assert(demoOrigin === 'conference_landing', 'Flow A demo origin must be conference_landing')
  assert(store.rows.size === 4, 'Flow A duplicate events were not suppressed')
  assert(Array.from(store.rows.values()).every(row => row.attribution.utmContent === 'qr_landing'), 'Flow A attribution changed')
  return Object.fromEntries(Array.from(store.rows.values()).map(row => [row.eventName, 'PASS']))
}

function runFlowB() {
  const store = createStore()
  const attribution = createConferenceAttribution(new URL(
    'https://legalhubcrm.com/conference/demo?utm_source=conference&utm_medium=offline_flyer&utm_campaign=conference_legalization_poland&utm_content=qr_demo',
  ), 'flow-b')
  const demoOrigin = inferConferenceDemoOrigin(new URL(
    'https://legalhubcrm.com/conference/demo?utm_source=conference&utm_medium=offline_flyer&utm_campaign=conference_legalization_poland&utm_content=qr_demo',
  ), attribution)

  store.add({ eventName: 'conference_demo_open', attribution, demoOrigin })
  store.add({ eventName: 'conference_demo_open', attribution, demoOrigin })
  store.add({ eventName: 'conference_register_click', attribution, ctaLocation: 'demo_bar' })
  store.add({ eventName: 'conference_register_complete', attribution, registrationKey: 'registration-b' })
  store.add({ eventName: 'conference_register_complete', attribution, registrationKey: 'registration-b' })

  assert(attribution.utmContent === 'qr_demo', 'Flow B must preserve the QR 2 first touch')
  assert(demoOrigin === 'flyer_qr', 'Flow B demo origin must be flyer_qr')
  assert(store.rows.size === 3, 'Flow B duplicate events were not suppressed')
  return {
    conference_page_view: 'NOT_EXPECTED',
    ...Object.fromEntries(Array.from(store.rows.values()).map(row => [row.eventName, 'PASS'])),
  }
}

console.log(JSON.stringify({ flowA: runFlowA(), flowB: runFlowB() }, null, 2))
