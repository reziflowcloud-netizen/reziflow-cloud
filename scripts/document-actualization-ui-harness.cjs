// Frontend-only actual-component review. No Prisma, database, authentication backend or repository env reads.
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process')
const root = path.resolve(__dirname, '..'),
  dir = path.join(root, 'work', 'actualization-ui-harness')
const write = (file, text) => {
  const dest = path.join(dir, file)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, text)
}
const source = (file) => JSON.stringify(path.join(root, 'src', file).split(path.sep).join('/'))
write('package.json', JSON.stringify({ private: true, scripts: { dev: 'next dev' } }))
write(
  'tsconfig.json',
  JSON.stringify({
    compilerOptions: {
      allowJs: true,
      jsx: 'preserve',
      moduleResolution: 'bundler',
      esModuleInterop: true,
      paths: { '@/*': [root.replaceAll('\\', '/') + '/src/*'] },
    },
    exclude: ['node_modules'],
  }),
)
write(
  'next.config.js',
  `module.exports={experimental:{externalDir:true},webpack(config){config.resolve.alias['@']=${JSON.stringify(root.replaceAll('\\', '/') + '/src')};return config}}`,
)
if (!fs.existsSync(path.join(dir, 'node_modules')))
  fs.symlinkSync(
    path.join(root, 'node_modules'),
    path.join(dir, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  )
write(
  'app/layout.js',
  `import ${source('app/globals.css')};export default function Layout({children}){return <html><body>{children}</body></html>}`,
)
write(
  'app/cases/layout.js',
  `import UI from ${source('components/AuthenticatedUIProvider')};import Sidebar from ${source('components/layout/Sidebar')};import MobileNav from ${source('components/layout/MobileNav')};import {CaseMobileAccessProvider} from ${source('app/cases/CaseMobileAccessContext')};export default function Layout({children}){return <UI><div style={{display:'flex'}}><Sidebar userName="Synthetic Reviewer" userRole="owner" organizationName="UI ONLY · SYNTHETIC"/><div className="main-content" style={{flex:1}}><aside style={{padding:8,color:'var(--text)',background:'var(--surface)',fontSize:12}}>UI-only synthetic review · server-memory data · no database/security evidence</aside><CaseMobileAccessProvider restrictedAccess={false}>{children}</CaseMobileAccessProvider></div></div><MobileNav/></UI>}`,
)
write('app/cases/[id]/page.js', `export {default} from ${source('app/cases/[id]/page')}`)
write(
  'app/cases/page.js',
  `import Link from 'next/link';export default function Cases(){return <div style={{padding:24}}><h1>Synthetic cases · UI only</h1><Link href="/cases/synthetic-actualization">Open synthetic actualization Case</Link></div>}`,
)
write(
  'app/page.js',
  `import {redirect} from 'next/navigation';export default function Page(){redirect('/cases/synthetic-actualization')}`,
)
write(
  'app/api/[...path]/route.js',
  fs.readFileSync(path.join(root, 'scripts/fixtures/actualization-ui-api.js'), 'utf8'),
)
for (const route of ['tasks', 'calendar']) {
  write(`app/${route}/page.js`, `export {default} from ${source('app/' + route + '/page')}`)
  write(`app/${route}/layout.js`, "export {default} from '../cases/layout'")
}
const env = { NEXT_TELEMETRY_DISABLED: '1' }
for (const key of [
  'PATH',
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'SystemRoot',
  'COMSPEC',
  'TEMP',
  'TMP',
  'TMPDIR',
  'NODE_EXTRA_CA_CERTS',
])
  if (process.env[key]) env[key] = process.env[key]
console.log(
  'UI ONLY · synthetic server-memory fixtures · http://127.0.0.1:3119/cases/synthetic-actualization',
)
console.log(
  'No Prisma/database/authentication server; restart resets fixtures. Do not publish or tunnel.',
)
if (process.argv.includes('--prepare-only')) process.exit(0)
const result = cp.spawnSync(
  process.execPath,
  [
    path.join(root, 'node_modules/next/dist/bin/next'),
    'dev',
    dir,
    '--hostname',
    '127.0.0.1',
    '--port',
    '3119',
  ],
  { cwd: dir, env, stdio: 'inherit' },
)
process.exit(result.status ?? 1)
