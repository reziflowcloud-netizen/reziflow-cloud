// Only prepares fresh disposable local QA databases. No existing/shared DB is accepted.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');process.chdir(root);
const run=(cmd,args,env={})=>{const childEnv={...process.env,...env};if(cmd==='docker'){for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete childEnv[key];args=['--host=unix:///var/run/docker.sock',...args]}const r=cp.spawnSync(cmd,args,{stdio:'inherit',env:childEnv});if(r.status!==0)throw Error(`${cmd} failed (${r.status})`)};
const local=(args,legacy=false)=>run(process.execPath,['scripts/decision-received-local.cjs',...args],legacy?{DECISION_LEGACY_QA:'1'}:{});
const base='2cfa567b7d638682b551088df2274df51096bd7e';
const read=file=>cp.execFileSync('git',['show',`${base}:${file}`],{encoding:'utf8'});
fs.mkdirSync('work/decision-base-prisma/migrations',{recursive:true});
const schema=read('prisma/schema.prisma');fs.writeFileSync('work/decision-base-prisma/schema.prisma',schema);
fs.writeFileSync('work/old-schema.prisma',schema.replace('provider = "prisma-client-js"','provider = "prisma-client-js"\n  output = "../node_modules/.cache/decision-old-client"'));
const files=cp.execFileSync('git',['ls-tree','-r','--name-only',base,'prisma/migrations'],{encoding:'utf8'}).trim().split('\n');
for(const file of files){const dest=path.join('work/decision-base-prisma/migrations',file.slice('prisma/migrations/'.length));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,read(file))}
run('docker',['run','-d','--name','legalhub-decision-qa','--label','codex.qa=decision-received','-e','POSTGRES_USER=decision_qa','-e','POSTGRES_PASSWORD=disposable_only','-e','POSTGRES_DB=decision_qa','-p','127.0.0.1:55434:5432','postgres@sha256:edb0c08dc33befd0262ab3b5cf1c4f3f8cfd8b09e88c05b45adee29d6761ddb6']);
(async()=>{for(let i=0;i<30;i++){const r=cp.spawnSync('docker',['exec','legalhub-decision-qa','pg_isready','-U','decision_qa'],{stdio:'ignore'});if(r.status===0)break;if(i===29)throw Error('PostgreSQL not ready');await new Promise(r=>setTimeout(r,500))}
run('docker',['exec','legalhub-decision-qa','createdb','-U','decision_qa','decision_legacy_qa']);
local(['node','node_modules/prisma/build/index.js','generate']);local(['node','node_modules/prisma/build/index.js','generate','--schema','work/old-schema.prisma']);
local(['node','node_modules/prisma/build/index.js','migrate','deploy']);
local(['node','node_modules/prisma/build/index.js','migrate','deploy','--schema','work/decision-base-prisma/schema.prisma'],true);
local(['node','scripts/qa-decision-legacy.cjs','before'],true);
local(['node','node_modules/prisma/build/index.js','migrate','deploy'],true);
local(['node','scripts/qa-decision-legacy.cjs','after'],true);
for(const file of files){if(fs.readFileSync(file,'utf8')!==read(file))throw Error('Prior migration changed: '+file)}
console.log('PASS full empty chain, pre-existing legacy upgrade, unchanged base migration checksums');
})().catch(e=>{console.error(e);process.exitCode=1});
