import test from 'node:test'
import assert from 'node:assert/strict'
import {guardianEnvironment,guardianStoreEnvironment} from './supervisor.mjs'
const root='D:\\LegalHubStageA-public-fixture'
const host='C:\\Users\\fixture\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\powershell\\pwsh.exe'
test('actual guardian adds only its pinned-host owner alias directory',()=>{
 const base=guardianEnvironment(root),actual=guardianStoreEnvironment(root,host)
 assert.deepEqual(Object.keys(actual),Object.keys(base))
 assert.deepEqual(Object.keys(base).filter(k=>base[k]!==actual[k]),['PATH'])
 assert.equal(actual.PATH,base.PATH+';C:\\Users\\fixture\\AppData\\Local\\Microsoft\\WindowsApps')
 for(const name of ['TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'])assert.equal(actual[name],root)
})
test('foreign host roots, traversal and injected PATH separators are refused',()=>{
 for(const bad of ['C:\\Program Files\\PowerShell\\7\\pwsh.exe',host.replace('fixture','fixture;foreign'),host.replace('fixture','fixture\\..\\other'),host.replace('C:\\Users','D:\\Users'),host+'\\extra',null])assert.throws(()=>guardianStoreEnvironment(root,bad))
})
