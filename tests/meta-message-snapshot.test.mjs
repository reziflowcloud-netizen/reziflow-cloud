import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { SignJWT } from 'jose'
import { messageSnapshot, parseMessageSnapshot } from '../src/lib/metaMessageSnapshot.ts'
import { verifyToken } from '../src/lib/authToken.ts'
process.env.JWT_SECRET = 'synthetic-snapshot-tests-only'
const user = { id: 1, organizationId: 'synthetic', sessionVersion: 2 }
test('snapshot binds user, tenant, lead and session; cannot authenticate', async () => {
 const token = await messageSnapshot(user, 'lead', [{ id: 30, liveIncoming: true }, { id: 90, liveIncoming: false }, { id: 20, liveIncoming: true }])
 assert.equal(await parseMessageSnapshot(token,user,'lead'),30)
 assert.equal(await verifyToken(token),null)
 for (const [u,l] of [[{...user,id:2},'lead'],[{...user,organizationId:'other'},'lead'],[{...user,sessionVersion:3},'lead'],[user,'other']]) assert.equal(await parseMessageSnapshot(token,u,l),null)
 assert.equal(await parseMessageSnapshot(token.slice(0,-8)+'tampered',user,'lead'),null)
 const key=createHmac('sha256',process.env.JWT_SECRET).update('legalhub/meta-message-snapshot/v1').digest()
 const expired=await new SignJWT({purpose:'meta-message-snapshot',userId:1,organizationId:'synthetic',leadId:'lead',throughId:30,version:2}).setProtectedHeader({alg:'HS256',typ:'meta-message-snapshot+jwt'}).setAudience('legalhub:meta-message-read').setIssuer('legalhub:meta-message-read').setExpirationTime(1).sign(key)
 assert.equal(await parseMessageSnapshot(expired,user,'lead'),null)
})
test('empty snapshot cannot acknowledge future events or use provider time ordering', async()=>{
 assert.equal(await parseMessageSnapshot(await messageSnapshot(user,'lead',[]),user,'lead'),0)
 assert.equal(await parseMessageSnapshot(await messageSnapshot(user,'lead',[{id:2,liveIncoming:true,sentAt:'2099-01-01'},{id:3,liveIncoming:true,sentAt:'2000-01-01'}]),user,'lead'),3)
})
