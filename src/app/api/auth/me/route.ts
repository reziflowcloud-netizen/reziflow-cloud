import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { isSystemAdmin } from '@/lib/organizationProvisioning'
import { isConferenceDemoSession } from '@/lib/conferenceDemo'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const conferenceDemo = isConferenceDemoSession(user)

  return NextResponse.json({
    id: user.id,
    email: conferenceDemo ? null : user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organizationName,
    organizationStatus: user.organizationStatus,
    organizationPlan: user.organizationPlan,
    billingStatus: user.billingStatus,
    trialEndsAt: user.trialEndsAt,
    currentPeriodEndsAt: user.currentPeriodEndsAt,
    canManageAll: conferenceDemo ? false : isSystemAdmin(user),
    isConferenceDemo: conferenceDemo,
  })
}
