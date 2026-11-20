// Load the unchanged actual legacy handler and its dependencies. Only the DB
// instance and post-commit external push transport are injected for local QA.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { once } from 'node:events'
import ts from 'typescript'
import { NextRequest } from 'next/server.js'
const require = createRequire(import.meta.url)
export async function legacyHttpFixture(db, slug) {
  const cache = new Map(), overrides = {
    'src/lib/prisma': { prisma: db }, 'src/lib/assignmentDelivery': { dispatchAssignmentPush: async () => {} },
  }
  function load(file) {
    const normalized = file.replaceAll('\\', '/').replace(/\.(ts|js)$/, '')
    if (overrides[normalized]) return overrides[normalized]
    if (cache.has(normalized)) return cache.get(normalized)
    const filename = fs.existsSync(normalized + '.ts') ? normalized + '.ts' : normalized + '.js'
    if (filename.endsWith('.js')) return require(path.resolve(filename))
    const exports = {}; cache.set(normalized, exports)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
    new Function('require', 'exports', code)(id => id.startsWith('@/') ? load('src/' + id.slice(2))
      : id.startsWith('.') ? load(path.join(path.dirname(filename), id)) : require(id), exports)
    return exports
  }
  const handler = load('src/lib/leadWebhookHandler').handleLeadWebhookPost
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    try {
      const response = await handler(new NextRequest('http://127.0.0.1' + req.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: Buffer.concat(chunks).toString() }), slug, 'synthetic-webhook-key')
      res.writeHead(response.status, { 'Content-Type': 'application/json' }); res.end(await response.text())
    } catch { res.writeHead(500); res.end('Synthetic handler failure') }
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  return { url: `http://127.0.0.1:${server.address().port}/api/webhooks/leads/synthetic`,
    close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }) }
}
