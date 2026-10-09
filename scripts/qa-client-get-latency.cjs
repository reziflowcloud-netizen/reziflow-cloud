// Runs the actual route handler with real disposable PostgreSQL and synthetic auth.
// No production credentials, SQL parameters, or record values enter the report.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises'), path = require('node:path')
const net = require('node:net'), http = require('node:http')
const { execFileSync } = require('node:child_process')
const ts = require('typescript'), { PrismaClient } = require('@prisma/client')
const { NextRequest } = require('next/server')
const database = new URL(process.env.DATABASE_URL || '')
assert.equal(database.hostname, '127.0.0.1'); assert.equal(database.port, '55432'); assert.equal(database.pathname, '/legalhub_case_qa')
const routePath = 'src/app/api/clients/[id]/route.ts'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const report = { isolatedDatabase: true, productionUntouched: true, fixture: {}, samples: [], checks: {} }
const admin = new PrismaClient()
let user, client, org, foreign, stranger, relative, outsider
async function proxy(latency) {
  const sockets = new Set()
  const server = net.createServer(down => {
    const up = net.connect(55432, '127.0.0.1'); sockets.add(down); sockets.add(up)
    for (const [from, to] of [[down, up], [up, down]]) {
      let chain = Promise.resolve()
      from.on('data', bytes => { chain = chain.then(async () => { if (latency) await delay(latency); if (!to.destroyed) to.write(bytes) }) })
      from.on('error', () => to.destroy()); from.on('close', () => { sockets.delete(from); to.destroy() })
    }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { port: server.address().port, close: () => { for (const s of sockets) s.destroy(); server.close() } }
}
async function loadRoute(source, db, account) {
  const cache = new Map()
  function load(filename, supplied) {
    if (cache.has(filename)) return cache.get(filename)
    const exports = {}; cache.set(filename, exports)
    const text = supplied ?? require('node:fs').readFileSync(filename, 'utf8')
    const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
    const localRequire = id => {
      if (id === '@/lib/prisma' || id === './prisma') return { prisma: db }
      if (id === '@/lib/auth') return { getUser: async () => account, getOrganizationId: () => account.organizationId }
      if (id === '@/lib/cloudinary') return {}
      if (id.startsWith('@/') || id.startsWith('.')) {
        const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(filename), id)
        if (require('node:fs').existsSync(resolved + '.ts')) return load(resolved + '.ts')
      }
      return require(id)
    }
    new Function('require', 'exports', code)(localRequire, exports)
    return exports
  }
  return load(path.resolve(routePath), source)
}
async function sample(label, source, latency = 0, connectionLimit = 1, abort = false, account = user, record = client) {
  const transport = await proxy(latency)
  const url = new URL(database); url.port = String(transport.port)
  url.searchParams.set('connection_limit', String(connectionLimit)); url.searchParams.set('pool_timeout', '15')
  const db = new PrismaClient({ datasources: { db: { url: url.href } }, log: [{ emit: 'event', level: 'query' }] })
  const events = [], operations = []
  db.$on('query', event => events.push({ command: event.query.match(/^(BEGIN|COMMIT|ROLLBACK|SET)/)?.[0] || 'SELECT', table: event.query.match(/FROM\s+"public"\."([^"]+)"/)?.[1] || null, durationMs: event.duration, at: event.timestamp.getTime() }))
  db.$use(async (params, next) => {
    const started = Date.now(), op = { model: params.model, action: params.action, inTransaction: params.runInTransaction, durationMs: 0 }
    operations.push(op)
    try { return await next(params) } finally { op.durationMs = Date.now() - started }
  })
  let server, finished
  try {
    await db.$connect(); await db.$queryRaw`SELECT 1`; events.length = 0; operations.length = 0
    const route = await loadRoute(source, db, account)
    let resolveDone; const done = new Promise(resolve => { resolveDone = resolve })
    server = http.createServer(async (req, res) => {
      const controller = new AbortController(), started = Date.now()
      res.on('close', () => { if (!res.writableEnded) controller.abort() })
      let status, code, body, errorDetail, stackFrames
      try {
        const response = await route.GET(new NextRequest('http://localhost' + req.url, { signal: controller.signal }), { params: { id: record.id } })
        status = response.status; body = await response.json()
      } catch (error) {
        status = 500; code = error.code
        errorDetail = error.meta?.error
        stackFrames = String(error.stack).split('\n').filter(line => /^\s+at /.test(line)).slice(0, 10)
      }
      const begins = events.filter(e => e.command === 'BEGIN'), ends = events.filter(e => ['COMMIT', 'ROLLBACK'].includes(e.command))
      finished = { label, transportDelayEachDirectionMs: latency, connectionLimit, requestAborted: controller.signal.aborted, status, errorCode: code || null, errorDetail, stackFrames, totalMs: Date.now() - started, sqlCount: events.length, selectCount: events.filter(e => e.command === 'SELECT').length, transactionMs: begins.length && ends.length ? Math.max(...ends.map(e=>e.at)) - Math.min(...begins.map(e=>e.at)) : null, slowestQuery: [...events].sort((a,b)=>b.durationMs-a.durationMs)[0], operations, sql: events }
      report.samples.push(finished)
      if (!res.destroyed) { res.writeHead(status); res.end(JSON.stringify({ status })) }
      resolveDone(body)
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const request = http.get(`http://127.0.0.1:${server.address().port}/api/clients/${record.id}`)
    request.on('error', () => {}); request.on('response', res => res.resume())
    if (abort) setTimeout(() => request.destroy(), 100)
    const body = await done
    console.log(JSON.stringify({ label, status: finished.status, code: finished.errorCode, totalMs: finished.totalMs, sqlCount: finished.sqlCount, transactionMs: finished.transactionMs, aborted: finished.requestAborted }))
    return { ...finished, body }
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await db.$disconnect(); transport.close() }
}
async function main() {
  const stamp = Date.now()
  org = await admin.organization.create({ data: { name: 'Client read latency QA', slug: 'client-latency-' + stamp } })
  foreign = await admin.organization.create({ data: { name: 'Foreign latency QA', slug: 'foreign-latency-' + stamp } })
  user = await admin.user.create({ data: { organizationId: org.id, name: 'Synthetic QA', email: stamp + '@example.invalid', password: 'not-used', role: 'owner' } })
  stranger = await admin.user.create({ data: { organizationId: foreign.id, name: 'Synthetic foreign', email: 'foreign-' + stamp + '@example.invalid', password: 'not-used', role: 'owner' } })
  client = await admin.client.create({ data: { organizationId: org.id, assignedToId: user.id, firstName: 'Synthetic', lastName: 'Latency', phones: { create: Array.from({length:4},(_,i)=>({organizationId:org.id,phone:'QA-'+i,isPrimary:i===0})) }, travelHistory: { create: Array.from({length:12},()=>({country:'QA'})) }, previousPolandStays:{create:Array.from({length:8},(_,order)=>({basis:'QA',order}))} } })
  relative = await admin.client.create({ data: { organizationId: org.id, firstName: 'Relative', lastName: 'QA' } })
  outsider = await admin.client.create({ data: { organizationId: foreign.id, firstName: 'Foreign', lastName: 'QA' } })
  await admin.clientFamilyLink.create({data:{organizationId:org.id,clientId:client.id,relativeClientId:relative.id}})
  const service = await admin.service.create({data:{organizationId:org.id,name:'QA service'}})
  await admin.case.createMany({data:Array.from({length:16},()=>({organizationId:org.id,clientId:client.id,serviceId:service.id,assignedToId:user.id}))})
  const section = await admin.customSection.create({data:{organizationId:org.id,scope:'client',title:'QA custom',fields:{create:Array.from({length:20},(_,i)=>({label:'QA '+i,type:'text'}))}},include:{fields:true}})
  await admin.customFieldValue.createMany({data:section.fields.map(field=>({organizationId:org.id,fieldId:field.id,recordType:'client',recordId:client.id,value:'synthetic-value'}))})
  report.fixture={cases:16,services:1,phones:4,stays:8,travelRows:12,familyLinks:1,customFields:20}
  const before = execFileSync('git',['show','68ab77a24a292505d0beb1000b7e05574c57c1bd:'+routePath],{encoding:'utf8'})
  const stable = execFileSync('git',['show','7d5f56ae8e9222e5c2652db576325785ec33634a:'+routePath],{encoding:'utf8'})
  const after = await fs.readFile(routePath,'utf8')
  assert.equal((await sample('stable-main single connection',stable)).status,200)
  assert.equal((await sample('feature before available connections',before,0,6)).status,200)
  assert.equal((await sample('feature before single connection',before)).errorCode,'P2028')
  assert.equal((await sample('feature before browser disconnect',before,0,1,true)).errorCode,'P2028')
  assert.equal((await sample('feature before slow DB available connections',before,300,6)).errorCode,'P2028')
  report.checks.poolStarvationReproduced='PASS'; report.checks.disconnectNotRequired='PASS'
  const fast=await sample('fixed single connection',after)
  assert.equal(fast.status,200); assert.equal(fast.body.phones.length,4); assert.equal(fast.body.cases.length,16); assert.equal(fast.body.previousPolandStays.length,8); assert.equal(fast.body.familyLinks.length,1); assert.equal(Object.keys(fast.body.customFieldValues).length,20)
  for(let i=1;i<=3;i++){
    const slow=await sample('fixed slow sequential '+i,after,300)
    assert.equal(slow.status,200); assert.ok(slow.totalMs>5000); assert.ok(slow.transactionMs>5000)
    assert.equal(slow.body.updatedAt,fast.body.updatedAt); assert.deepEqual(slow.body.customFieldValues,fast.body.customFieldValues)
  }
  report.checks.slowDatabaseBeyondInteractiveDeadline='PASS';report.checks.parentCustomSnapshotRetained='PASS'
  assert.equal((await sample('fixed foreign tenant',after,0,1,false,stranger)).status,404)
  const restricted=await admin.user.create({data:{organizationId:org.id,name:'Restricted QA',email:'restricted-'+stamp+'@example.invalid',password:'not-used',restrictedAccess:true}})
  assert.equal((await sample('fixed restricted user',after,0,1,false,restricted)).status,404)
  report.checks.tenantAndRestrictedIsolation='PASS'
  report.complete=true
}
main().catch(error=>{report.complete=false;report.failure={name:error.name,code:error.code||null,message:error.message};console.error(error.message);process.exitCode=1}).finally(async()=>{
  await fs.writeFile('docs/qa/client-get-latency.json',JSON.stringify(report,null,2));await admin.$disconnect()
})
