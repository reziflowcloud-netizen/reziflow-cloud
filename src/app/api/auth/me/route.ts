import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { isSystemAdmin } from '@/lib/organizationProvisioning'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organizationName,
    organizationStatus: user.organizationStatus,
    organizationPlan: user.organizationPlan,
    billingStatus: user.billingStatus,
    trialEndsAt: user.trialEndsAt,
    currentPeriodEndsAt: user.currentPeriodEndsAt,
    canManageAll: isSystemAdmin(user),
  })
}
