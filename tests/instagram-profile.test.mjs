import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  INSTAGRAM_LEAD_FALLBACK_NAME,
  fetchInstagramProfile,
  instagramProfileValues,
} from '../src/lib/instagramProfile.ts'

const workspace = resolve(import.meta.dirname, '..')
const messagesRouteSource = await readFile(
  resolve(workspace, 'src/app/api/webhooks/meta/messages/[slug]/route.ts'),
  'utf8',
)

test('Instagram profile lookup uses the Instagram Login host and minimum fields', async () => {
  let requestedUrl
  const profile = await fetchInstagramProfile('external-igsid', 'test-token', 'v26.0', async input => {
    requestedUrl = new URL(String(input))
    return new Response(JSON.stringify({
      id: 'external-igsid',
      name: 'Display Name',
      username: 'profile_name',
    }), { status: 200 })
  })

  assert.equal(requestedUrl.origin, 'https://graph.instagram.com')
  assert.equal(requestedUrl.pathname, '/v26.0/external-igsid')
  assert.equal(requestedUrl.searchParams.get('fields'), 'id,name,username')
  assert.equal(requestedUrl.searchParams.get('access_token'), 'test-token')
  assert.deepEqual(instagramProfileValues(profile), {
    fullName: 'Display Name',
    instagram: 'profile_name',
  })
})

test('Instagram profile name populates fullName without inventing structured names', () => {
  assert.deepEqual(instagramProfileValues({ id: '1', name: 'Display Name' }), {
    fullName: 'Display Name',
    instagram: null,
  })
})

test('Instagram username provides a useful fallback name', () => {
  assert.deepEqual(instagramProfileValues({ id: '1', username: 'profile_name' }), {
    fullName: '@profile_name',
    instagram: 'profile_name',
  })
})

test('Instagram profile failures remain best effort and preserve the Lead fallback', async () => {
  const httpFailure = await fetchInstagramProfile('external-igsid', 'test-token', 'v26.0', async () => (
    new Response(JSON.stringify({ error: { code: 10 } }), { status: 403 })
  ))
  const networkFailure = await fetchInstagramProfile('external-igsid', 'test-token', 'v26.0', async () => {
    throw new Error('timeout')
  })

  assert.equal(httpFailure, null)
  assert.equal(networkFailure, null)
  assert.deepEqual(instagramProfileValues(httpFailure), {
    fullName: INSTAGRAM_LEAD_FALLBACK_NAME,
    instagram: null,
  })
  assert.match(messagesRouteSource, /await tx\.lead\.create\(/)
  assert.match(messagesRouteSource, /await tx\.leadMessage\.create\(/)
})

test('existing correctly named Instagram Lead is not overwritten', () => {
  assert.match(messagesRouteSource, /channel === 'instagram'\s+\? existingLead\s+\? null\s+: await fetchInstagramProfile\(/)
  assert.doesNotMatch(messagesRouteSource, /tx\.lead\.update\(/)
})

test('Instagram profile lookup is not called for every message or duplicate event', () => {
  assert.match(messagesRouteSource, /args\.channel === 'instagram'\s+\? existingLead\s+\? null\s+: await fetchInstagramProfile\(/)
  assert.match(messagesRouteSource, /channel === 'instagram'\s+\? existingLead\s+\? null\s+: await fetchInstagramProfile\(/)

  const dedupeCheck = messagesRouteSource.indexOf('const existingMessage =')
  const directProfileLookup = messagesRouteSource.lastIndexOf('const profile = channel ===')
  assert.ok(dedupeCheck >= 0 && dedupeCheck < directProfileLookup)
})

test('Facebook Messenger profile behavior and message deduplication remain unchanged', () => {
  assert.match(messagesRouteSource, /https:\/\/graph\.facebook\.com\/\$\{version\}\/\$\{senderId\}/)
  assert.match(messagesRouteSource, /fields', 'name,first_name,last_name,username'/)
  assert.match(messagesRouteSource, /: await fetchFacebookProfile\(/)
  assert.match(messagesRouteSource, /createMany\(\{ data: rowsToCreate, skipDuplicates: true \}\)/)
})
