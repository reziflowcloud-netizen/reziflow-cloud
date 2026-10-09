// A private loopback runtime plus a restricted QA-only reverse proxy for an HTTPS tunnel.
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')
const assert = require('node:assert/strict')
const state = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
const database = new URL(state.databaseUrl)
assert.equal(database.hostname, '127.0.0.1'); assert.equal(database.port, '55432'); assert.equal(database.pathname, '/legalhub_case_qa')
assert.equal(path.resolve(state.workspace), process.cwd())
for (const base of [state.workspace, path.join(state.workspace, '.next/standalone')]) {
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    assert.ok(!fs.existsSync(path.join(base, name)), `QA refuses an environment file: ${name}`)
  }
}
// Never inherit integration, billing, SMTP, production DB, or cloud credentials.
const systemKeys = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'USERPROFILE'])
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => systemKeys.has(key.toUpperCase())))
Object.assign(env, { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: state.databaseUrl, JWT_SECRET: state.jwtSecret, HOSTNAME: '127.0.0.1', PORT: '3107' })
if (process.argv[2] === 'build') {
  env.DATABASE_URL = 'postgresql://qa:qa@127.0.0.1:1/legalhub_qa'
  for (const args of [['node_modules/prisma/build/index.js', 'generate'], ['node_modules/next/dist/bin/next', 'build']]) {
    const result = spawnSync(process.execPath, args, { env, cwd: state.workspace, stdio: 'inherit', windowsHide: true })
    if (result.status !== 0) process.exit(result.status || 1)
  }
  fs.cpSync(path.join(state.workspace, 'public'), path.join(state.workspace, '.next/standalone/public'), { recursive: true })
  fs.cpSync(path.join(state.workspace, '.next/static'), path.join(state.workspace, '.next/standalone/.next/static'), { recursive: true })
  process.exit(0)
}
assert.equal(process.argv[2], 'serve')
const child = spawn(process.execPath, [path.join(state.workspace, '.next/standalone/server.js')], { env, stdio: 'inherit', windowsHide: true })
const loginLimits = new Map()
const proxy = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1:3108').pathname
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
  res.setHeader('X-LegalHub-Environment', 'isolated-iphone-qa')
  if (Date.now() >= Date.parse(state.expiresAt)) { res.writeHead(503); res.end('QA session expired'); return }
  const readable = !pathname.startsWith('/api/') || /^\/api\/(auth\/me|cases(?:\/[^/]+(?:\/documents)?)?|clients(?:\/[^/]+)?|employees|services|statuses|case-options|custom-sections|custom-field-values|organization-settings|ui-section-settings|user-preferences|users|tasks(?:\/[^/]+)?|staff-scope|notifications\/meta-messages|leads(?:\/[^/]+(?:\/(?:messages|reminders))?)?|billing|lead-statuses|lead-sources|task-priorities)$/.test(pathname)
  const permitted = (['GET', 'HEAD'].includes(req.method) && readable)
    || (req.method === 'POST' && ['/api/auth/login', '/api/auth/logout'].includes(pathname))
    || (req.method === 'PATCH' && (/^\/api\/(?:cases|leads|clients|tasks)\/[^/]+$/.test(pathname) || pathname === '/api/custom-field-values'))
  if (!permitted || /^\/api\/(webhooks|contact|partner|conference|meta|auth\/(register|forgot-password|reset-password))/.test(pathname)) {
    res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'This operation is disabled in isolated iPhone QA' })); return
  }
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const key = req.headers['cf-connecting-ip'] || req.socket.remoteAddress
    const attempts = (loginLimits.get(key) || []).filter(time => Date.now() - time < 300000)
    if (attempts.length >= 20) { res.writeHead(429); res.end('QA login rate limit'); return }
    attempts.push(Date.now()); loginLimits.set(key, attempts)
  }
  if (!pathname.startsWith('/_next/')) res.setHeader('Cache-Control', 'no-store')
  const headers = { ...req.headers, 'x-forwarded-host': req.headers.host, 'x-forwarded-proto': req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http' }
  const upstream = http.request({ hostname: '127.0.0.1', port: 3107, path: req.url, method: req.method, headers }, response => {
    for (const [key, value] of Object.entries(response.headers)) if (value !== undefined && !['cache-control', 'x-robots-tag'].includes(key)) res.setHeader(key, value)
    res.writeHead(response.statusCode); response.pipe(res)
  })
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('QA app unavailable') })
  req.pipe(upstream)
})
const shutdown = () => { proxy.close(); child.kill(); process.exit() }
child.on('exit', () => shutdown())
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown)
proxy.listen(3108, '127.0.0.1', () => console.log('Isolated iPhone QA proxy listening on 127.0.0.1:3108'))
setTimeout(shutdown, Math.max(1, Date.parse(state.expiresAt) - Date.now()))
