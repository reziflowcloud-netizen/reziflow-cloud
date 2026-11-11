import {open, lstat, realpath} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import {join, dirname, resolve, basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import {randomUUID} from 'node:crypto'
import {runLeadControl} from './lead-control.mjs'
import {publicTelemetry, assertPublishableText, scanArtifacts, isQaResultDirectoryName} from './secret-safety.mjs'

const same = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && b.nlink === 1
async function noLinks(path) {
  for (let current = resolve(path);;) {
    if ((await lstat(current)).isSymbolicLink()) throw Error('LINK_REFUSED')
    const parent = dirname(current); if (parent === current) break; current = parent
  }
  if (resolve(await realpath(path)).toLowerCase() !== resolve(path).toLowerCase()) throw Error('LINK_REFUSED')
}
async function privateRead(path, guard, max) {
  if (await guard(path) !== true) throw Error('PRIVATE_REFUSED')
  const before = await lstat(path)
  if (!before.isFile() || before.nlink !== 1 || before.size > max) throw Error('PRIVATE_REFUSED')
  const handle = await open(path, 'r')
  try {
    if (!same(before, await handle.stat())) throw Error('PRIVATE_CHANGED')
    const bytes = Buffer.alloc(max + 1); let length = 0
    while (length < bytes.length) {
      const part = await handle.read(bytes, length, bytes.length - length, length)
      if (!part.bytesRead) break; length += part.bytesRead
    }
    if (length > max || !same(before, await handle.stat()) || !same(before, await lstat(path)) || await guard(path) !== true) throw Error('PRIVATE_CHANGED')
    return new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(0, length))
  } finally { await handle.close() }
}
async function main() {
  const action = process.argv[2]
  if (![3,4].includes(process.argv.length) || !['old-test-check', 'delete-confirmed-old', 'mark-create-attempt', 'capture-created-lead'].includes(action)) throw Error('ACTION_REFUSED')
  const deleteConfirmed=process.argv.length===4 && process.argv[3]==='--delete-own-synthetic-confirmed'
  if(process.argv.length===4 && (!deleteConfirmed || action!=='delete-confirmed-old'))throw Error('ACTION_REFUSED')
  const here = dirname(fileURLToPath(import.meta.url))
  const runtimeFile = process.env.QA_STAGE_A_PRIVATE_CONFIG, pwsh = process.env.QA_PWSH_EXE
  if (!runtimeFile || !pwsh || basename(runtimeFile) !== 'runtime.json') throw Error('INPUT_REFUSED')
  const root = dirname(resolve(runtimeFile))
  const guard = async path => {
    const checked = spawnSync(pwsh, ['-NoProfile', '-NonInteractive', '-File', join(here, 'assert-private.ps1'),
      '-PrivateRoot', root, '-Path', path], {windowsHide: true, stdio: 'ignore', timeout: 20000})
    return !checked.error && checked.status === 0
  }
  const c = JSON.parse(await privateRead(runtimeFile, guard, 131072))
  if (c.privateDirectory !== root || c.qaPwshExecutable !== pwsh || c.appId !== '2523488421395251' ||
      c.approvedMetaAppId !== c.appId || c.pageId !== '1449474971582722' || c.formId !== '2046130655900851') throw Error('RUNTIME_REFUSED')
  const knownSecrets = [c.databaseUrl, ...Object.values(c.secrets || {}), ...Object.values(c.passwords || {})]
    .filter(value => typeof value === 'string' && value.length > 0)
  for (const name of ['meta-user-token.txt', 'meta-app-secret.txt', 'meta-page-token.txt']) {
    const value = (await privateRead(join(root, name), guard, 4096)).trim()
    if (value) knownSecrets.push(value)
  }
  const resultRoot = resolve(process.env.QA_RESULT_DIRECTORY || ''), checkout = resolve(here, '../../..')
  if (dirname(resultRoot) !== join(checkout, '.qa') || !isQaResultDirectoryName(basename(resultRoot))) throw Error('RESULT_REFUSED')
  await noLinks(resultRoot)
  const file = join(resultRoot, `lead-control-${action}-${randomUUID()}.json`)
  const ignored = spawnSync(process.env.QA_GIT_EXE, ['-C', checkout, 'check-ignore', '--quiet', file],
    {windowsHide: true, stdio: 'ignore', timeout: 20000})
  if (ignored.error || ignored.status !== 0) throw Error('RESULT_NOT_IGNORED')
  const paths = [file, join(resultRoot, 'graph-preflight-result.json')]
  const placeholder = JSON.stringify(publicTelemetry({phase: 'test_lead', status: 'BLOCKED', counts: {requests: 0, accepted: 0}})) + '\n'
  assertPublishableText(placeholder, {knownSecrets})
  const output = await open(file, 'wx', 0o600)
  let result, text
  try {
    await output.writeFile(placeholder); await output.sync()
    const before = await output.stat()
    await scanArtifacts({root: resultRoot, paths, knownSecrets})
    result = await runLeadControl({action, deleteOwnSyntheticConfirmed:deleteConfirmed, privateRoot: root, assertPrivateFile: guard, artifacts: {root: resultRoot, paths}})
    text = JSON.stringify(result)
    assertPublishableText(text, {knownSecrets})
    await noLinks(resultRoot)
    if (!same(before, await output.stat()) || !same(before, await lstat(file))) throw Error('RESULT_CHANGED')
    const bytes = Buffer.from(text + '\n'); let offset = 0
    while (offset < bytes.length) {
      const written = await output.write(bytes, offset, bytes.length - offset, offset)
      if (written.bytesWritten <= 0) throw Error('RESULT_WRITE_FAILED'); offset += written.bytesWritten
    }
    await output.truncate(bytes.length); await output.sync()
  } finally { await output.close() }
  await scanArtifacts({root: resultRoot, paths, knownSecrets})
  console.log(text)
  if (result.status !== 'PASS') process.exitCode = 1
}
main().catch(() => {
  console.log('{"phase":"test_lead","status":"BLOCKED","code":"LOCAL_LEAD_CONTROL_REFUSED"}')
  process.exitCode = 1
})
