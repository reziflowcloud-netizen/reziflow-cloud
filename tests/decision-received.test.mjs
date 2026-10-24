import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {readFile} from 'node:fs/promises'
const load=async path=>{const exports={};new Function('exports','require',ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports,()=>({}));return exports}
const {CaseAutosave}=await load('src/lib/caseAutosave.ts')
const {syncCaseDateReminders}=await load('src/lib/caseDateReminders.ts')

test('receipt true and false share the existing minimal autosave queue',async()=>{
 const writes=[];const save=new CaseAutosave(async(patch,version)=>{writes.push({patch,version});return String(writes.length)},()=>{});
 save.initialize({decisionReceived:false,predictedDecisionDate:'2027-02-03',mosNumber:'legacy'},'initial');
 save.change('decisionReceived',true);assert.equal(await save.flush(),true);
 save.change('decisionReceived',false);assert.equal(await save.flush(),true);
 assert.deepEqual(writes,[{patch:{decisionReceived:true},version:'initial'},{patch:{decisionReceived:false},version:'1'}]);save.dispose();
});
test('receipt-only patches never query or mutate reminder data',async()=>{
 const forbidden=new Proxy({}, {get(){throw Error('Reminder database access forbidden')}});
 for(const decisionReceived of [true,false])await syncCaseDateReminders(forbidden,'synthetic',{}, {decisionReceived,expectedUpdatedAt:'version',reminderLanguage:'pl'});
});
test('rapid checkbox toggles debounce to the final value without date keys',async()=>{
 const calls=[];const save=new CaseAutosave(async patch=>{calls.push(patch);return 'next'},()=>{});
 save.initialize({decisionReceived:false,predictedDecisionDate:'2027-02-03'},'initial');
 save.change('decisionReceived',true);await new Promise(r=>setTimeout(r,100));save.change('decisionReceived',false);await new Promise(r=>setTimeout(r,100));save.change('decisionReceived',true);
 assert.equal(calls.length,0);await new Promise(r=>setTimeout(r,950));assert.deepEqual(calls,[{decisionReceived:true}]);save.dispose();
});
test('checkbox CAS conflict retains draft and blocks retry until refresh',async()=>{
 let calls=0;const save=new CaseAutosave(async()=>{calls++;throw Object.assign(Error('stale'),{status:409})},()=>{});
 save.initialize({decisionReceived:false},'stale');save.change('decisionReceived',true);assert.equal(await save.flush(),false);assert.equal(save.state,'conflict');assert.equal(save.values.decisionReceived,true);assert.equal(save.baseline.decisionReceived,false);assert.equal(await save.flush(),false);assert.equal(calls,1);save.dispose();
});
