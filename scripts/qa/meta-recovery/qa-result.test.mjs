import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateQaResult} from './qa-result.mjs'
import {assertPublishableText} from './secret-safety.mjs'

// Private-looking identifiers below are invented fixtures, not real Meta/CRM data.
const snapshot = () => ({audit: {requests: 2, challenge200: 1, postReceived: 1,
  dashboardSamples: 0, hmacValid: 1, qaTupleValid: 1, forwarded: 1,
  statuses: {'200': 2}, upstreamStatuses: {'200': 1}},
  receipts: [{status: 'complete', leadId: 'private-fixture-lead'}],
  leads: [{id: 'private-fixture-lead', employeeId: 21, assignedToId: 31, source: 'facebook_lead_ads',
    fullName: 'Ignored Private Contact', email: 'ignored@example.test'}],
  notices: [{id: 'private-fixture-notice', userId: 31, type: 'lead_assigned', inApp: true, pushRequested: false,
    body: 'Ignored Private Contact', title: 'Ignored Private Contact'}],
  employees: [{employeeId: 21, userId: 31}, {employeeId: 22, userId: 32}], pushDeliveries: 0})
const safe = result => {
  const text = JSON.stringify(result)
  for (const value of ['private-fixture', 'ignored@example.test', 'Ignored Private Contact']) assert.equal(text.includes(value), false)
  assertPublishableText(text)
}
test('exact complete record/routing/in-app notification and signed forwarding yield safe fact counts', () => {
  const result = evaluateQaResult(snapshot())
  assert.equal(result.status, 'PASS'); assert.deepEqual(result.counts, {receipts: 1, leads: 1, notifications: 1, forwarded: 1})
  assert.equal(result.checks.singleRecords, 'PASS'); assert.equal('deduplication' in result.checks, false); safe(result)
})
test('Dashboard-only, unforwarded, missing/incomplete receipt or lead never become processing PASS', () => {
  for (const change of [x => {x.audit.dashboardSamples = 1}, x => {x.audit.forwarded = 0},
    x => {x.audit.upstreamStatuses = {'503': 1}}, x => {x.receipts = []},
    x => {x.receipts[0].status = 'pending'}, x => {x.receipts[0].leadId = 'wrong-private-fixture'}, x => {x.leads = []}]) {
    const data = snapshot(); change(data)
    const result = evaluateQaResult(data); assert.equal(result.status, 'BLOCKED'); safe(result)
  }
})
test('wrong staff, duplicate records, push requests or deliveries and wrong assigned notice block exact checks', () => {
  for (const change of [x => {x.leads[0].assignedToId = 99}, x => {x.receipts.push(x.receipts[0])},
    x => {x.leads.push(x.leads[0])}, x => {x.notices.push(x.notices[0])},
    x => {x.notices[0].pushRequested = true}, x => {x.notices[0].inApp = false},
    x => {x.notices[0].userId = 99}, x => {x.pushDeliveries = 1}]) {
    const data = snapshot(); change(data)
    const result = evaluateQaResult(data); assert.equal(result.status, 'BLOCKED'); safe(result)
  }
})
test('untrusted audit fields and receipt status cannot enter public output', () => {
  const data = snapshot(); data.audit.payload = 'Ignored Private Contact'; data.receipts[0].status = 'ignored@example.test'
  const result = evaluateQaResult(data)
  assert.equal(result.status, 'BLOCKED'); assert.equal(result.receiptStatuses.unknown, 1); safe(result)
  data.audit.statuses['ignored@example.test'] = 1
  assert.throws(() => evaluateQaResult(data), {message: 'QA_RESULT_REFUSED'})
})
