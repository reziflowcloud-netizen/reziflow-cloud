import assert from 'node:assert/strict'
import test from 'node:test'
import { leadScopeOwner, leadScopeStorageKey, parseLeadScope, validateLeadScope, restoreLeadScope, readLeadScope, writeLeadScope, readLeadScopeQuery, writeLeadScopeQuery } from '../src/lib/leadScopePersistence.ts'

const metadata = { userId: 7, organizationId: 'qa-a', restricted: false, controlVisible: true, mineAvailable: true, employees: [{id: 11, name: 'Synthetic'}] }
const owner = leadScopeOwner(metadata.userId, metadata.organizationId)

test('all, mine and active accessible employee restore from owner-bound URLs', () => {
  for (const scope of ['all','mine','employee:11']) {
    const params = new URLSearchParams({ staffScope: scope, staffScopeOwner: owner, status:'QA', source:'manual', interest:'QA' })
    assert.equal(restoreLeadScope(params, owner, 'all', metadata), scope)
    assert.equal(params.get('status'), 'QA')
  }
})

test('legacy and foreign user/org URLs use only the current namespace', () => {
  for (const foreign of [null, leadScopeOwner(8,'qa-a'), leadScopeOwner(7,'qa-b')]) {
    const params = new URLSearchParams({staffScope:'employee:11'})
    if (foreign) params.set('staffScopeOwner', foreign)
    assert.equal(restoreLeadScope(params, owner, 'mine', metadata), 'mine')
    assert.equal(restoreLeadScope(params, owner, null, metadata), 'all')
  }
  assert.notEqual(leadScopeStorageKey(owner), leadScopeStorageKey(leadScopeOwner(8,'qa-a')))
  assert.notEqual(leadScopeStorageKey(owner), leadScopeStorageKey(leadScopeOwner(7,'qa-b')))
})

test('inactive, deleted, inaccessible and invalid employees fall back safely', () => {
  for (const scope of ['employee:12','employee:0','employee:-1','employee:1e2','employee:01','employee:9007199254740992', {}, 'broken']) {
    assert.equal(validateLeadScope(scope,metadata), 'all')
  }
  assert.equal(validateLeadScope('employee:11',{...metadata,employees:[]}), 'all')
  assert.equal(validateLeadScope('mine',{...metadata,mineAvailable:false}), 'all')
})

test('restricted permissions and disabled controls cannot be expanded by persistence', () => {
  for(const scope of ['all','mine','employee:11']) {
    assert.equal(validateLeadScope(scope,{...metadata,restricted:true,mineAvailable:false}), 'mine')
    assert.equal(validateLeadScope(scope,{...metadata,controlVisible:false}), 'all')
  }
})

test('storage is optional and malformed entries are ignored', () => {
  const broken = {getItem(){throw Error('unavailable')},setItem(){throw Error('quota')}}
  assert.equal(readLeadScope(owner,broken),null)
  assert.doesNotThrow(()=>writeLeadScope(owner,'mine',broken))
  assert.equal(readLeadScope(owner,{getItem(){return '{bad json'}}),null)
  assert.equal(parseLeadScope(null),null)
  const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)}
  writeLeadScope(owner,'mine',storage)
  assert.equal(readLeadScope(owner,storage),'mine')
  assert.equal(readLeadScope(leadScopeOwner(8,'qa-a'),storage),null)
})

test('metadata outage preserves exact scope binding or absence while other filters change', () => {
  for (const raw of ['', 'staffScope=mine', new URLSearchParams({staffScope:'employee:11',staffScopeOwner:owner}).toString(), new URLSearchParams({staffScope:'mine',staffScopeOwner:leadScopeOwner(8,'qa-b')}).toString()]) {
    const original = new URLSearchParams(raw)
    const rebuilt = new URLSearchParams({status:'changed',source:'manual',interest:'QA',staffScope:'all',staffScopeOwner:owner})
    writeLeadScopeQuery(rebuilt,readLeadScopeQuery(original))
    assert.deepEqual(readLeadScopeQuery(rebuilt),readLeadScopeQuery(original))
    assert.equal(rebuilt.get('status'),'changed')
    assert.equal(rebuilt.get('interest'),'QA')
    const detail = new URL('http://localhost/leads/qa?backTo='+encodeURIComponent('/leads?'+rebuilt))
    assert.deepEqual(readLeadScopeQuery(new URL('http://localhost'+detail.searchParams.get('backTo')).searchParams),readLeadScopeQuery(original))
  }
})
