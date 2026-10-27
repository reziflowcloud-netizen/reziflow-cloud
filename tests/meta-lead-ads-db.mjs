import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

if (!process.env.META_LEAD_ADS_SYNTHETIC_DB_TEST || !/^postgresql:\/\/[^@]+@127\.0\.0\.1:\d+\/meta_lead_ads_qa\?schema=public$/.test(process.env.DATABASE_URL || '')) {
  throw new Error('Synthetic localhost database guard failed')
}
const db = new PrismaClient()
const suffix = randomUUID().slice(0, 8)
const orgA = await db.organization.create({ data: { name: 'Synthetic Lead Ads A', slug: `synthetic-lead-ads-a-${suffix}` } })
const orgB = await db.organization.create({ data: { name: 'Synthetic Lead Ads B', slug: `synthetic-lead-ads-b-${suffix}` } })
try {
  const binding = await db.metaLeadAdsBinding.create({ data: {
    organizationId: orgA.id, appId: '999', pageId: '111', formId: '222', enabled: true, mode: 'pilot',
    activatedAt: new Date(), pilotLeadIds: ['333'],
  } })
  const off = await db.metaLeadAdsBinding.create({ data: { organizationId: orgB.id, appId: '999', pageId: '444', formId: '555' } })
  assert.equal(off.enabled, false)
  assert.equal(off.mode, 'off')
  const fingerprint = createHash('sha256').update('999:333').digest('hex')
  const duplicates = await Promise.allSettled(Array.from({ length: 8 }, () => db.metaLeadAdsDelivery.create({ data: {
    organizationId: orgA.id, bindingId: binding.id, appId: '999', leadgenId: '333',
    eventFingerprint: fingerprint, acceptedMode: 'pilot',
  } })))
  assert.equal(duplicates.filter(item => item.status === 'fulfilled').length, 1)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { appId: '999', eventFingerprint: fingerprint } }), 1)
  await assert.rejects(db.metaLeadAdsBinding.create({ data: { organizationId: orgB.id, appId: '999', pageId: '111', formId: '222' } }),
    error => error.code === 'P2002')
  await assert.rejects(db.metaLeadAdsDelivery.create({ data: {
    organizationId: orgB.id, bindingId: binding.id, appId: '999', leadgenId: '777',
    eventFingerprint: createHash('sha256').update('999:777').digest('hex'), acceptedMode: 'pilot',
  } }), error => error.code === 'P2003')
  assert.equal(await db.lead.count({ where: { organizationId: orgA.id } }), 0)
  assert.equal(await db.lead.count({ where: { organizationId: orgB.id } }), 0)
  console.log('SYNTHETIC_DB PASS: default off, tenant FK, binding uniqueness, concurrent receipt dedupe, old Lead query')
} finally {
  await db.$disconnect()
}
