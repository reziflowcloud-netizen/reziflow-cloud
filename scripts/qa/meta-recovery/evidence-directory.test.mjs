import test from 'node:test'
import assert from 'node:assert/strict'
import {isQaResultDirectoryName} from './secret-safety.mjs'
test('previous evidence names and the exact separate resumed cycle are permitted',()=>{
 for(const name of ['meta-recovery-20261110','meta-recovery-alias-e2e-20261110'])assert.equal(isQaResultDirectoryName(name),true)
})
test('arbitrary cycle suffixes, paths and confusing names remain refused',()=>{
 for(const name of ['meta-recovery-alias-e2e-20261111','meta-recovery-alias-e2e-20261110-extra','../meta-recovery-20261110','meta-recovery-20261110/other','meta-recovery-20261110\\other','meta-recovery-2026111',null,{},'production'])assert.equal(isQaResultDirectoryName(name),false)
})
