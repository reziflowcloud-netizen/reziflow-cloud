import { NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { canManageBilling, getBillingSnapshot } from '@/lib/billing'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageBilling(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const snapshot = await getBillingSnapshot(getOrganizationId(user))
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error('Billing snapshot error:', error)
    return NextResponse.json({ error: 'Не удалось загрузить тариф' }, { status: 500 })
  }
}
