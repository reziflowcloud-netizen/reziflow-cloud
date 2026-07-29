import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { caseWhereForScope, getDataAccessScope } from '@/lib/apiScope'

const MAX_BATCH_SIZE = 100

function parseTaskDescription(description?: string | null) {
  try {
    return JSON.parse(description || '{}')
  } catch {
    return {}
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  const body = await request.json().catch(() => ({}))
  const submittedAt = String(body.submittedAt || '')
  const today = new Date().toISOString().slice(0, 10)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(submittedAt) || Number.isNaN(new Date(`${submittedAt}T00:00:00.000Z`).getTime())) {
    return NextResponse.json({ error: 'Invalid submission date' }, { status: 400 })
  }
  if (submittedAt > today) {
    return NextResponse.json({ error: 'Submission date cannot be in the future' }, { status: 400 })
  }

  const requestedNames: unknown[] = Array.isArray(body.names) ? body.names : []
  const names = Array.from(new Set<string>(
    requestedNames
      .map(value => String(value || '').trim())
      .filter(Boolean)
  ))

  if (names.length === 0 || names.length > MAX_BATCH_SIZE) {
    return NextResponse.json({ error: 'Select between 1 and 100 documents' }, { status: 400 })
  }

  const caseRecord = await prisma.case.findFirst({
    where: caseWhereForScope(scope, organizationId, { id: params.id }),
    include: { client: { select: { firstName: true, lastName: true } } },
  })
  if (!caseRecord) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const requestedServiceId = Number.parseInt(String(body.serviceId || ''), 10)
  const serviceOptionType = Number.isInteger(requestedServiceId)
    ? `mosDocument:${requestedServiceId}`
    : caseRecord.serviceId
      ? `mosDocument:${caseRecord.serviceId}`
      : null
  const serviceOptions = serviceOptionType
    ? await prisma.caseOption.findMany({
        where: { organizationId, type: serviceOptionType },
        select: { value: true },
      })
    : []
  const configuredOptions = serviceOptions.length > 0
    ? serviceOptions
    : await prisma.caseOption.findMany({
        where: { organizationId, type: 'mosDocument' },
        select: { value: true },
      })
  const allowedNames = new Set(configuredOptions.map(option => option.value.trim()).filter(Boolean))

  if (names.some(name => !allowedNames.has(name))) {
    return NextResponse.json({ error: 'One or more documents are not configured for this case' }, { status: 400 })
  }

  const existingTasks = await prisma.task.findMany({
    where: {
      organizationId,
      title: { in: names.map(name => `MOS: ${name}`) },
      description: { contains: `"caseId":"${caseRecord.id}"` },
    },
    select: { title: true, status: true, description: true },
  })
  const submittedNames = new Set(
    existingTasks
      .filter(task => {
        const meta = parseTaskDescription(task.description)
        return meta.mosDocument?.caseId === caseRecord.id && (task.status === 'done' || meta.mosDocument?.sentAt)
      })
      .map(task => task.title.replace(/^MOS:\s*/, '').trim())
  )
  const namesToCreate = names.filter(name => !submittedNames.has(name))

  if (namesToCreate.length > 0) {
    const clientName = `${caseRecord.client.firstName || ''} ${caseRecord.client.lastName || ''}`.trim()
    const reminderNote = String(body.reminderNote || '').trim().slice(0, 500)

    await prisma.task.createMany({
      data: namesToCreate.map(name => ({
        organizationId,
        title: `MOS: ${name}`,
        description: JSON.stringify({
          reminderAt: `${submittedAt}T09:00`,
          reminderNote,
          mosDocument: {
            caseId: caseRecord.id,
            caseNumber: caseRecord.caseNumber,
            sentAt: submittedAt,
          },
        }),
        priority: 'Нормально',
        status: 'done',
        dueDate: new Date(`${submittedAt}T00:00:00.000Z`),
        clientName: clientName || null,
        assignedToId: scope.restricted && scope.userId ? scope.userId : null,
      })),
    })
  }

  return NextResponse.json({
    created: namesToCreate.length,
    skipped: names.length - namesToCreate.length,
  })
}
