import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/server') return nextResolve('next/server.js', context)
    if (specifier.startsWith('@/')) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context)
    if (specifier.startsWith('./') && context.parentURL?.endsWith('.ts') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
})

process.env.JWT_SECRET = 'synthetic-conference-demo-session-test-secret'

const { NextRequest } = await import('next/server')
const { middleware } = await import('../src/middleware.ts')
const { POST: exitDemo } = await import('../src/app/api/conference/demo/exit/route.ts')
const { signToken } = await import('../src/lib/authToken.ts')
const { decodeJwt } = await import('jose')

const demoToken = await signToken({ id: 1, organizationId: 'synthetic-a', sessionMode: 'conference_demo' }, '4h')
const otherDemoToken = await signToken({ id: 2, organizationId: 'synthetic-b', sessionMode: 'conference_demo' }, '4h')
const normalToken = await signToken({ id: 3, organizationId: 'synthetic-a' }, '4h')
const expiredToken = await signToken({ id: 4, organizationId: 'synthetic-a', sessionMode: 'conference_demo' }, -1)

function request(pathname, { method = 'GET', token, origin, headers = {}, body } = {}) {
  return new NextRequest(`https://synthetic.example${pathname}`, {
    method,
    headers: { ...(token ? { cookie: `auth-token=${token}` } : {}), ...(origin ? { origin } : {}), ...headers },
    ...(body ? { body: new URLSearchParams(body) } : {}),
  })
}

test('reading public auth pages never clears a valid demo session', async () => {
  for (const pathname of ['/login', '/register?plan=free']) {
    for (const method of ['GET', 'HEAD']) {
      for (const headers of [{}, { 'Next-Router-Prefetch': '1', Purpose: 'prefetch' }, { RSC: '1' }]) {
        const response = await middleware(request(pathname, { method, token: demoToken, headers }))
        assert.equal(response.status, 200)
        assert.equal(response.cookies.get('auth-token'), undefined, `${method} ${pathname} must not set or delete auth-token`)
        assert.equal((await middleware(request('/tasks', { token: demoToken }))).status, 200)
      }
    }
  }
})

test('public page reads do not change normal, expired or absent auth cookies', async () => {
  for (const token of [normalToken, expiredToken, undefined]) {
    const response = await middleware(request('/login', { token }))
    assert.equal(response.cookies.get('auth-token'), undefined)
    if (token === normalToken) assert.equal(response.headers.get('location'), 'https://synthetic.example/dashboard')
  }
  assert.equal((await middleware(request('/settings', { token: demoToken }))).headers.get('location'), 'https://synthetic.example/dashboard')
  assert.equal((await middleware(request('/api/organizations', { method: 'GET', token: demoToken }))).status, 403)
})

test('demo exit requires a current signed demo cookie and an explicit same-origin POST', async () => {
  for (const [intent, destination] of [['login', '/login'], ['register', '/register?plan=free']]) {
    for (const token of [demoToken, otherDemoToken]) {
      const response = await exitDemo(request('/api/conference/demo/exit', {
        method: 'POST', token, origin: 'https://synthetic.example', body: { intent },
      }))
      assert.equal(response.status, 303)
      assert.equal(response.headers.get('location'), `https://synthetic.example${destination}`)
      assert.equal(response.cookies.get('auth-token')?.value, '')
      assert.equal(response.cookies.get('auth-token')?.expires?.getTime(), 0)
      assert.deepEqual(response.cookies.getAll().map(cookie => cookie.name), ['auth-token'])
      assert.equal(response.headers.get('cache-control'), 'no-store')
    }
  }
  for (const token of [normalToken, expiredToken, undefined]) {
    const response = await exitDemo(request('/api/conference/demo/exit', {
      method: 'POST', token, origin: 'https://synthetic.example', body: { intent: 'login' },
    }))
    assert.equal(response.status, 403)
    assert.equal(response.cookies.get('auth-token'), undefined)
  }
})

test('cross-origin and arbitrary redirect attempts cannot clear the demo cookie', async () => {
  const cases = [
    ['/api/conference/demo/exit', { origin: 'https://attacker.example', body: { intent: 'login' } }, 403],
    ['/api/conference/demo/exit', { body: { intent: 'login' } }, 403],
    ['/api/conference/demo/exit', { origin: 'https://synthetic.example', headers: { 'sec-fetch-site': 'cross-site' }, body: { intent: 'login' } }, 403],
    ['/api/conference/demo/exit?next=https://attacker.example', { origin: 'https://synthetic.example', body: { intent: 'login' } }, 400],
    ['/api/conference/demo/exit', { origin: 'https://synthetic.example', body: { intent: 'https://attacker.example' } }, 400],
    ['/api/conference/demo/exit', { origin: 'https://synthetic.example', body: { intent: 'login', redirect: 'https://attacker.example' } }, 400],
  ]
  for (const [path, options, status] of cases) {
    const response = await exitDemo(request(path, { method: 'POST', token: demoToken, ...options }))
    assert.equal(response.status, status)
    assert.equal(response.cookies.get('auth-token'), undefined)
  }
})

test('page reads preserve signed demo TTL and separate organization sessions', async () => {
  for (const token of [demoToken, otherDemoToken]) {
    const expiration = decodeJwt(token).exp
    const response = await middleware(request('/register?plan=free', { token, headers: { RSC: '1' } }))
    assert.equal(response.cookies.get('auth-token'), undefined)
    assert.equal(decodeJwt(token).exp, expiration)
    assert.equal((await middleware(request('/tasks', { token }))).status, 200)
  }
  assert.notEqual(decodeJwt(demoToken).organizationId, decodeJwt(otherDemoToken).organizationId)
})
