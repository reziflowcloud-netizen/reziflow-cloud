import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getDataAccessScope } from '@/lib/apiScope'
import { BulkRequestError, parseBulkAction, parseBulkSelection } from '@/lib/bulkActions'
import { executeLeadBulkAction } from '@/lib/bulkActionServices'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  try {
    const body = await request.json()
    const input = {
      action: parseBulkAction(body.action),
      selection: parseBulkSelection(body.selection),
      employeeId: body.employeeId,
      statusId: body.statusId,
      statusReason: body.statusReason,
      statusReasonComment: body.statusReasonComment,
    }
    const result = await executeLeadBulkAction({
      organizationId,
      scope: await getDataAccessScope(user, organizationId),
      user,
      input,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof BulkRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Lead bulk action failed:', error)
    return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 })
  }
}
