// Loopback-only real app harness. Never reads repository env files. All credentials below are disposable synthetic QA values.
const fs = require('fs'),
  path = require('path'),
  cp = require('child_process')
const root = path.resolve(__dirname, '..'),
  app = path.join(
    root,
    process.argv[2]?.startsWith('build') ? 'work/actualization-build' : 'work/actualization-app',
  )
fs.mkdirSync(app, { recursive: true })
for (const name of process.argv[2]?.startsWith('build')
  ? ['public']
  : ['public', 'node_modules', 'prisma', 'scripts'])
  if (!fs.existsSync(path.join(app, name)))
    fs.symlinkSync(path.join(root, name), path.join(app, name), 'dir')
if (process.argv[2]?.startsWith('build')) {
  for (const name of ['node_modules', 'prisma', 'scripts']) {
    const dest = path.join(app, name)
    if (fs.existsSync(dest) && fs.lstatSync(dest).isSymbolicLink()) fs.unlinkSync(dest)
    if (name !== 'node_modules') fs.cpSync(path.join(root, name), dest, { recursive: true })
  }
}
const src = path.join(app, 'src')
if (fs.existsSync(src) && fs.lstatSync(src).isSymbolicLink()) fs.unlinkSync(src)
if (['dev', 'build', 'build-prepare', 'typecheck'].includes(process.argv[2])) {
  const digest = require('./actualization-source-evidence.cjs').digest
  if (!fs.existsSync(src) || digest(src) !== digest(path.join(root, 'src'))) {
    fs.rmSync(src, { recursive: true, force: true })
    fs.cpSync(path.join(root, 'src'), src, { recursive: true })
  }
  if (digest(src) !== digest(path.join(root, 'src'))) throw Error('Source snapshot mismatch')
  fs.writeFileSync(
    path.join(app, 'source-digest.json'),
    JSON.stringify({ sourceDigest: digest(src) }),
  )
}
for (const name of [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'next.config.js',
  'next.config.mjs',
  'postcss.config.js',
  'tailwind.config.ts',
  'tailwind.config.js',
  'next-env.d.ts',
])
  if (
    fs.existsSync(path.join(root, name)) &&
    (!fs.existsSync(path.join(app, name)) ||
      fs.readFileSync(path.join(root, name), 'utf8') !==
        fs.readFileSync(path.join(app, name), 'utf8'))
  )
    fs.copyFileSync(path.join(root, name), path.join(app, name))
const inherited = {}
for (const key of [
  'PATH',
  'HOME',
  'TMPDIR',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'CHROMIUM_PATH',
])
  if (process.env[key]) inherited[key] = process.env[key]
const env = {
  ...inherited,
  DATABASE_URL: 'postgresql://actualization_qa:disposable_only@127.0.0.1:55435/actualization_qa',
  JWT_SECRET: 'local-synthetic-decision-qa-key-only-2026',
  NEXT_TELEMETRY_DISABLED: '1',
}
delete env.DIRECT_URL

const [mode, ...args] = process.argv.slice(2)
if (mode === 'build-prepare') process.exit(0)
let command = mode,
  argv = args,
  cwd = root
if (mode === 'dev') {
  command = process.execPath
  argv = [
    path.join(root, 'node_modules/next/dist/bin/next'),
    'dev',
    app,
    '--hostname',
    '127.0.0.1',
    '--port',
    '3127',
  ]
  cwd = app
}
if (mode === 'typecheck') {
  command = process.execPath
  argv = [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit']
  cwd = app
}
if (mode === 'build') {
  if (!fs.existsSync(path.join(app, 'node_modules/next/package.json'))) {
    const install = cp.spawnSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['ci', '--ignore-scripts'],
      { cwd: app, env, stdio: 'inherit' },
    )
    if (install.status !== 0) process.exit(install.status ?? 1)
  }
  command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  argv = ['run', 'build']
  cwd = app
}
const r = cp.spawnSync(command, argv, { cwd, env, stdio: 'inherit' })
process.exit(r.status ?? 1)
