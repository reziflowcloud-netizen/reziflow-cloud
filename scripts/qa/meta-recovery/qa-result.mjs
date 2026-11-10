import {open, lstat, realpath} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {createHash, randomUUID} from 'node:crypto'
import {join, dirname, resolve, basename} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {publicTelemetry, assertPublishableText, scanArtifacts, isQaResultDirectoryName} from './secret-safety.mjs'
import {assertQaTenantIsolation} from './supervisor-organizations.mjs'

const APP = '2523488421395251', PAGE = '1449474971582722', FORM = '2046130655900851'
const fixed = () => { throw Error('QA_RESULT_REFUSED') }
const count = x => Number.isSafeInteger(x) && x >= 0 && x <= 100000000
const same = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && b.nlink === 1
async function noLinks(path) {
  for (let current = resolve(path);;) {
    if ((await lstat(current)).isSymbolicLink()) fixed()
    const parent = dirname(current); if (parent === current) break; current = parent
  }
  if (resolve(await realpath(path)).toLowerCase() !== resolve(path).toLowerCase()) fixed()
}
async function privateRead(path, guard, max) {
  await noLinks(path)
  if (await guard(path) !== true) fixed()
  const before = await lstat(path)
  if (!before.isFile() || before.nlink !== 1 || before.size > max) fixed()
  const handle = await open(path, 'r')
  try {
    if (!same(before, await handle.stat())) fixed()
    const bytes = Buffer.alloc(max + 1); let length = 0
    while (length < bytes.length) {
      const part = await handle.read(bytes, length, bytes.length - length, length)
      if (!part.bytesRead) break; length += part.bytesRead
    }
    if (length > max || !same(before, await handle.stat()) || !same(before, await lstat(path)) || await guard(path) !== true) fixed()
    return new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(0, length))
  } finally { await handle.close() }
}
function statusCounts(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fixed()
  const output = {}
  for (const [key, value] of Object.entries(input)) {
    if (!/^[1-5][0-9]{2}$/.test(key) || !count(value)) fixed()
    output[key] = value
  }
  return output
}
function gatewayCounts(audit) {
  const output = {}
  for (const key of ['requests', 'challenge200', 'postReceived', 'dashboardSamples', 'hmacValid', 'qaTupleValid', 'forwarded']) {
    if (!count(audit?.[key])) fixed(); output[key] = audit[key]
  }
  output.statuses = statusCounts(audit.statuses)
  output.upstreamStatuses = statusCounts(audit.upstreamStatuses)
  return output
}

// Only fixed statuses/counts leave this pure fact checker. Snapshots contain
// selected QA identifiers solely for private equality comparisons, never contacts.
// A single stored record is not a claim that replay/deduplication was exercised.
export function evaluateQaResult({audit, receipts, leads, notices, employees, pushDeliveries}) {
  const gateway = gatewayCounts(audit)
  if (![receipts, leads, notices, employees].every(Array.isArray) || receipts.length > 3 || leads.length > 3 || notices.length > 3 ||
      employees.length !== 2 || !count(pushDeliveries)) fixed()
  const receiptStatuses = {pending: 0, processing: 0, complete: 0, blocked: 0, shadow: 0, unknown: 0}
  for (const row of receipts) {
    const key = ['pending', 'processing', 'complete', 'blocked', 'shadow'].includes(row?.status) ? row.status : 'unknown'
    receiptStatuses[key]++
  }
  const lead = leads.length === 1 ? leads[0] : null, notice = notices.length === 1 ? notices[0] : null
  const checks = {
    signedDelivery: gateway.postReceived > gateway.dashboardSamples && gateway.hmacValid > gateway.dashboardSamples &&
      gateway.qaTupleValid >= 1 && gateway.forwarded >= 1 && (gateway.upstreamStatuses['200'] || 0) >= 1 ? 'PASS' : 'BLOCKED',
    receipt: receipts.length === 1 && receipts[0].status === 'complete' && lead && receipts[0].leadId === lead.id ? 'PASS' : 'BLOCKED',
    lead: lead && ['facebook_lead_ads', 'instagram_lead_ads', 'meta_lead_ads_unknown'].includes(lead.source) ? 'PASS' : 'BLOCKED',
    routing: lead && employees.some(x => Number.isInteger(x.employeeId) && x.employeeId === lead.employeeId &&
      Number.isInteger(x.userId) && x.userId === lead.assignedToId) ? 'PASS' : 'BLOCKED',
    notification: lead && notice && notice.type === 'lead_assigned' && notice.userId === lead.assignedToId &&
      notice.inApp === true && notice.pushRequested === false && pushDeliveries === 0 ? 'PASS' : 'BLOCKED',
    singleRecords: receipts.length === 1 && leads.length === 1 && notices.length === 1 ? 'PASS' : 'BLOCKED',
  }
  const status = Object.values(checks).every(x => x === 'PASS') ? 'PASS' : 'BLOCKED'
  return Object.freeze({...publicTelemetry({phase: 'crm', status, counts: {receipts: receipts.length, leads: leads.length,
    notifications: notices.length, forwarded: gateway.forwarded}}), checks, gateway, receiptStatuses})
}

