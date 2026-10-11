import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticatedNotificationUser } from '@/lib/notificationRequest'
import { canManageNotificationAutomation, organizationAutomation, setOrganizationAutomation } from '@/lib/notificationOrganization'
export const dynamic = 'force-dynamic'
export async function GET() {
  const user = await authenticatedNotificationUser()
  if (!user) return NextResponse.json({ error: 'Unavailable' }, { status: 401 })
  const row = await prisma.organization.findUnique({ where: { id: user.organizationId }, select: { notificationAutomationEnabled: true, notificationAutomationActivatedAt: true } })
  return NextResponse.json({ automation: organizationAutomation(row), canManage: canManageNotificationAutomation(user) }, { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function PUT(request: NextRequest) {
  const user = await authenticatedNotificationUser()
  if (!user) return NextResponse.json({ error: 'Unavailable' }, { status: 401 })
  if (!canManageNotificationAutomation(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => null)
  if (!body || Object.keys(body).join(',') !== 'enabled' || typeof body.enabled !== 'boolean') return NextResponse.json({ error: 'Invalid automation setting' }, { status: 400 })
  try {
    return NextResponse.json({ automation: await setOrganizationAutomation(prisma, user, body.enabled) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ error: 'Automation setting not saved' }, { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 503 })
  }
}
