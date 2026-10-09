// Isolated layout comparison of actual Lead/Client/Task forms against base main; no database.
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const assert = require('node:assert/strict')
const bundledWebpack = require('next/dist/compiled/webpack/webpack')
bundledWebpack.init()

async function main() {
  const deps = process.env.LEGALHUB_QA_NODE_MODULES
  if (!deps) throw new Error('Set LEGALHUB_QA_NODE_MODULES to the bundled Node package directory')
  const { chromium } = require(path.join(deps, 'playwright'))
  const root = process.cwd()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'legalhub-mobile-qa-'))
  const src = path.join(root, 'src').replaceAll('\\', '/')
  const mode = process.env.LEGALHUB_LAYOUT_BASELINE === '1' ? 'baseline' : 'feature'
  let source = src
  if (mode === 'baseline') {
    const { execFileSync } = require('node:child_process')
    const archive = path.join(dir, 'baseline.tar')
    execFileSync('git', ['archive', '-o', archive, '7d5f56ae8e9222e5c2652db576325785ec33634a', 'src'])
    execFileSync('tar', ['-xf', archive, '-C', dir])
    source = path.join(dir, 'src').replaceAll('\\','/')
  }
  await fs.writeFile(path.join(dir, 'entry.tsx'), `
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import Lead from ${JSON.stringify(source + '/app/leads/[id]/page.tsx')};
    import Client from ${JSON.stringify(source + '/app/clients/[id]/page.tsx')};
    import Task from ${JSON.stringify(source + '/app/tasks/page.tsx')};
    import { LanguageProvider } from ${JSON.stringify(source + '/context/LanguageContext.tsx')};
    import ${JSON.stringify(source + '/app/globals.css')};
    const Kind = location.pathname.includes('lead') ? Lead : location.pathname.includes('client') ? Client : Task;
    createRoot(document.getElementById('root')).render(<LanguageProvider><div className="main-content"><Kind/></div></LanguageProvider>);
  `);
  await fs.writeFile(path.join(dir, 'navigation.js'), `
    export const useParams=()=>({id:'record1'}); export const usePathname=()=>location.pathname; export const useSearchParams=()=>new URLSearchParams();
    const router={push:url=>window.qaNavigation=url,refresh:()=>{}};export const useRouter=()=>router;
  `);
  await fs.writeFile(path.join(dir, 'link.js'), `import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}`);
  await fs.writeFile(path.join(dir, 'ts-loader.cjs'), `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}`)
  await fs.writeFile(path.join(dir, 'css-loader.cjs'), `module.exports=function(source){let names={},globals=[];if(this.resourcePath.endsWith('.module.css')){const prefix='qa-'+require('path').basename(this.resourcePath).replace(/[^a-zA-Z]/g,'')+'-';source=source.replace(/:global\\(([^)]+)\\)/g,(_,s)=>{globals.push(s);return 'QAGLOBAL'+(globals.length-1)+'END'}).replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,n)=>{names[n]=prefix+n;return '.'+names[n]}).replace(/QAGLOBAL(\\d+)END/g,(_,n)=>globals[n])}return 'const css='+JSON.stringify(source)+';const style=document.createElement("style");style.textContent=css;document.head.appendChild(style);export default '+JSON.stringify(names)}`)
  await new Promise((resolve, reject) => bundledWebpack.webpack({
    mode: 'development', entry: path.join(dir, 'entry.tsx'), output: { path: dir, filename: 'bundle.js' },
    resolve: { extensions: ['.tsx', '.ts', '.js'], modules: [path.join(root, 'node_modules')], alias: { '@': source, 'next/navigation': path.join(dir, 'navigation.js'), 'next/link': path.join(dir, 'link.js') } },
    module: { rules: [{ test: /\.tsx?$/, use: path.join(dir, 'ts-loader.cjs') }, { test: /\.css$/, use: path.join(dir, 'css-loader.cjs') }] },
  }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()))
  const server = http.createServer(async (req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); res.end(await fs.readFile(path.join(dir, 'bundle.js'))); return }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f4f5f7"><meta name="apple-mobile-web-app-status-bar-style" content="default"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ headless: true })
  const results = []
  try {
    for (const entity of ['lead','client','task']) for (const width of [390,414,430,1024,1440]) for (const lang of ['ru','uk','pl']) {
      const page = await browser.newPage({ viewport: { width, height:900 } })
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      const record = {id:'record1',updatedAt:'2026-10-09T10:00:00.000Z',firstName:'Test',lastName:'Client',fullName:'Test Lead',status:'Новый',source:'manual',notes:'initial',createdAt:'2026-10-09T10:00:00.000Z',cases:[],phones:[],travelHistory:[],familyLinks:[],previousPolandStays:[],customFieldValues:{}};
      const task={id:'task1',updatedAt:record.updatedAt,title:'QA task',priority:'Нормально',status:'todo',description:'',createdAt:record.createdAt};
      await page.route('**/api/**', async route=> {
        const url=new URL(route.request().url());let data=[];
        if(url.pathname.includes('/leads/record1') && !url.pathname.endsWith('/messages') && !url.pathname.endsWith('/reminders'))data=record;
        else if(url.pathname==='/api/clients/record1')data=record;
        else if(url.pathname==='/api/tasks/task1')data=task;
        else if(url.pathname==='/api/tasks')data=[task];
        else if(url.pathname==='/api/task-priorities')data=[{id:1,name:'Нормально',color:'#22c55e'}];
        else if(url.pathname==='/api/clients')data=[record];
        else if(url.pathname==='/api/staff-scope')data={restricted:false,employees:[],defaultScope:'all'};
        else if(url.pathname==='/api/auth/me')data={role:'owner',name:'QA'};
        else if(url.pathname==='/api/custom-field-values')data={sections:[],expectedUpdatedAt:record.updatedAt};
        else if(url.pathname==='/api/lead-sources')data={sources:[]};
        else if(url.pathname==='/api/ui-section-settings')data={settings:[]};
        await route.fulfill({json:data});
      });
      await page.addInitScript(lang=>localStorage.setItem('rezi_lang',lang),lang);
      await page.goto(origin+'/'+entity);
      if(entity==='task')await page.getByText('QA task',{exact:true}).filter({visible:true}).first().click();
      await page.locator('input:visible').first().waitFor();await new Promise(resolve=>setTimeout(resolve,250));
      const size=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert.deepEqual(errors,[]);results.push({entity,width,lang,...size});await page.close();
    }
    await fs.writeFile('docs/qa/entity-layout-'+mode+'.json',JSON.stringify(results,null,2)+'\n');
    console.log(JSON.stringify({mode,combinations:results.length,overflows:results.filter(row=>row.scroll>row.viewport)}));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(error);process.exitCode=1});
