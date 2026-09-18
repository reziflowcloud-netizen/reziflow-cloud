import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getDataAccessScope } from '@/lib/apiScope'
import { BulkRequestError, parseBulkAction, parseBulkSelection } from '@/lib/bulkActions'
import { executeCaseBulkAction } from '@/lib/bulkActionServices'
import { resolveStaffScope, StaffScopeError } from '@/lib/staffScope'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  try {
    const body = await request.json()
    const access = await getDataAccessScope(user, organizationId)
    const staffScope = await resolveStaffScope(body.staffScope, user, organizationId, access)
    const input = {
      action: parseBulkAction(body.action),
      selection: parseBulkSelection(body.selection),
      employeeId: body.employeeId,
      statusId: body.statusId,
    }
    const result = await executeCaseBulkAction({
      organizationId,
      scope: access,
      user,
      input,
      staffScope,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof BulkRequestError || error instanceof StaffScopeError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Case bulk action failed:', error)
    return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 })
  }
}
