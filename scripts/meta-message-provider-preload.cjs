// Test process only. Refuse inherited remote/shared targets. Never imported by app.
const url = new URL(process.env.DATABASE_URL || 'http://invalid')
if (url.hostname !== '127.0.0.1' || url.port !== '55435' || url.pathname !== '/actualization_qa' || process.env.META_APP_SECRET !== 'synthetic-meta-qa-secret') throw Error('Synthetic loopback fixture only')
const original = globalThis.fetch
let outgoing = 0
globalThis.fetch = async (input, init) => {
 const target = new URL(typeof input === 'string' ? input : input.url || String(input))
 if (target.hostname === 'graph.facebook.com' || target.hostname === 'graph.instagram.com') {
  let data
  if (target.pathname.endsWith('/conversations')) {
   const participant = target.searchParams.get('user_id') || 'history-user'
   data = { data: [{ messages: { data: [{ id: `synced-${participant}`, message: 'Synthetic history', created_time: '2020-01-01T00:00:00Z', from: { id: participant, name: 'Synthetic History' } }] } }] }
  } else if ((init?.method || 'GET') === 'POST') data = { message_id: `synthetic-outgoing-${++outgoing}`, recipient_id: 'synthetic-participant' }
  else data = { id: target.pathname.split('/').pop(), name: 'Synthetic Meta Person', username: 'synthetic_person', first_name: 'Synthetic', last_name: 'Person' }
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
 }
 if (!['127.0.0.1','localhost'].includes(target.hostname)) throw Error('Non-loopback network blocked by synthetic provider fixture')
 return original(input, init)
}
// Capture SQL only in this guarded synthetic process, for exact EXPLAIN and count
// evidence. No result rows, passwords, connection URLs or provider tokens logged.
const Module=require('node:module'),fs=require('node:fs'),path=require('node:path'),load=Module._load,wrapped=new WeakMap()
Module._load=function(name,...args){const value=load.call(this,name,...args);if(name!=='@prisma/client'||!value.PrismaClient)return value
 let Client=wrapped.get(value.PrismaClient)
 if(!Client){Client=class extends value.PrismaClient{constructor(options={}){super({...options,log:[{emit:'event',level:'query'}]});this.$on('query',e=>{if(process.env.QA_META_QUERY_LOG&&/^\s*SELECT/.test(e.query))fs.appendFileSync(process.env.QA_META_QUERY_LOG,JSON.stringify({query:e.query,params:e.params,duration:e.duration})+'\n')})}};wrapped.set(value.PrismaClient,Client)}
 return {...value,PrismaClient:Client}
}
