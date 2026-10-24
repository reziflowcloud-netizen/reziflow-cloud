// Synthetic in-memory API for UI review only. No Prisma, DB, external services or authentication.
import { NextResponse } from 'next/server'
import {
  actualizationDate,
  actualizationDay,
  actualizationSummary,
  actualizationTitles,
  serviceDocUpdate,
} from '@/lib/documentActualizationPolicy'
export const dynamic = 'force-dynamic'
const caseId = 'synthetic-actualization'
function initial() {
  const day = actualizationDay(new Date()),
    base = new Date(day + 'T00:00:00Z')
  base.setUTCDate(base.getUTCDate() - 90)
  return {
    id: caseId,
    organizationId: 'synthetic-ui',
    clientId: 'synthetic-client',
    caseNumber: 'SYNTHETIC-ACTUALIZATION',
    assignedToId: 1,
    employeeId: 11,
    employee: { id: 11, name: 'Synthetic Explicit Owner', userId: 1 },
    status: 'Новый',
    totalValue: 0,
    mosNumber: 'SYNTHETIC-MOS',
    mosSentByPost: true,
    mosSentAt: null,
    predictedDecisionDate: base.toISOString(),
    decisionReceived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    client: { id: 'synthetic-client', firstName: 'Synthetic', lastName: 'Review', phones: [] },
    payments: [],
    comments: [],
    statusHistory: [],
    customDates: [],
    docUpdates: [],
    caseDocuments: [],
    customFieldValues: {},
  }
}
function sync(m) {
  const cycle = actualizationDate(m.record)
  for (const task of Object.values(m.cycles))
    if (
      task.status !== 'done' &&
      (m.record.decisionReceived ||
        JSON.parse(task.description).documentActualization.cycle !== cycle)
    )
      task.status = 'inactive'
  if (cycle && !m.record.decisionReceived) {
    let task = m.cycles[cycle]
    if (!task)
      m.cycles[cycle] = {
        id: 'case-actualization-ui-' + cycle,
        organizationId: 'synthetic-ui',
        title: actualizationTitles.uk,
        status: 'todo',
        priority: 'Нормально',
        dueDate: cycle + 'T00:00:00.000Z',
        assignedToId: 1,
        assignedTo: { id: 1, name: 'Synthetic Reviewer' },
        clientName: 'Synthetic Review',
        updatedAt: m.record.updatedAt,
        description: JSON.stringify({
          reminderAt: cycle + 'T09:00',
          documentActualization: { version: 1, caseId, caseNumber: m.record.caseNumber, cycle },
        }),
      }
    else if (task.status === 'inactive') task.status = 'todo'
  }
  m.record.documentActualization = actualizationSummary(m.record, Object.values(m.cycles))
}
function memory() {
  if (!globalThis.__actualizationUiQa) {
    globalThis.__actualizationUiQa = { record: initial(), cycles: {}, nextId: 1, fail: false }
    sync(globalThis.__actualizationUiQa)
  }
  return globalThis.__actualizationUiQa
}
const json = (value, status = 200) =>
  NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
const local = (req) => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(req.url).hostname)
const guard = (req) =>
  !local(req) ||
  (req.headers.get('origin') && new URL(req.headers.get('origin')).host !== req.headers.get('host'))
