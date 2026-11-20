import { NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { canManageBilling, getBillingSnapshot } from '@/lib/billing'
import { authorizeStripeBilling } from '@/lib/stripeBilling'
import { stripeBillingFailure } from '@/lib/stripeBillingHttp'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageBilling(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await authorizeStripeBilling(user)
    const snapshot = await getBillingSnapshot(getOrganizationId(user))
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return stripeBillingFailure(error)
  }
}