async function main() {
  if (process.argv.length !== 2) fixed()
  const here = dirname(fileURLToPath(import.meta.url)), runtimeFile = process.env.QA_STAGE_A_PRIVATE_CONFIG,
    pwsh = process.env.QA_PWSH_EXE
  if (!runtimeFile || !pwsh || basename(runtimeFile) !== 'runtime.json') fixed()
  const root = dirname(resolve(runtimeFile))
  if (!/^D:\\LegalHubStageA-[a-f0-9]{32}$/.test(root) || root.endsWith('e0d6208c7f1b4b61917281dc390a8045')) fixed()
  const guard = async path => {
    const check = spawnSync(pwsh, ['-NoProfile', '-NonInteractive', '-File', join(here, 'assert-private.ps1'),
      '-PrivateRoot', root, '-Path', path], {windowsHide: true, stdio: 'ignore', timeout: 20000})
    return !check.error && check.status === 0
  }
  const c = JSON.parse(await privateRead(runtimeFile, guard, 131072))
  const state = JSON.parse(await privateRead(join(root, 'cluster-state.json'), guard, 131072))
  const real = JSON.parse(await privateRead(join(root, 'meta-real-private.json'), guard, 32768))
  if ((await privateRead(join(root, 'qa-owned.txt'), guard, 256)).trim() !== 'LegalHub Stage A synthetic QA' ||
      c.privateDirectory !== root || c.qaPwshExecutable !== pwsh || resolve(c.repo) !== join(root, 'qa-source') ||
      c.appId !== APP || c.approvedMetaAppId !== APP || c.pageId !== PAGE || c.formId !== FORM ||
      typeof c.organizationId !== 'string' || !c.organizationId || !Array.isArray(c.employees) || c.employees.length !== 2 ||
      real.appId !== APP || real.pageId !== PAGE || real.formId !== FORM ||
      typeof real.approvedLeadId !== 'string' || !/^[1-9][0-9]{5,30}$/.test(real.approvedLeadId) ||
      !Number.isFinite(Date.parse(real.leadCreatedAt)) || Date.parse(real.leadCreatedAt) > Date.now()) fixed()
  const run = state.cluster?.RunId, url = new URL(c.databaseUrl)
  if (!/^stagea[a-f0-9]{32}$/.test(run || '') || state.config?.targetKind !== 'synthetic' ||
      state.config?.privateDirectory !== root || state.config.expectedHost !== '127.0.0.1' || state.config.expectedApplicationHost !== '127.0.0.1' ||
      !['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || !url.port || url.port === '5432' ||
      Number(url.port) !== state.cluster.Port || url.pathname !== '/legalhub_runner_' + run ||
      url.pathname.slice(1) !== state.cluster.Database || c.databaseUrl !== state.cluster.Uri ||
      process.env.DATABASE_URL !== c.databaseUrl || process.env.DIRECT_URL !== c.databaseUrl) fixed()
  const knownSecrets = [c.databaseUrl, ...Object.values(c.secrets || {}), ...Object.values(c.passwords || {})].filter(x => typeof x === 'string' && x.length)
  let pageToken
  for (const name of ['meta-user-token.txt', 'meta-app-secret.txt', 'meta-page-token.txt']) {
    const value = (await privateRead(join(root, name), guard, 4096)).trim()
    if (value) knownSecrets.push(value)
    if (name === 'meta-page-token.txt') pageToken = value
  }
  if (!pageToken || real.tokenSha256 !== createHash('sha256').update(pageToken).digest('hex') ||
      !['tokenApp', 'tokenPage', 'formOwnership'].every(key => real.results?.[key] === 'PASS')) fixed()
  const resultRoot = resolve(process.env.QA_RESULT_DIRECTORY || ''), checkout = resolve(here, '../../..')
  if (dirname(resultRoot) !== join(checkout, '.qa') || !isQaResultDirectoryName(basename(resultRoot))) fixed()
  await noLinks(resultRoot)
  const resultFile = join(resultRoot, 'qa-result-' + randomUUID() + '.json')
  const ignored = spawnSync(process.env.QA_GIT_EXE, ['-C', checkout, 'check-ignore', '--quiet', resultFile],
    {windowsHide: true, stdio: 'ignore', timeout: 20000})
  if (ignored.error || ignored.status !== 0) fixed()
  const output = await open(resultFile, 'wx', 0o600)
  const paths = [resultFile, join(resultRoot, 'graph-preflight-result.json')]
  let db, text, summary
  try {
    const placeholder = JSON.stringify(publicTelemetry({phase: 'crm', status: 'BLOCKED', counts: {leads: 0}})) + '\n'
    assertPublishableText(placeholder, {knownSecrets}); await output.writeFile(placeholder); await output.sync()
    const before = await output.stat()
    await scanArtifacts({root: resultRoot, paths, knownSecrets})
    // Repeat active process/listener ownership checks immediately before connecting.
    const active = spawnSync(pwsh, ['-NoProfile', '-NonInteractive', '-File', join(here, 'verify-running.ps1'),
      '-RuntimeFile', runtimeFile], {windowsHide: true, stdio: 'ignore', timeout: 20000})
    if (active.error || active.status !== 0) fixed()
    await noLinks(c.repo)
    const require = createRequire(join(c.repo, 'package.json')), {PrismaClient} = require('@prisma/client')
    db = new PrismaClient({datasources: {db: {url: c.databaseUrl}}, log: []})
    const snapshot = await db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
      const actual = await tx.$queryRawUnsafe("SELECT current_database() AS name, inet_server_addr()::text AS host, inet_server_port()::int AS port, current_setting('transaction_read_only') AS readonly")
      if (actual.length !== 1 || actual[0].name !== state.cluster.Database || actual[0].host !== '127.0.0.1' || actual[0].port !== state.cluster.Port || actual[0].readonly !== 'on') fixed()
      await assertQaTenantIsolation(tx, c.organizationId)
      const binding = await tx.metaLeadAdsBinding.findMany({where: {organizationId: c.organizationId},
        select: {id: true, appId: true, pageId: true, formId: true}, take: 2})
      if (binding.length !== 1 || binding[0].appId !== APP || binding[0].pageId !== PAGE || binding[0].formId !== FORM) fixed()
      const receipts = await tx.metaLeadAdsDelivery.findMany({where: {organizationId: c.organizationId, bindingId: binding[0].id, appId: APP, leadgenId: real.approvedLeadId},
        select: {status: true, leadId: true}, take: 3})
      const leads = await tx.lead.findMany({where: {organizationId: c.organizationId, messengerId: 'meta-lead-ads:' + real.approvedLeadId},
        select: {id: true, employeeId: true, assignedToId: true, source: true}, take: 3})
      const notices = leads.length === 1 ? await tx.notification.findMany({where: {organizationId: c.organizationId, entityType: 'lead', entityId: leads[0].id},
        select: {id: true, userId: true, type: true, inApp: true, pushRequested: true}, take: 3}) : []
      const pushDeliveries = notices.length ? await tx.notificationPushDelivery.count({where: {organizationId: c.organizationId, notificationId: {in: notices.map(x => x.id)}}}) : 0
      return {receipts, leads, notices, employees: c.employees, pushDeliveries}
    }, {maxWait: 5000, timeout: 15000, isolationLevel: 'RepeatableRead'})
    const audit = JSON.parse(await privateRead(join(root, 'real-http-audit.json'), guard, 32768))
    summary = evaluateQaResult({audit, ...snapshot})
    text = JSON.stringify(summary); assertPublishableText(text, {knownSecrets})
    await noLinks(resultRoot)
    if (!same(before, await output.stat()) || !same(before, await lstat(resultFile))) fixed()
    const bytes = Buffer.from(text + '\n'); let offset = 0
    while (offset < bytes.length) { const part = await output.write(bytes, offset, bytes.length - offset, offset); if (!part.bytesWritten) fixed(); offset += part.bytesWritten }
    await output.truncate(bytes.length); await output.sync()
    await scanArtifacts({root: resultRoot, paths, knownSecrets})
  } finally {
    try { await scanArtifacts({root: resultRoot, paths, knownSecrets}) }
    finally { try { await db?.$disconnect() } finally { await output.close() } }
  }
  console.log(text)
  if (summary.status !== 'PASS') process.exitCode = 1
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(() => {
  console.log('{"phase":"crm","status":"BLOCKED","code":"QA_RESULT_REFUSED"}'); process.exitCode = 1
})
