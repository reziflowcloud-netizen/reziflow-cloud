import { NextRequest, NextResponse } from 'next/server'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { buildDocumentTemplateData, getTemplateLabel, safeGeneratedFileName } from '@/lib/documentTemplates'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function readPath(scope: any, path: string) {
  return path.split('.').reduce((value, key) => {
    if (value === null || value === undefined) return ''
    return value[key]
  }, scope)
}

function templateParser(tag: string) {
  return {
    get(scope: any) {
      const value = readPath(scope, tag.trim())
      return value === null || value === undefined ? '' : value
    },
  }
}

function parseTaskDescription(description: string | null | undefined) {
  try { return JSON.parse(description || '{}') } catch { return {} }
}

function getTaskPaymentAmount(task: any, meta: any) {
  if (meta.paymentPlan?.amount) return String(meta.paymentPlan.amount).replace(',', '.')
  const match = String(task.title || '').match(/([\d.,]+)\s*z/i)
  return match ? match[1].replace(',', '.') : ''
}

async function loadPlannedPayments(caseRecord: any, organizationId: string) {
  const tasks = await prisma.task.findMany({
    where: { organizationId, status: { not: 'done' } },
    select: { id: true, title: true, description: true, dueDate: true, status: true },
  })
  const caseNumber = String(caseRecord.caseNumber || '')

  return tasks
    .map(task => ({ task, meta: parseTaskDescription(task.description) }))
    .filter(({ task, meta }) => {
      if (meta.paymentPlan?.caseId === caseRecord.id) return true
      return !!caseNumber
        && String(task.title || '').startsWith('Получить платеж')
        && String(meta.reminderNote || '').includes(caseNumber)
    })
    .map(({ task, meta }) => ({
      amount: getTaskPaymentAmount(task, meta),
      dueDate: task.dueDate || meta.reminderAt || null,
      note: meta.reminderNote || '',
      index: meta.paymentPlan?.index || 0,
    }))
    .filter(payment => payment.amount)
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')) || Number(a.index) - Number(b.index))
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const templateId = Number(request.nextUrl.searchParams.get('templateId') || 0)
  const type = request.nextUrl.searchParams.get('type') || ''

  const caseRecord = await (prisma as any).case.findFirst({
    where: { id: params.id, organizationId },
    include: {
      client: true,
      service: true,
      organization: true,
    },
  })
  if (!caseRecord) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

  const where: any = templateId
    ? { id: templateId, organizationId }
    : { organizationId, type }
  const template = await (prisma as any).documentTemplate.findFirst({ where })
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  try {
    const plannedPayments = await loadPlannedPayments(caseRecord, organizationId)
    const zip = new PizZip(Buffer.from(template.content))
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      parser: templateParser,
      nullGetter: () => '',
    } as any)

    doc.render(buildDocumentTemplateData(caseRecord, plannedPayments))
    const generated = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    })

    const fileName = safeGeneratedFileName([
      getTemplateLabel(template.type),
      caseRecord.caseNumber || '',
      caseRecord.client?.lastName || '',
      caseRecord.client?.firstName || '',
    ]) + '.docx'

    const body = new Uint8Array(generated).buffer as ArrayBuffer
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    })
  } catch (error: any) {
    console.error('Document generation error:', error)
    const message = error?.properties?.errors?.[0]?.properties?.explanation || error?.message || 'Could not generate document'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