const bump = (m) => {
  m.record.updatedAt = new Date(
    Math.max(Date.now(), Date.parse(m.record.updatedAt) + 1),
  ).toISOString()
  sync(m)
}
export async function GET(req, { params }) {
  if (guard(req)) return json({ error: 'Loopback only' }, 403)
  const m = memory(),
    p = params.path.join('/')
  let data = []
  if (p === 'cases/' + caseId) data = m.record
  else if (p === 'cases') data = [m.record]
  else if (p === 'cases/' + caseId + '/checklist')
    data = {
      initialized: false,
      version: 0,
      items: [],
      progress: { required: 0, received: 0, missing: 0 },
    }
  else if (p === 'tasks') data = Object.values(m.cycles).filter((t) => t.status !== 'inactive')
  else if (p.startsWith('tasks/')) {
    data = Object.values(m.cycles).find((t) => t.id === params.path[1])
    if (!data) return json({ error: 'Not found' }, 404)
  } else if (p === 'clients') data = [m.record.client]
  else if (p === 'employees')
    data = [{ id: 11, name: 'Synthetic Explicit Owner', userId: 1, active: true }]
  else if (p === 'users') data = [{ id: 1, name: 'Synthetic Reviewer' }]
  else if (p === 'staff-scope')
    data = {
      userId: 1,
      organizationId: 'synthetic-ui',
      restricted: false,
      controlVisible: true,
      mineAvailable: true,
      employees: [{ id: 11, name: 'Synthetic Explicit Owner', userId: 1 }],
    }
  else if (p === 'auth/me')
    data = { id: 1, name: 'Synthetic Reviewer', role: 'owner', organizationId: 'synthetic-ui' }
  else if (p === 'statuses') data = [{ id: 1, name: 'Новый', color: '#06b6d4' }]
  else if (p === 'task-priorities')
    data = [{ id: 1, name: 'Нормально', color: '#06b6d4', order: 0 }]
  else if (p === 'organization-settings') data = { settings: { mosAutoRemindersEnabled: false } }
  else if (p === 'ui-section-settings') data = { settings: [], canManage: false }
  else if (p === 'custom-field-values') data = { sections: [], values: {} }
  else if (p === 'document-templates') data = { templates: [] }
  else if (p === 'notifications/preferences')
    data = { preferences: {}, canReceiveTeam: false, pushAvailable: false, devices: 0 }
  else if (p === 'notifications/meta-messages') data = { count: 0, items: [] }
  return json(data)
}
async function mutation(req, { params }, method) {
  if (guard(req)) return json({ error: 'Loopback only' }, 403)
  const m = memory(),
    p = params.path.join('/'),
    body =
      method === 'DELETE'
        ? { expectedUpdatedAt: req.headers.get('X-LegalHub-Case-Version') || undefined }
        : await req.json()
  if (!body || typeof body !== 'object') return json({ error: 'Invalid body' }, 400)
  if (p === 'mock/control') {
    if (body.action === 'reset') {
      globalThis.__actualizationUiQa = null
      return json({ mock: true })
    }
    if (body.action === 'fail') m.fail = true
    if (body.action === 'recover') m.fail = false
    if (body.action === 'external') bump(m)
    return json({ mock: true })
  }
  if (m.fail) return json({ error: 'Intentional synthetic failure' }, 503)
  if (
    body.expectedUpdatedAt !== undefined &&
    body.expectedUpdatedAt !== m.record.updatedAt &&
    !p.startsWith('tasks/')
  )
    return json({ error: 'CASE_CONFLICT' }, 409)
  if (method === 'PATCH' && p === 'cases/' + caseId) {
    if ('decisionReceived' in body && typeof body.decisionReceived !== 'boolean')
      return json({ error: 'Invalid boolean' }, 400)
    for (const key of ['decisionReceived', 'predictedDecisionDate', 'mosNumber', 'notes'])
      if (key in body) m.record[key] = body[key] || key === 'decisionReceived' ? body[key] : null
    bump(m)
    return json(m.record)
  }
  if (p.startsWith('cases/' + caseId + '/doc-updates')) {
    const id = Number(params.path[3]),
      index = m.record.docUpdates.findIndex((d) => d.id === id),
      existing = m.record.docUpdates[index]
    if (method === 'DELETE') {
      if (!existing) return json({ error: 'Not found' }, 404)
      m.record.docUpdates.splice(index, 1)
    } else {
      if (!actualizationDay(body.date) || typeof body.description !== 'string')
        return json({ error: 'Invalid update' }, 400)
      const date = new Date(body.date).toISOString()
      if (method === 'POST') {
        const replay = m.record.docUpdates.find(
          (d) => d.date === date && d.description === body.description,
        )
        if (replay) return json(replay)
        const row = { id: m.nextId++, date, description: body.description }
        m.record.docUpdates.push(row)
        bump(m)
        return json(row)
      }
      if (!existing) return json({ error: 'Not found' }, 404)
      m.record.docUpdates[index] = { ...existing, date, description: body.description }
    }
    bump(m)
    return json(method === 'DELETE' ? { ok: true } : m.record.docUpdates[index])
  }
  if (method === 'PATCH' && p.startsWith('tasks/')) {
    const task = Object.values(m.cycles).find((t) => t.id === params.path[1])
    if (!task) return json({ error: 'Not found' }, 404)
    if (Object.keys(body).some((k) => !['status', 'priority', 'expectedUpdatedAt'].includes(k)))
      return json({ error: 'Managed by Case' }, 409)
    if (body.status) task.status = body.status
    if (body.priority) task.priority = body.priority
    task.updatedAt = new Date().toISOString()
    sync(m)
    return json(task)
  }
  return json({ error: 'Unsupported synthetic action' }, 405)
}
export const PATCH = (r, p) => mutation(r, p, 'PATCH')
export const POST = (r, p) => mutation(r, p, 'POST')
export const DELETE = (r, p) => mutation(r, p, 'DELETE')
export async function PUT() {
  return json({ error: 'Unsupported synthetic action' }, 405)
}
