import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

import { getMobileLeadSubtitle } from '../src/lib/mobileLeadSubtitle.ts'

const workspace = resolve(import.meta.dirname, '..')
const sourceLabel = value => ({ instagram: 'Instagram', facebook: 'Facebook', manual: 'Вручную' })[value] || String(value || '')

test('phone has priority and uses the neutral phone presentation', () => {
  assert.deepEqual(getMobileLeadSubtitle({
    lead: { source: 'instagram', phone: '+48 123 456 789', instagram: 'legal.user' },
    displayName: 'Mobile lead',
    sourceLabel,
    fallback: 'Не указано',
  }), { kind: 'phone', text: '+48 123 456 789' })
})

test('Instagram lead displays a normalized handle', () => {
  assert.deepEqual(getMobileLeadSubtitle({
    lead: { source: 'instagram', instagram: 'legal.user' },
    displayName: 'Instagram contact',
    sourceLabel,
    fallback: 'Не указано',
  }), { kind: 'instagram', text: '@legal.user' })
})

test('Facebook lead displays a useful identifier when it differs from the name', () => {
  assert.deepEqual(getMobileLeadSubtitle({
    lead: { source: 'facebook', facebook: 'facebook.user' },
    displayName: 'Facebook contact',
    sourceLabel,
    fallback: 'Nie podano',
  }), { kind: 'facebook', text: 'facebook.user' })
})

test('explicit social source wins when legacy fields from another channel are also present', () => {
  assert.deepEqual(getMobileLeadSubtitle({
    lead: { source: 'facebook', facebook: 'facebook.user', instagram: 'stale.instagram' },
    displayName: 'Social contact',
    sourceLabel,
    fallback: 'Nie podano',
  }), { kind: 'facebook', text: 'facebook.user' })
})

test('social source-only subtitle is not repeated when the generated name already identifies the source', () => {
  assert.equal(getMobileLeadSubtitle({
    lead: { source: 'facebook', facebook: 'Лид из Facebook' },
    displayName: 'Лид из Facebook',
    sourceLabel,
    fallback: 'Не указано',
  }), null)
  assert.equal(getMobileLeadSubtitle({
    lead: { source: 'instagram' },
    displayName: 'Лід з Instagram',
    sourceLabel,
    fallback: 'Не вказано',
  }), null)
})

test('social source label remains visible once for a named lead without an identifier', () => {
  assert.deepEqual(getMobileLeadSubtitle({
    lead: { source: 'facebook' },
    displayName: 'Anna Example',
    sourceLabel,
    fallback: 'Nie podano',
  }), { kind: 'facebook', text: 'Facebook' })
})

test('email and localized empty fallback remain supported for non-social leads', () => {
  assert.deepEqual(getMobileLeadSubtitle({
    lead: { source: 'manual', email: 'lead@example.test' },
    displayName: 'Manual lead',
    sourceLabel,
    fallback: 'Nie podano',
  }), { kind: 'email', text: 'lead@example.test' })
  assert.deepEqual(getMobileLeadSubtitle({
    lead: { source: 'manual' },
    displayName: 'Manual lead',
    sourceLabel,
    fallback: 'Не вказано',
  }), { kind: 'fallback', text: 'Не вказано' })
})

test('login uses one higher-specificity CSS-only first-render layout at all breakpoints', async () => {
  const [page, css] = await Promise.all([
    readFile(resolve(workspace, 'src/app/login/page.tsx'), 'utf8'),
    readFile(resolve(workspace, 'src/app/globals.css'), 'utf8'),
  ])

  assert.match(page, /className="login-page login-auth-page"/)
  assert.doesNotMatch(page, /innerWidth|matchMedia|addEventListener\(['"]resize/)
  assert.match(css, /\.login-page\.login-auth-page\s*\{[\s\S]*?grid-template-columns:\s*minmax\(320px, 0\.9fr\) minmax\(360px, 1\.1fr\)/)
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.login-page\.login-auth-page\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/)
  assert.match(css, /\.login-page\.login-auth-page \.login-center\s*\{[\s\S]*?min-width:\s*0/)
})

test('mobile cards and detail header share the same source-aware subtitle component', async () => {
  const [list, detail, component] = await Promise.all([
    readFile(resolve(workspace, 'src/app/leads/LeadsMobile.tsx'), 'utf8'),
    readFile(resolve(workspace, 'src/app/leads/[id]/LeadDetailMobile.tsx'), 'utf8'),
    readFile(resolve(workspace, 'src/components/mobile/LeadContactSubtitle.tsx'), 'utf8'),
  ])

  assert.match(list, /<LeadContactSubtitle/)
  assert.match(detail, /<LeadContactSubtitle/)
  assert.doesNotMatch(list, /☎|◎/)
  assert.match(component, /kind === 'facebook'/)
  assert.match(component, /kind === 'instagram'/)
})
